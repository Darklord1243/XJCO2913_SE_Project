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

  if (!token) {
    return (
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Bookings overview</h2>
          </div>
          <p className="empty-state">
            Sign in as an administrator to review platform bookings.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="my-bookings-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header">
          <p className="panel-kicker">Admin</p>
          <h2>Bookings overview</h2>
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
    </section>
  );
}
