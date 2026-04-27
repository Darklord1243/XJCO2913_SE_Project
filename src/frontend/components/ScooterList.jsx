import { useEffect, useMemo, useState } from 'react';
import { useScooters } from '../hooks/useScooters';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const BOOKING_ENDPOINT = 'http://127.0.0.1:3000/api/bookings';
// Vite exposes `import.meta.env.DEV` as `true` only in the dev/test
// bundle. We use it to gate test-card simulator copy so production-style
// builds never render those instructions to real customers.
const SHOW_PAYMENT_SIMULATOR = Boolean(import.meta.env?.DEV);
const defaultPaymentForm = {
  cardholderName: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
};
const hirePlanConfig = [
  {
    key: 'oneHour',
    title: '1 hour',
    description: 'Quick journeys and pay-as-you-go trips.',
    durationHours: 1,
  },
  {
    key: 'fourHours',
    title: '4 hours',
    description: 'A flexible window for errands and city stops.',
    durationHours: 4,
  },
  {
    key: 'oneDay',
    title: '1 day',
    description: 'Full-day access for commuting or sightseeing.',
    durationHours: 24,
  },
  {
    key: 'oneWeek',
    title: '1 week',
    description: 'The lowest long-hire rate for repeat journeys.',
    durationHours: 168,
  },
];

