import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Lock, MapPin, X } from 'lucide-react';
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
  const [savedCards, setSavedCards] = useState([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('manual'); // 'manual' | 'saved'
  const bookingTriggerRef = useRef(null);
  const modalRef = useRef(null);

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

  useEffect(() => {
    if (!isBookingModalOpen) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isBooking) {
        event.preventDefault();
        closeBookingModal();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBookingModalOpen, isBooking]);

  useEffect(() => {
    if (!isBookingModalOpen || !modalRef.current) {
      return;
    }

    const focusable = modalRef.current.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus();
    }
  }, [isBookingModalOpen, bookingScooterId]);

  async function openBookingModal(scooterId, triggerElement) {
    if (!isSignedIn) {
      return;
    }

    if (triggerElement instanceof HTMLElement) {
      bookingTriggerRef.current = triggerElement;
    }

    setSelectedScooterId(scooterId);
    setBookingScooterId(scooterId);
    setSelectedDurationCode('oneHour');
    setPaymentForm(defaultPaymentForm);
    setBookingMessage({ text: '', state: '' });
    setIsBookingModalOpen(true);

    let cards = [];
    if (sessionToken) {
      try {
        const result = await requestJson('http://127.0.0.1:3000/api/cards', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        cards = result.data || [];
        setSavedCards(cards);
      } catch (_) {
        setSavedCards([]);
      }
    }

    if (cards.length > 0) {
      setSelectedSavedCardId(cards[0].id);
      setPaymentMode('saved');
    } else {
      setSelectedSavedCardId(null);
      setPaymentMode('manual');
    }
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

    const trigger = bookingTriggerRef.current;
    bookingTriggerRef.current = null;
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
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
      const body = {
        scooterId: bookingScooter.scooterId,
        durationCode: selectedDurationCode,
      };

      if (paymentMode === 'saved' && selectedSavedCardId) {
        body.savedCardId = selectedSavedCardId;
      } else {
        body.payment = paymentForm;
      }

      const result = await requestJson(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
      <section className="fleet-page" aria-live="polite">
        <article className="fleet-card fleet-card--accent fleet-summary-panel">
          <div className="skeleton-grid">
            <div className="skeleton skeleton--card" aria-hidden="true" />
            <div className="skeleton skeleton--card" aria-hidden="true" />
            <div className="skeleton skeleton--card" aria-hidden="true" />
            <div className="skeleton skeleton--card" aria-hidden="true" />
          </div>
          <span className="sr-only">Loading scooters</span>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="fleet-page">
        <article className="fleet-card fleet-card--accent fleet-summary-panel" data-id="ID4">
          <div className="fleet-card__header">
            <h2 className="fleet-card__title">View hire options and cost</h2>
          </div>
          <div
            id="pricing-message"
            className="alert alert--error"
            role="alert"
            aria-live="polite"
          >
            Could not load scooters: {error}
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={refetchScooters}
          >
            Retry
          </button>
        </article>
      </section>
    );
  }

  if (scooters.length === 0) {
    return (
      <section className="fleet-page">
        <article className="fleet-card fleet-card--accent fleet-summary-panel" data-id="ID4-ID17">
          <div className="fleet-card__header">
            <h2 className="fleet-card__title">Pricing and fleet availability</h2>
          </div>
          <div className="page-empty-state">
            <MapPin size={48} className="page-empty-state__icon" aria-hidden="true" />
            <p className="page-empty-state__title">No scooters available</p>
            <p className="page-empty-state__sub">
              No scooters are configured for hire pricing yet.
            </p>
          </div>
        </article>
      </section>
    );
  }

  const availableCount = scooters.filter(
    (scooter) => scooter.status === 'available'
  ).length;

  return (
    <section className="fleet-page">
      <article className="fleet-card fleet-card--accent fleet-summary-panel" data-id="ID4">
        <div className="fleet-card__header">
          <h2 className="fleet-card__title">View hire options and cost</h2>
        </div>
        <div className="fleet-summary">
          <div className="fleet-stat">
            <p className="fleet-stat__label">Selected scooter</p>
            <p className="fleet-stat__value">{selectedScooter?.scooterId}</p>
          </div>
          <div className="fleet-stat">
            <p className="fleet-stat__label">Location</p>
            <p className="fleet-stat__value">
              {selectedScooter?.location?.description || 'Unknown'}
            </p>
          </div>
          <div className="fleet-stat">
            <p className="fleet-stat__label">Availability</p>
            <p className="fleet-stat__value">
              {toStatusLabel(selectedScooter?.status || 'unavailable')}
            </p>
          </div>
          <div className="fleet-stat">
            <p className="fleet-stat__label">Fleet ready now</p>
            <p className="fleet-stat__value">
              {availableCount} of {scooters.length} scooters available
            </p>
          </div>
        </div>
        {bookingResult ? (
          <div
            className="fleet-confirmation"
            role="status"
            aria-live="polite"
            data-id="ID5"
          >
            <h3 className="fleet-confirmation__title">Booking confirmed</h3>
            <div className="fleet-confirmation__grid">
              <div className="fleet-stat">
                <p className="fleet-stat__label">Booking ID</p>
                <p className="fleet-stat__value">{bookingResult.bookingId}</p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Scooter</p>
                <p className="fleet-stat__value">{bookingResult.scooterId}</p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Hire plan</p>
                <p className="fleet-stat__value">
                  {toStatusLabel(bookingResult.durationCode)}
                </p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Total price</p>
                <p className="fleet-stat__value">
                  {formatCurrency(bookingResult.totalPrice)}
                </p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Created at</p>
                <p className="fleet-stat__value">
                  {formatConfirmationTime(bookingResult.createdAt)}
                </p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Booking status</p>
                <p className="fleet-stat__value">
                  {toStatusLabel(bookingResult.status)}
                </p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Scooter status</p>
                <p className="fleet-stat__value">
                  {toStatusLabel(bookingResult.scooterStatus)}
                </p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Payment</p>
                <p className="fleet-stat__value">
                  {toStatusLabel(bookingResult.paymentStatus)}
                </p>
              </div>
              <div className="fleet-stat">
                <p className="fleet-stat__label">Reference</p>
                <p className="fleet-stat__value">
                  {bookingResult.paymentReference}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </article>

      <section className="fleet-layout">
        <article className="fleet-card">
          <div className="fleet-card__header">
            <p className="fleet-card__kicker">Scooters</p>
            <h2 className="fleet-card__title">Choose a vehicle</h2>
          </div>
          <div className="fleet-grid" role="list" aria-live="polite">
            {scooters.map((scooter) => (
              <article
                key={scooter.scooterId}
                className={`scooter-card${
                  selectedScooter?.scooterId === scooter.scooterId
                    ? ' is-selected'
                    : ''
                }`}
                role="listitem"
              >
                <div className="scooter-card__header">
                  <span className="scooter-card__id">{scooter.scooterId}</span>
                  <span
                    className={`status-pill status-pill--${scooter.status}`}
                  >
                    {toStatusLabel(scooter.status)}
                  </span>
                </div>
                <p className="scooter-card__location">
                  <MapPin size={16} className="scooter-card__location-icon" aria-hidden="true" />
                  {scooter.location?.description || 'Unknown'}
                </p>
                <p className="scooter-card__rate">
                  Starts at {formatCurrency(scooter.pricing?.oneHour ?? 0)} per
                  hour
                </p>
                <div className="scooter-card__actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setSelectedScooterId(scooter.scooterId)}
                  >
                    {selectedScooter?.scooterId === scooter.scooterId
                      ? 'Selected'
                      : 'Select'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={(event) => openBookingModal(scooter.scooterId, event.currentTarget)}
                    disabled={!isSignedIn || scooter.status !== 'available'}
                    aria-haspopup="dialog"
                    aria-expanded={
                      isBookingModalOpen &&
                      bookingScooterId === scooter.scooterId
                    }
                    aria-label={`Book scooter ${scooter.scooterId}`}
                  >
                    Book now
                  </button>
                </div>
                <p className="scooter-card__hint">
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

        <article className="fleet-card">
          <div className="fleet-card__header">
            <p className="fleet-card__kicker">Pricing</p>
            <h2 className="fleet-card__title">Hire plans</h2>
          </div>
          <div className="fleet-plans" role="list" aria-live="polite">
            {hirePlanConfig.map((plan) => {
              const planPrice = selectedScooter?.pricing?.[plan.key] ?? 0;
              return (
                <article key={plan.key} className="fleet-plan-card">
                  <h3 className="fleet-plan-card__title">{plan.title}</h3>
                  <p className="fleet-plan-card__price">{formatCurrency(planPrice)}</p>
                  <p className="fleet-plan-card__meta">
                    {plan.durationHours === 1
                      ? 'Flexible pay-as-you-go rate'
                      : `${formatCurrency(
                          planPrice / plan.durationHours
                        )} average per hour`}
                  </p>
                  <p className="fleet-plan-card__note">{plan.description}</p>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      <section className="fleet-overview-section">
        <article className="fleet-card fleet-card--accent" data-id="ID17">
          <div className="fleet-card__header">
            <h2 className="fleet-card__title">Fleet availability overview</h2>
          </div>
          <div className="fleet-overview" role="list" aria-live="polite">
            {availabilityCounts.map((entry) => (
              <div
                key={entry.key}
                className={`fleet-overview__stat fleet-overview__stat--${entry.key}`}
              >
                <p className="fleet-stat__label">{entry.label}</p>
                <p className="fleet-stat__value">
                  {entry.count} scooter{entry.count === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      {isBookingModalOpen && bookingScooter ? (
        <div className="modal-overlay">
          <div
            ref={modalRef}
            id="booking-modal"
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-dialog-title"
            data-id="ID5"
          >
            <div className="modal__header">
              <h2 id="booking-dialog-title" className="modal__title">Confirm your booking</h2>
              <button
                type="button"
                className="modal__close"
                onClick={closeBookingModal}
                disabled={isBooking}
                aria-label="Close booking dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="modal__body">
              <div className="fleet-modal__summary">
                <p className="fleet-modal__label">Scooter</p>
                <p className="fleet-modal__value">{bookingScooter.scooterId}</p>
                <p className="fleet-modal__meta">
                  {bookingScooter.location?.description || 'Unknown location'} &bull;{' '}
                  {toStatusLabel(bookingScooter.status)}
                </p>
              </div>

              <form className="fleet-modal__form" onSubmit={handleBookingSubmit}>
                <fieldset className="plan-grid">
                  <legend>Choose a hire duration</legend>
                  {hirePlanConfig.map((plan) => (
                    <label
                      key={plan.key}
                      className={`plan-option${
                        selectedDurationCode === plan.key ? ' is-selected' : ''
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

                <div className="fleet-modal__summary">
                  <p className="fleet-modal__label">Selected plan</p>
                  <p className="fleet-modal__value">{selectedPlan.title}</p>
                  <p className="fleet-modal__meta">
                    Total to confirm now: {formatCurrency(bookingTotal)}
                  </p>
                </div>

                {isSignedIn ? (
                  <p className="fleet-modal__payment-note">
                    Payments are simulated for this coursework build (no real
                    charge).
                    {session?.user?.userType === 'student' ||
                    session?.user?.userType === 'senior'
                      ? ' Your account type qualifies for a 20% discount applied at checkout.'
                      : " Students and seniors receive 20% off (selected at registration). Frequent riders (8+ hire hours in 7 days) also receive 20% off."}{' '}
                    Price shown is the plan rate; final total is confirmed by the
                    server.
                  </p>
                ) : null}

                {savedCards.length > 0 ? (
                  <fieldset className="plan-grid">
                    <legend>Payment method</legend>
                    <label
                      className={`plan-option${paymentMode === 'saved' ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="paymentMode"
                        value="saved"
                        checked={paymentMode === 'saved'}
                        onChange={() => setPaymentMode('saved')}
                      />
                      <span className="plan-option__body">
                        <span className="plan-option__top">
                          <strong>
                            <CreditCard size={16} aria-hidden="true" />
                            {' '}Use a saved card
                          </strong>
                        </span>
                      </span>
                    </label>
                    <label
                      className={`plan-option${paymentMode === 'manual' ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="paymentMode"
                        value="manual"
                        checked={paymentMode === 'manual'}
                        onChange={() => setPaymentMode('manual')}
                      />
                      <span className="plan-option__body">
                        <span className="plan-option__top">
                          <strong>Enter new card details</strong>
                        </span>
                      </span>
                    </label>

                    {paymentMode === 'saved' ? (
                      <div className="saved-card-picker">
                        {savedCards.map((card) => (
                          <label
                            key={card.id}
                            className={`plan-option${selectedSavedCardId === card.id ? ' is-selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="savedCardId"
                              value={card.id}
                              checked={selectedSavedCardId === card.id}
                              onChange={() => setSelectedSavedCardId(card.id)}
                            />
                            <span className="plan-option__body">
                              <span className="plan-option__top">
                                <strong>
                                  {card.cardBrand || 'Card'} ending in{' '}
                                  {card.cardLast4}
                                </strong>
                                {card.isDefault ? (
                                  <span className="status-pill status-pill--available">
                                    Default
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </fieldset>
                ) : null}

                {paymentMode === 'manual' ? (
                  <>
                    {SHOW_PAYMENT_SIMULATOR ? (
                      <div className="fleet-modal__summary">
                        <p className="fleet-modal__label">
                          Test card numbers (development only)
                        </p>
                        <p className="fleet-modal__payment-note">
                          Use <strong>4242 4242 4242 4242</strong> to simulate a
                          successful payment.
                        </p>
                        <p className="fleet-modal__payment-note">
                          Use <strong>4000 0000 0000 0002</strong> to simulate a
                          declined payment.
                        </p>
                      </div>
                    ) : null}

                    <p className="fleet-modal__payment-heading">
                      <Lock size={16} aria-hidden="true" />
                      Card details
                    </p>

                    <div className="field">
                      <label className="field__label" htmlFor="payment-cardholder-name">Cardholder name</label>
                      <input
                        id="payment-cardholder-name"
                        name="cardholderName"
                        type="text"
                        className="input"
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
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="payment-card-number">Card number</label>
                      <input
                        id="payment-card-number"
                        name="cardNumber"
                        type="text"
                        className="input"
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
                    </div>

                    <div className="fleet-modal__payment-row">
                      <div className="field">
                        <label className="field__label" htmlFor="payment-expiry-date">Expiry date</label>
                        <input
                          id="payment-expiry-date"
                          name="expiryDate"
                          type="text"
                          className="input"
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
                      </div>

                      <div className="field">
                        <label className="field__label" htmlFor="payment-cvv">CVV</label>
                        <input
                          id="payment-cvv"
                          name="cvv"
                          type="text"
                          className="input"
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
                      </div>
                    </div>
                  </>
                ) : null}

                {bookingMessage.text ? (
                  <div
                    className={`alert${bookingMessage.state === 'error' ? ' alert--error' : ''}`}
                    role="alert"
                    aria-live="polite"
                  >
                    {bookingMessage.text}
                  </div>
                ) : null}

                <div className="modal__footer">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={closeBookingModal}
                    disabled={isBooking}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={
                      isBooking ||
                      (paymentMode === 'saved' && !selectedSavedCardId)
                    }
                  >
                    {isBooking ? 'Confirming...' : 'Confirm booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
