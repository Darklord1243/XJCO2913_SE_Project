import { useCallback, useEffect, useMemo, useState } from 'react';
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

  function openWalkinModal() {
    setWalkinForm(INITIAL_WALKIN_FORM);
    setWalkinMessage({ text: '', state: '' });
    setShowWalkinModal(true);
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
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Bookings overview</h2>
          </div>
          <p className="empty-state">
            Sign in as a staff member or administrator to review platform bookings.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="my-bookings-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header panel-header--row">
          <div>
            <p className="panel-kicker">Admin</p>
            <h2>Bookings overview</h2>
          </div>
          <button type="button" onClick={openWalkinModal}>
            Book Walk-in
          </button>
        </div>

        <div className="admin-filter-grid">
          <label htmlFor="admin-bookings-status">
            Status
            <select
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
          </label>
          <label htmlFor="admin-bookings-scooter">
            Scooter ID
            <input
              id="admin-bookings-scooter"
              type="text"
              placeholder="ESC-001"
              value={scooterFilter}
              onChange={(event) => setScooterFilter(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setStatusFilter('');
              setScooterFilter('');
            }}
          >
            Reset filters
          </button>
        </div>

        <div className="admin-summary-row" role="list">
          <div className="summary-card" role="listitem">
            <p className="summary-label">Total bookings</p>
            <p className="summary-value">{summary.total}</p>
          </div>
          <div className="summary-card summary-card--available" role="listitem">
            <p className="summary-label">Active</p>
            <p className="summary-value">{summary.active}</p>
          </div>
          <div className="summary-card summary-card--reserved" role="listitem">
            <p className="summary-label">Completed</p>
            <p className="summary-value">{summary.completed}</p>
          </div>
          <div className="summary-card" role="listitem">
            <p className="summary-label">Revenue (filtered)</p>
            <p className="summary-value">{formatCurrency(summary.revenue)}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state">Loading bookings overview...</p>
        ) : error ? (
          <p className="message" data-state="error" role="alert">
            {error}
          </p>
        ) : bookings.length === 0 ? (
          <p className="empty-state">No bookings match the current filters.</p>
        ) : (
          <div className="booking-history" role="list">
            {bookings.map((booking) => (
              <article
                key={booking.bookingId}
                className="booking-history__item"
                role="listitem"
              >
                <div className="booking-history__header">
                  <div>
                    <p className="summary-label">Booking</p>
                    <p className="summary-value">#{booking.bookingId}</p>
                  </div>
                  <span
                    className={`status-pill status-pill--${booking.status}`}
                  >
                    {toStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="booking-history__grid">
                  <div className="summary-card">
                    <p className="summary-label">User</p>
                    <p className="summary-value">
                      {booking.userFullName || `User #${booking.userId}`}
                    </p>
                    <p className="hire-note">{booking.userEmail || ''}</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Scooter</p>
                    <p className="summary-value">{booking.scooterId}</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Hire plan</p>
                    <p className="summary-value">
                      {DURATION_LABELS[booking.durationCode] ||
                        toStatusLabel(booking.durationCode)}
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Total price</p>
                    <p className="summary-value">
                      {formatCurrency(booking.totalPrice)}
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Created</p>
                    <p className="summary-value">
                      {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Last updated</p>
                    <p className="summary-value">
                      {formatDateTime(booking.updatedAt)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      {/* Walk-in booking modal */}
      {showWalkinModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-label="Book walk-in customer"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowWalkinModal(false);
            }
          }}
        >
          <div className="modal-window">
            <h3>Book Walk-in Customer</h3>

            <form className="form-grid" onSubmit={handleWalkinSubmit}>
              <label htmlFor="walkin-scooter">
                Scooter ID
                <input
                  id="walkin-scooter"
                  type="text"
                  placeholder="ESC-001"
                  value={walkinForm.scooterId}
                  onChange={(e) =>
                    updateWalkinField('scooterId', e.target.value)
                  }
                  required
                />
              </label>

              <label htmlFor="walkin-duration">
                Hire plan
                <select
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
              </label>

              <fieldset className="plan-selector">
                <legend className="form-section-title">
                  Guest details (optional)
                </legend>
                <label htmlFor="walkin-guest-name">
                  Name
                  <input
                    id="walkin-guest-name"
                    type="text"
                    placeholder="Jane Doe"
                    value={walkinForm.guestName}
                    onChange={(e) =>
                      updateWalkinField('guestName', e.target.value)
                    }
                  />
                </label>
                <label htmlFor="walkin-guest-email">
                  Email (for confirmation)
                  <input
                    id="walkin-guest-email"
                    type="email"
                    placeholder="jane@example.com"
                    value={walkinForm.guestEmail}
                    onChange={(e) =>
                      updateWalkinField('guestEmail', e.target.value)
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="plan-selector">
                <legend className="form-section-title">
                  Payment (simulated)
                </legend>
                <div className="payment-grid">
                  <label htmlFor="walkin-cardholder">
                    Cardholder name
                    <input
                      id="walkin-cardholder"
                      type="text"
                      placeholder="Jane Doe"
                      value={walkinForm.cardholderName}
                      onChange={(e) =>
                        updateWalkinField('cardholderName', e.target.value)
                      }
                      required
                    />
                  </label>
                  <label htmlFor="walkin-card-number">
                    Card number (16 digits)
                    <input
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
                  </label>
                  <label htmlFor="walkin-expiry">
                    Expiry (MM/YY)
                    <input
                      id="walkin-expiry"
                      type="text"
                      placeholder="12/30"
                      value={walkinForm.expiryDate}
                      onChange={(e) =>
                        updateWalkinField('expiryDate', e.target.value)
                      }
                      required
                    />
                  </label>
                  <label htmlFor="walkin-cvv">
                    CVV
                    <input
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
                  </label>
                </div>
                <p className="payment-note">
                  Use 4242 4242 4242 4242 for success or 4000 0000 0000 0002
                  for decline (simulator only).
                </p>
              </fieldset>

              {walkinMessage.text ? (
                <p
                  className="message"
                  data-state={walkinMessage.state}
                  role="alert"
                >
                  {walkinMessage.text}
                </p>
              ) : null}

              <div className="modal-actions">
                <button type="submit" disabled={walkinSubmitting}>
                  {walkinSubmitting ? 'Booking...' : 'Create booking'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowWalkinModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