function toStatusLabel(status) {
  return String(status || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatConfirmationTime(value) {
  if (!value) {
    return 'Not confirmed';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ScooterList({ session, onBookingCreated }) {
  const { scooters, isLoading, error, refetchScooters } = useScooters();
  const [selectedScooterId, setSelectedScooterId] = useState(null);
  const [bookingScooterId, setBookingScooterId] = useState(null);
  const [selectedDurationCode, setSelectedDurationCode] = useState('oneHour');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [bookingMessage, setBookingMessage] = useState({
    text: '',
    state: '',
  });
  const [bookingResult, setBookingResult] = useState(null);

  const selectedScooter = useMemo(() => {
    if (!Array.isArray(scooters) || scooters.length === 0) {
      return null;
    }

    const selected =
      scooters.find((scooter) => scooter.scooterId === selectedScooterId) ||
      null;

    if (selected) {
      return selected;
    }

    return (
      scooters.find((scooter) => scooter.status === 'available') || scooters[0]
    );
  }, [scooters, selectedScooterId]);

  const availabilityCounts = useMemo(() => {
    const config = [
      { key: 'available', label: 'Available' },
      { key: 'in_use', label: 'In Use' },
      { key: 'reserved', label: 'Reserved' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'offline', label: 'Offline' },
    ];

    return config.map((entry) => ({
      ...entry,
      count: scooters.filter((scooter) => scooter.status === entry.key).length,
    }));
  }, [scooters]);

  const bookingScooter = useMemo(
    () =>
      scooters.find((scooter) => scooter.scooterId === bookingScooterId) ||
      null,
    [bookingScooterId, scooters]
  );

  const selectedPlan = useMemo(
    () =>
      hirePlanConfig.find((plan) => plan.key === selectedDurationCode) ||
      hirePlanConfig[0],
    [selectedDurationCode]
  );

  const bookingTotal = bookingScooter?.pricing?.[selectedDurationCode] ?? 0;
  const sessionToken = getSessionToken(session);
  const isSignedIn = Boolean(sessionToken);

  useEffect(() => {
    if (!isSignedIn) {
      setIsBookingModalOpen(false);
      setBookingScooterId(null);
      setPaymentForm(defaultPaymentForm);
      setBookingMessage({ text: '', state: '' });
    }
  }, [isSignedIn]);

  function openBookingModal(scooterId) {
    if (!isSignedIn) {
      return;
    }

    setSelectedScooterId(scooterId);
    setBookingScooterId(scooterId);
    setSelectedDurationCode('oneHour');
    setPaymentForm(defaultPaymentForm);
    setBookingMessage({ text: '', state: '' });
    setIsBookingModalOpen(true);
  }

  function closeBookingModal() {
    if (isBooking) {
      return;
    }

    setIsBookingModalOpen(false);
    setBookingScooterId(null);
    setSelectedDurationCode('oneHour');
    setPaymentForm(defaultPaymentForm);
    setBookingMessage({ text: '', state: '' });
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();

    if (!bookingScooter || !sessionToken) {
      setBookingMessage({
        text: 'Sign in and select an available scooter to confirm a booking.',
        state: 'error',
      });
      return;
    }

    setIsBooking(true);
    setBookingMessage({ text: '', state: '' });

    try {
      const result = await requestJson(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scooterId: bookingScooter.scooterId,
          durationCode: selectedDurationCode,
          payment: paymentForm,
        }),
      });

      await refetchScooters();
      setBookingResult(result.data);
      setSelectedScooterId(result.data.scooterId);
      setIsBookingModalOpen(false);
      setBookingScooterId(null);
      setSelectedDurationCode('oneHour');
      setPaymentForm(defaultPaymentForm);
      setBookingMessage({ text: '', state: '' });
      onBookingCreated?.();
    } catch (bookingError) {
      console.error('Booking confirmation failed:', bookingError);
      setBookingMessage({
        text: bookingError?.message || 'Unable to confirm booking.',
        state: 'error',
      });
    } finally {
      setIsBooking(false);
    }
  }

  if (isLoading) {
    return (
      <section className="scooter-list-view" aria-live="polite">
        <section className="pricing-layout">
          <article className="panel panel-accent">
            <div className="pricing-summary">
              <div className="summary-card">
                <p className="summary-label">Status</p>
                <p className="summary-value">Loading pricing...</p>
              </div>
            </div>
          </article>
          <article className="panel">
            <p className="empty-state">Loading scooters...</p>
          </article>
        </section>
      </section>
    );
  }

  if (error) {
    return (
      <section className="scooter-list-view">
        <section className="pricing-layout">
          <article className="panel panel-accent" data-id="ID4">
            <div className="panel-header">
              <h2>View hire options and cost</h2>
            </div>
            <p
              id="pricing-message"
              className="message"
              role="alert"
              aria-live="polite"
            >
              Could not load scooters: {error}
            </p>
            <button
              type="button"
              className="secondary"
              onClick={refetchScooters}
            >
              Retry
            </button>
          </article>
        </section>
      </section>
    );
  }

  if (scooters.length === 0) {
    return (
      <section className="scooter-list-view">
        <section className="pricing-layout">
          <article className="panel panel-accent" data-id="ID4-ID17">
            <div className="panel-header">
              <h2>Pricing and fleet availability</h2>
            </div>
            <p className="empty-state">
              No scooters are configured for hire pricing yet.
            </p>
          </article>
        </section>
      </section>
    );
  }

  const availableCount = scooters.filter(
    (scooter) => scooter.status === 'available'
  ).length;

  return (
    <section className="scooter-list-view">
      <section className="pricing-layout">
        <article className="panel panel-accent" data-id="ID4">
          <div className="panel-header">
            <h2>View hire options and cost</h2>
          </div>
          <div className="pricing-summary">
            <div className="summary-card">
              <p className="summary-label">Selected scooter</p>
              <p className="summary-value">{selectedScooter?.scooterId}</p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Location</p>
              <p className="summary-value">
                {selectedScooter?.location?.description || 'Unknown'}
              </p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Availability</p>
              <p className="summary-value">
                {toStatusLabel(selectedScooter?.status || 'unavailable')}
              </p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Fleet ready now</p>
              <p className="summary-value">
                {availableCount} of {scooters.length} scooters available
              </p>
            </div>
          </div>
          {bookingResult ? (
            <div
              className="booking-confirmation"
              role="status"
              aria-live="polite"
              data-id="ID5"
            >
              <div className="panel-header">
                <h3>Booking confirmed</h3>
              </div>
              <div className="booking-confirmation__grid">
                <div className="summary-card">
                  <p className="summary-label">Booking ID</p>
                  <p className="summary-value">{bookingResult.bookingId}</p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Scooter</p>
                  <p className="summary-value">{bookingResult.scooterId}</p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Hire plan</p>
                  <p className="summary-value">
                    {toStatusLabel(bookingResult.durationCode)}
                  </p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Total price</p>
                  <p className="summary-value">
                    {formatCurrency(bookingResult.totalPrice)}
                  </p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Created at</p>
                  <p className="summary-value">
                    {formatConfirmationTime(bookingResult.createdAt)}
                  </p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Booking status</p>
                  <p className="summary-value">
                    {toStatusLabel(bookingResult.status)}
                  </p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Scooter status</p>
                  <p className="summary-value">
                    {toStatusLabel(bookingResult.scooterStatus)}
                  </p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Payment</p>
                  <p className="summary-value">
                    {toStatusLabel(bookingResult.paymentStatus)}
                  </p>
                </div>
                <div className="summary-card">
                  <p className="summary-label">Reference</p>
                  <p className="summary-value">
                    {bookingResult.paymentReference}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-header">
            <p className="panel-kicker">Scooters</p>
            <h2>Choose a vehicle</h2>
          </div>
          <div className="scooter-list" role="list" aria-live="polite">
            {scooters.map((scooter) => (
              <article
                key={scooter.scooterId}
                className={`scooter-option${
                  selectedScooter?.scooterId === scooter.scooterId
                    ? ' is-selected'
                    : ''
                }`}
                role="listitem"
              >
                <div className="scooter-option__top">
                  <strong>{scooter.scooterId}</strong>
                  <span
                    className={`status-pill status-pill--${scooter.status}`}
                  >
                    {toStatusLabel(scooter.status)}
                  </span>
                </div>
                <p className="scooter-option__location">
                  {scooter.location?.description || 'Unknown'}
                </p>
                <p className="scooter-option__rate">
                  Starts at {formatCurrency(scooter.pricing?.oneHour ?? 0)} per
                  hour
                </p>
                <div className="scooter-option__actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSelectedScooterId(scooter.scooterId)}
                  >
                    {selectedScooter?.scooterId === scooter.scooterId
                      ? 'Selected'
                      : 'Select'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openBookingModal(scooter.scooterId)}
                    disabled={!isSignedIn || scooter.status !== 'available'}
                  >
                    Book now
                  </button>
                </div>
                <p className="scooter-option__hint">
                  {!isSignedIn
                    ? 'Sign in to start a booking confirmation.'
                    : scooter.status !== 'available'
                      ? 'Booking opens again when this scooter returns to available.'
                      : 'Ready to confirm a booking from the current pricing plan.'}
                </p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <p className="panel-kicker">Pricing</p>
            <h2>Hire plans</h2>
          </div>
          <div className="hire-grid" role="list" aria-live="polite">
            {hirePlanConfig.map((plan) => {
              const planPrice = selectedScooter?.pricing?.[plan.key] ?? 0;
              return (
                <article key={plan.key} className="hire-card">
                  <h3>{plan.title}</h3>
                  <p className="hire-price">{formatCurrency(planPrice)}</p>
                  <p className="hire-meta">
                    {plan.durationHours === 1
                      ? 'Flexible pay-as-you-go rate'
                      : `${formatCurrency(
                          planPrice / plan.durationHours
                        )} average per hour`}
                  </p>
                  <p className="hire-note">{plan.description}</p>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      <section className="fleet-layout">
        <article className="panel panel-accent" data-id="ID17">
          <div className="panel-header">
            <h2>Fleet availability overview</h2>
          </div>
          <div className="availability-overview" role="list" aria-live="polite">
            {availabilityCounts.map((entry) => (
              <div
                key={entry.key}
                className={`summary-card summary-card--${entry.key}`}
              >
                <p className="summary-label">{entry.label}</p>
                <p className="summary-value">
                  {entry.count} scooter{entry.count === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      {isBookingModalOpen && bookingScooter ? (
        <div className="modal-backdrop">
          <div
            className="modal-window"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-dialog-title"
            data-id="ID5"
          >
            <div className="panel-header">
              <h2 id="booking-dialog-title">Confirm your booking</h2>
            </div>

            <div className="booking-summary-card">
              <p className="summary-label">Scooter</p>
              <p className="summary-value">{bookingScooter.scooterId}</p>
              <p className="hire-note">
                {bookingScooter.location?.description || 'Unknown location'} •{' '}
                {toStatusLabel(bookingScooter.status)}
              </p>
            </div>

            <form className="form-grid" onSubmit={handleBookingSubmit}>
              <fieldset className="plan-selector">
                <legend className="summary-label">
                  Choose a hire duration
                </legend>
                {hirePlanConfig.map((plan) => (
                  <label
                    key={plan.key}
                    className={`plan-option${
                      selectedDurationCode === plan.key ? ' is-active' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="durationCode"
                      value={plan.key}
                      checked={selectedDurationCode === plan.key}
                      onChange={(event) =>
                        setSelectedDurationCode(event.target.value)
                      }
                    />
                    <span className="plan-option__body">
                      <span className="plan-option__top">
                        <strong>{plan.title}</strong>
                        <span>
                          {formatCurrency(
                            bookingScooter.pricing?.[plan.key] ?? 0
                          )}
                        </span>
                      </span>
                      <span className="plan-option__description">
                        {plan.description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="booking-summary-card">
                <p className="summary-label">Selected plan</p>
                <p className="summary-value">{selectedPlan.title}</p>
                <p className="hire-note">
                  Total to confirm now: {formatCurrency(bookingTotal)}
                </p>
              </div>

              {SHOW_PAYMENT_SIMULATOR ? (
                <div className="booking-summary-card">
                  <p className="summary-label">Payment simulator (dev only)</p>
                  <p className="payment-note">
                    Use <strong>4242 4242 4242 4242</strong> to simulate a
                    successful payment.
                  </p>
                  <p className="payment-note">
                    Use <strong>4000 0000 0000 0002</strong> to simulate a
                    declined payment.
                  </p>
                </div>
              ) : null}

              <label htmlFor="payment-cardholder-name">
                Cardholder name
                <input
                  id="payment-cardholder-name"
                  name="cardholderName"
                  type="text"
                  autoComplete="cc-name"
                  value={paymentForm.cardholderName}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      cardholderName: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label htmlFor="payment-card-number">
                Card number
                <input
                  id="payment-card-number"
                  name="cardNumber"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={19}
                  placeholder="4242 4242 4242 4242"
                  value={paymentForm.cardNumber}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      cardNumber: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <div className="payment-grid">
                <label htmlFor="payment-expiry-date">
                  Expiry date
                  <input
                    id="payment-expiry-date"
                    name="expiryDate"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    maxLength={5}
                    placeholder="MM/YY"
                    value={paymentForm.expiryDate}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        expiryDate: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label htmlFor="payment-cvv">
                  CVV
                  <input
                    id="payment-cvv"
                    name="cvv"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    placeholder="123"
                    value={paymentForm.cvv}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        cvv: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <p
                className="message"
                data-state={bookingMessage.state || undefined}
                aria-live="polite"
              >
                {bookingMessage.text}
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeBookingModal}
                  disabled={isBooking}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isBooking}>
                  {isBooking ? 'Confirming...' : 'Confirm booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
