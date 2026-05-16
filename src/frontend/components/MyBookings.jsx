import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useBookings } from '../hooks/useBookings';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const API_BASE = 'http://127.0.0.1:3000/api';

const DURATION_LABELS = {
  oneHour: '1 Hour',
  fourHours: '4 Hours',
  oneDay: '1 Day',
  oneWeek: '1 Week',
};

const DURATION_ORDER = ['oneHour', 'fourHours', 'oneDay', 'oneWeek'];

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toStatusLabel(status) {
  return String(status || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function longerDurations(currentCode) {
  const idx = DURATION_ORDER.indexOf(currentCode);

  if (idx < 0) {
    return [];
  }

  return DURATION_ORDER.slice(idx + 1);
}

export default function MyBookings({ session, refreshKey }) {
  const { bookings, isLoading, error, refetchBookings } = useBookings(
    session,
    refreshKey
  );

  const [cancellingId, setCancellingId] = useState(null);
  const [extendingId, setExtendingId] = useState(null);
  const [extendDuration, setExtendDuration] = useState('');
  const [actionMessage, setActionMessage] = useState({
    text: '',
    state: '',
  });

  const token = getSessionToken(session);

  async function handleCancel(bookingId) {
    if (!token || cancellingId) {
      return;
    }

    setCancellingId(bookingId);
    setActionMessage({ text: '', state: '' });

    try {
      await requestJson(`${API_BASE}/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setActionMessage({
        text: `Booking #${bookingId} has been cancelled successfully.`,
        state: 'success',
      });
      refetchBookings();
    } catch (err) {
      setActionMessage({
        text: err?.message || 'Failed to cancel booking.',
        state: 'error',
      });
    } finally {
      setCancellingId(null);
    }
  }

  function openExtend(bookingId, currentDuration) {
    const options = longerDurations(currentDuration);

    if (options.length === 0) {
      return;
    }

    setExtendingId(bookingId);
    setExtendDuration(options[0]);
    setActionMessage({ text: '', state: '' });
  }

  function closeExtend() {
    setExtendingId(null);
    setExtendDuration('');
  }

  async function handleExtendSubmit(bookingId) {
    if (!token || !extendDuration) {
      return;
    }

    try {
      const result = await requestJson(
        `${API_BASE}/bookings/${bookingId}/extend`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newDurationCode: extendDuration }),
        }
      );

      setActionMessage({
        text: `Booking #${bookingId} extended to ${DURATION_LABELS[extendDuration] || extendDuration}. New total: ${formatCurrency(result.data.totalPrice)}.`,
        state: 'success',
      });
      closeExtend();
      refetchBookings();
    } catch (err) {
      setActionMessage({
        text: err?.message || 'Failed to extend booking.',
        state: 'error',
      });
    }
  }

  if (!token) {
    return (
      <section className="bookings-page">
        <article
          className="page-card page-card--accent page-card--wide"
          data-id="ID8"
        >
          <div className="page-header">
            <h2 className="page-title">My bookings</h2>
          </div>
          <p className="page-empty">
            Sign in to view booking history and active hire records.
          </p>
        </article>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="bookings-page">
        <article
          className="page-card page-card--accent page-card--wide"
          data-id="ID8"
        >
          <div className="page-header">
            <h2 className="page-title">My bookings</h2>
          </div>
          <div className="skeleton-stack">
            <div className="skeleton skeleton--row" aria-hidden="true" />
            <div className="skeleton skeleton--row" aria-hidden="true" />
            <div className="skeleton skeleton--row" aria-hidden="true" />
          </div>
          <span className="sr-only">Loading booking history</span>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bookings-page">
        <article
          className="page-card page-card--accent page-card--wide"
          data-id="ID8"
        >
          <div className="page-header">
            <h2 className="page-title">My bookings</h2>
          </div>
          <div className="alert alert--error" role="alert">
            Could not load bookings: {error}
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={refetchBookings}
          >
            Retry
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="bookings-page">
      <article
        className="page-card page-card--accent page-card--wide"
        data-id="ID8-ID11-ID12"
      >
        <div className="page-header">
          <h2 className="page-title">My bookings</h2>
        </div>

        {actionMessage.text ? (
          <div
            className={`alert ${actionMessage.state === 'error' ? 'alert--error' : 'alert--success'}`}
            role="status"
            aria-live="polite"
          >
            {actionMessage.text}
          </div>
        ) : null}

        {bookings.length === 0 ? (
          <div className="page-empty-state">
            <Inbox size={48} className="page-empty-state__icon" />
            <p className="page-empty-state__title">No bookings yet</p>
            <p className="page-empty-state__sub">
              Your successful bookings will appear here.
            </p>
          </div>
        ) : (
          <div className="list-stack" role="list" aria-live="polite">
            {bookings.map((booking) => {
              const isActive = booking.status === 'active';
              const canExtend =
                isActive && longerDurations(booking.durationCode).length > 0;
              const isThisCancelling = cancellingId === booking.bookingId;
              const isThisExtending = extendingId === booking.bookingId;

              return (
                <article
                  key={booking.bookingId}
                  className="list-card"
                  role="listitem"
                >
                  <div className="list-card__header">
                    <div className="list-card__heading">
                      <p className="list-card__label">Booking ID</p>
                      <p className="list-card__value">{booking.bookingId}</p>
                    </div>
                    <span
                      className={`status-pill status-pill--${booking.status}`}
                    >
                      {toStatusLabel(booking.status)}
                    </span>
                  </div>

                  <div className="list-card__meta">
                    <div className="list-card__stat">
                      <p className="list-card__label">Scooter</p>
                      <p className="list-card__value">{booking.scooterId}</p>
                    </div>
                    <div className="list-card__stat">
                      <p className="list-card__label">Hire plan</p>
                      <p className="list-card__value">
                        {DURATION_LABELS[booking.durationCode] ||
                          toStatusLabel(booking.durationCode)}
                      </p>
                    </div>
                    <div className="list-card__stat">
                      <p className="list-card__label">Total price</p>
                      <p className="list-card__value">
                        {formatCurrency(booking.totalPrice)}
                      </p>
                    </div>
                    <div className="list-card__stat">
                      <p className="list-card__label">Created at</p>
                      <p className="list-card__value">
                        {formatDateTime(booking.createdAt)}
                      </p>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="list-card__actions">
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => handleCancel(booking.bookingId)}
                        disabled={isThisCancelling || !!cancellingId}
                      >
                        {isThisCancelling ? 'Cancelling...' : 'Cancel Booking'}
                      </button>

                      {canExtend && !isThisExtending ? (
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() =>
                            openExtend(booking.bookingId, booking.durationCode)
                          }
                        >
                          Extend
                        </button>
                      ) : null}

                      {isThisExtending ? (
                        <div className="list-card__extend">
                          <label className="list-card__extend-label">
                            Extend to:
                            <select
                              className="input"
                              value={extendDuration}
                              onChange={(e) =>
                                setExtendDuration(e.target.value)
                              }
                            >
                              {longerDurations(booking.durationCode).map(
                                (dc) => (
                                  <option key={dc} value={dc}>
                                    {DURATION_LABELS[dc] || dc}
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() =>
                              handleExtendSubmit(booking.bookingId)
                            }
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={closeExtend}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
