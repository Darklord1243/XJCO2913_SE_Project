import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Inbox, Lock, Plus, RotateCcw, X } from 'lucide-react';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const API_BASE = 'http://127.0.0.1:3000/api';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

const DURATION_LABELS = {
  oneHour: '1 Hour',
  fourHours: '4 Hours',
  oneDay: '1 Day',
  oneWeek: '1 Week',
};

const DURATION_OPTIONS = [
  { value: '', label: 'Select a plan...' },
  { value: 'oneHour', label: '1 Hour' },
  { value: 'fourHours', label: '4 Hours' },
  { value: 'oneDay', label: '1 Day' },
  { value: 'oneWeek', label: '1 Week' },
];

const INITIAL_WALKIN_FORM = {
  scooterId: '',
  durationCode: '',
  cardholderName: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  guestName: '',
  guestEmail: '',
};

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    console.error('AdminBookings: failed to format date', error);
    return 'Not available';
  }
}

function toStatusLabel(status) {
  return String(status || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AdminBookings({ session }) {
  const token = getSessionToken(session);
  const [statusFilter, setStatusFilter] = useState('');
  const [scooterFilter, setScooterFilter] = useState('');
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Walk-in modal state
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinForm, setWalkinForm] = useState(INITIAL_WALKIN_FORM);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [walkinMessage, setWalkinMessage] = useState({ text: '', state: '' });

  const walkinTriggerRef = useRef(null);
  const walkinModalRef = useRef(null);

  const fetchBookings = useCallback(
    async (signal) => {
      if (!token) {
        setBookings([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();

      if (statusFilter) {
        params.set('status', statusFilter);
      }

      const trimmedScooter = scooterFilter.trim();

      if (trimmedScooter) {
        params.set('scooterId', trimmedScooter);
      }

      const queryString = params.toString();
      const url = queryString
        ? `${API_BASE}/admin/bookings?${queryString}`
        : `${API_BASE}/admin/bookings`;

      try {
        const payload = await requestJson(url, {
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (
          !payload ||
          payload.success !== true ||
          !Array.isArray(payload.data)
        ) {
          throw new Error('Invalid API response contract for admin bookings.');
        }

        setBookings(payload.data);
      } catch (fetchError) {
        if (fetchError?.name === 'AbortError') {
          return;
        }

        console.error('AdminBookings: failed to fetch bookings', fetchError);
        setError(fetchError?.message || 'Failed to load bookings.');
        setBookings([]);
      } finally {
        setIsLoading(false);
      }
    },
    [scooterFilter, statusFilter, token]
  );

  useEffect(() => {
    if (!token) {
      setBookings([]);
      return undefined;
    }

    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings, token]);

  useEffect(() => {
    if (!showWalkinModal) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !walkinSubmitting) {
        event.preventDefault();
        closeWalkinModal();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showWalkinModal, walkinSubmitting]);

  useEffect(() => {
    if (!showWalkinModal || !walkinModalRef.current) {
      return;
    }

    const focusable = walkinModalRef.current.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus();
    }
  }, [showWalkinModal]);

  const summary = useMemo(() => {
    const total = bookings.length;
    let active = 0;
    let completed = 0;
    let revenue = 0;

    for (const booking of bookings) {
      if (booking.status === 'active') {
        active += 1;
      } else if (booking.status === 'completed') {
        completed += 1;
      }

      if (typeof booking.totalPrice === 'number') {
        revenue += booking.totalPrice;
      }
    }

    return { total, active, completed, revenue };
  }, [bookings]);

  // Walk-in form handlers
  function updateWalkinField(field, value) {
    setWalkinForm((prev) => ({ ...prev, [field]: value }));
    setWalkinMessage({ text: '', state: '' });
  }

  function openWalkinModal(triggerElement) {
    if (triggerElement instanceof HTMLElement) {
      walkinTriggerRef.current = triggerElement;
    }
    setWalkinForm(INITIAL_WALKIN_FORM);
    setWalkinMessage({ text: '', state: '' });
    setShowWalkinModal(true);
  }

  function closeWalkinModal() {
    if (walkinSubmitting) {
      return;
    }
    setShowWalkinModal(false);
    setWalkinMessage({ text: '', state: '' });
    const trigger = walkinTriggerRef.current;
    walkinTriggerRef.current = null;
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  }

  async function handleWalkinSubmit(event) {
    event.preventDefault();

    if (!token) {
      setWalkinMessage({
        text: 'You must be signed in as a staff member or administrator to create a walk-in booking.',
        state: 'error',
      });
      return;
    }

    setWalkinSubmitting(true);
    setWalkinMessage({ text: '', state: '' });

    try {
      const payload = await requestJson(`${API_BASE}/admin/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scooterId: walkinForm.scooterId.trim(),
          durationCode: walkinForm.durationCode,
          payment: {
            cardholderName: walkinForm.cardholderName.trim(),
            cardNumber: walkinForm.cardNumber.trim(),
            expiryDate: walkinForm.expiryDate.trim(),
            cvv: walkinForm.cvv.trim(),
          },
          guestName: walkinForm.guestName.trim() || undefined,
          guestEmail: walkinForm.guestEmail.trim() || undefined,
        }),
      });

      setWalkinMessage({
        text: `Walk-in booking created. Booking #${payload.data.bookingId}, £${(payload.data.totalPrice ?? 0).toFixed(2)}.`,
        state: 'success',
      });

      // Refresh the bookings list
      const controller = new AbortController();
      await fetchBookings(controller.signal);
    } catch (submitError) {
      setWalkinMessage({
        text: submitError?.message || 'Failed to create walk-in booking.',
        state: 'error',
      });
    } finally {
      setWalkinSubmitting(false);
    }
  }

  if (!token) {
    return (
      <section className="admin-shell">
        <article className="admin-card admin-card--accent">
          <div className="admin-header">
            <div className="admin-header__text">
              <h2 className="admin-title">Bookings overview</h2>
            </div>
          </div>
          <p className="admin-empty">
            Sign in as a staff member or administrator to review platform bookings.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="admin-shell">
      <article className="admin-card admin-card--accent">
        <div className="admin-header">
          <div className="admin-header__text">
            <p className="admin-kicker">Admin</p>
            <h2 className="admin-title">Bookings overview</h2>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={(e) => openWalkinModal(e.currentTarget)}
          >
            <Plus size={16} aria-hidden="true" />
            Book Walk-in
          </button>
        </div>

        <div className="admin-filters">
          <div className="field">
            <label className="field__label" htmlFor="admin-bookings-status">
              Status
            </label>
            <select
              className="input"
              id="admin-bookings-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="admin-bookings-scooter">
              Scooter ID
            </label>
            <input
              className="input"
              id="admin-bookings-scooter"
              type="text"
              placeholder="ESC-001"
              value={scooterFilter}
              onChange={(event) => setScooterFilter(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setStatusFilter('');
              setScooterFilter('');
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset filters
          </button>
        </div>

        <div className="admin-kpi-row">
          <div className="admin-kpi">
            <p className="admin-kpi__label">Total bookings</p>
            <p className="admin-kpi__value">{summary.total}</p>
          </div>
          <div className="admin-kpi admin-kpi--active">
            <p className="admin-kpi__label">Active</p>
            <p className="admin-kpi__value">{summary.active}</p>
          </div>
          <div className="admin-kpi admin-kpi--completed">
            <p className="admin-kpi__label">Completed</p>
            <p className="admin-kpi__value">{summary.completed}</p>
          </div>
          <div className="admin-kpi">
            <p className="admin-kpi__label">Revenue (filtered)</p>
            <p className="admin-kpi__value">{formatCurrency(summary.revenue)}</p>
          </div>
        </div>

        {isLoading ? (
          <>
            <div className="admin-skeleton-kpi">
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
            </div>
            <div className="admin-skeleton-table">
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
            </div>
            <span className="sr-only">Loading bookings</span>
          </>
        ) : error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="admin-empty-state">
            <Inbox size={48} className="admin-empty-state__icon" aria-hidden="true" />
            <p className="admin-empty-state__title">No bookings match the current filters</p>
            <p className="admin-empty-state__sub">Try clearing status or scooter filters.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table__th" scope="col">Booking</th>
                  <th className="data-table__th" scope="col">Status</th>
                  <th className="data-table__th" scope="col">User</th>
                  <th className="data-table__th" scope="col">Scooter</th>
                  <th className="data-table__th" scope="col">Plan</th>
                  <th className="data-table__th" scope="col">Total</th>
                  <th className="data-table__th" scope="col">Created</th>
                  <th className="data-table__th" scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.bookingId}>
                    <td className="data-table__td" data-label="Booking">
                      <span className="data-table__booking-id">#{booking.bookingId}</span>
                    </td>
                    <td className="data-table__td" data-label="Status">
                      <span className={`status-pill status-pill--${booking.status}`}>
                        {toStatusLabel(booking.status)}
                      </span>
                    </td>
                    <td className="data-table__td" data-label="User">
                      {booking.userFullName || `User #${booking.userId}`}
                      {booking.userEmail ? (
                        <span className="data-table__user-email">{booking.userEmail}</span>
                      ) : null}
                    </td>
                    <td className="data-table__td" data-label="Scooter">{booking.scooterId}</td>
                    <td className="data-table__td" data-label="Plan">
                      {DURATION_LABELS[booking.durationCode] || toStatusLabel(booking.durationCode)}
                    </td>
                    <td className="data-table__td" data-label="Total">{formatCurrency(booking.totalPrice)}</td>
                    <td className="data-table__td" data-label="Created">{formatDateTime(booking.createdAt)}</td>
                    <td className="data-table__td" data-label="Updated">{formatDateTime(booking.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* Walk-in booking modal */}
      {showWalkinModal && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeWalkinModal();
            }
          }}
        >
          <div
            className="modal"
            ref={walkinModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkin-dialog-title"
          >
            <div className="modal__header">
              <h2 className="modal__title" id="walkin-dialog-title">
                Book Walk-in Customer
              </h2>
              <button
                type="button"
                className="modal__close"
                onClick={closeWalkinModal}
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="modal__body">
              <form className="fleet-modal__form" onSubmit={handleWalkinSubmit}>
                <div className="field">
                  <label className="field__label" htmlFor="walkin-scooter">
                    Scooter ID
                  </label>
                  <input
                    className="input"
                    id="walkin-scooter"
                    type="text"
                    placeholder="ESC-001"
                    value={walkinForm.scooterId}
                    onChange={(e) =>
                      updateWalkinField('scooterId', e.target.value)
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="walkin-duration">
                    Hire plan
                  </label>
                  <select
                    className="input"
                    id="walkin-duration"
                    value={walkinForm.durationCode}
                    onChange={(e) =>
                      updateWalkinField('durationCode', e.target.value)
                    }
                    required
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset className="admin-modal__section">
                  <legend>Guest details (optional)</legend>
                  <div className="field">
                    <label className="field__label" htmlFor="walkin-guest-name">
                      Name
                    </label>
                    <input
                      className="input"
                      id="walkin-guest-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={walkinForm.guestName}
                      onChange={(e) =>
                        updateWalkinField('guestName', e.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="walkin-guest-email">
                      Email (for confirmation)
                    </label>
                    <input
                      className="input"
                      id="walkin-guest-email"
                      type="email"
                      placeholder="jane@example.com"
                      value={walkinForm.guestEmail}
                      onChange={(e) =>
                        updateWalkinField('guestEmail', e.target.value)
                      }
                    />
                  </div>
                </fieldset>

                <fieldset className="admin-modal__section">
                  <legend>Payment (simulated)</legend>
                  <p className="fleet-modal__payment-heading">
                    <Lock size={14} aria-hidden="true" />
                    Card details
                  </p>
                  <div className="page-form__row">
                    <div className="field">
                      <label className="field__label" htmlFor="walkin-cardholder">
                        Cardholder name
                      </label>
                      <input
                        className="input"
                        id="walkin-cardholder"
                        type="text"
                        placeholder="Jane Doe"
                        value={walkinForm.cardholderName}
                        onChange={(e) =>
                          updateWalkinField('cardholderName', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="walkin-card-number">
                        Card number
                      </label>
                      <input
                        className="input"
                        id="walkin-card-number"
                        type="text"
                        inputMode="numeric"
                        placeholder="4242 4242 4242 4242"
                        value={walkinForm.cardNumber}
                        onChange={(e) =>
                          updateWalkinField('cardNumber', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="walkin-expiry">
                        Expiry (MM/YY)
                      </label>
                      <input
                        className="input"
                        id="walkin-expiry"
                        type="text"
                        placeholder="12/30"
                        value={walkinForm.expiryDate}
                        onChange={(e) =>
                          updateWalkinField('expiryDate', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="walkin-cvv">
                        CVV
                      </label>
                      <input
                        className="input"
                        id="walkin-cvv"
                        type="text"
                        inputMode="numeric"
                        placeholder="123"
                        value={walkinForm.cvv}
                        onChange={(e) =>
                          updateWalkinField('cvv', e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                  <p className="admin-modal__payment-note">
                    Use 4242 4242 4242 4242 for success or 4000 0000 0000 0002
                    for decline (simulator only).
                  </p>
                </fieldset>

                {walkinMessage.text ? (
                  <div
                    className={`alert ${walkinMessage.state === 'error' ? 'alert--error' : 'alert--success'}`}
                    role="alert"
                  >
                    {walkinMessage.text}
                  </div>
                ) : null}

                <div className="modal__footer">
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={walkinSubmitting}
                  >
                    {walkinSubmitting ? 'Booking...' : 'Create booking'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={closeWalkinModal}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
