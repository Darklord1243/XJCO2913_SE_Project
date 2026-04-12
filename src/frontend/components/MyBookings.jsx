import { useBookings } from '../hooks/useBookings';
import { getSessionToken } from '../session';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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

export default function MyBookings({ session, refreshKey }) {
  const { bookings, isLoading, error, refetchBookings } = useBookings(
    session,
    refreshKey
  );

  if (!getSessionToken(session)) {
    return (
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <p className="panel-kicker">ID8</p>
            <h2>My bookings</h2>
          </div>
          <p className="empty-state">
            Sign in to view booking history and active hire records.
          </p>
        </article>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <p className="panel-kicker">ID8</p>
            <h2>My bookings</h2>
          </div>
          <p className="empty-state">Loading booking history...</p>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <p className="panel-kicker">ID8</p>
            <h2>My bookings</h2>
          </div>
          <p className="message" data-state="error" role="alert">
            Could not load bookings: {error}
          </p>
          <button type="button" className="secondary" onClick={refetchBookings}>
            Retry
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="my-bookings-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header">
          <p className="panel-kicker">ID8</p>
          <h2>My bookings</h2>
        </div>

        {bookings.length === 0 ? (
          <p className="empty-state">
            No bookings yet. Your successful bookings will appear here.
          </p>
        ) : (
          <div className="booking-history" role="list" aria-live="polite">
            {bookings.map((booking) => (
              <article
                key={booking.bookingId}
                className="booking-history__item"
                role="listitem"
              >
                <div className="booking-history__header">
                  <div>
                    <p className="summary-label">Booking ID</p>
                    <p className="summary-value">{booking.bookingId}</p>
                  </div>
                  <span
                    className={`status-pill status-pill--${booking.status}`}
                  >
                    {toStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="booking-history__grid">
                  <div className="summary-card">
                    <p className="summary-label">Scooter</p>
                    <p className="summary-value">{booking.scooterId}</p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Hire plan</p>
                    <p className="summary-value">
                      {toStatusLabel(booking.durationCode)}
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Total price</p>
                    <p className="summary-value">
                      {formatCurrency(booking.totalPrice)}
                    </p>
                  </div>
                  <div className="summary-card">
                    <p className="summary-label">Created at</p>
                    <p className="summary-value">
                      {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
