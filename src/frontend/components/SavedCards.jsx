import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Lock } from 'lucide-react';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { apiUrl } from '../utils/apiBase';

const CARDS_ENDPOINT = apiUrl('/api/cards');
const SHOW_SIMULATOR = Boolean(import.meta.env?.DEV);

const emptyForm = {
  cardholderName: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
};

export default function SavedCards({ session }) {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', state: '' });
  const [deletingId, setDeletingId] = useState(null);

  const token = getSessionToken(session);

  const fetchCards = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await requestJson(CARDS_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCards(result.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load saved cards.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddCard(event) {
    event.preventDefault();
    if (!token) return;

    setIsSaving(true);
    setMessage({ text: '', state: '' });

    try {
      const result = await requestJson(CARDS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      const successText = result.warning
        ? `Card saved. ${result.warning}`
        : 'Card saved.';
      setMessage({
        text: successText,
        state: result.warning ? 'error' : 'success',
      });
      await fetchCards();
    } catch (err) {
      setMessage({
        text: err.message || 'Failed to save card.',
        state: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(cardId) {
    if (!token) return;
    setDeletingId(cardId);

    try {
      await requestJson(`${CARDS_ENDPOINT}/${cardId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCards();
    } catch (err) {
      setMessage({
        text: err.message || 'Failed to remove card.',
        state: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <section className="bookings-page">
        <article className="page-card">
          <div className="skeleton-stack">
            <div className="skeleton skeleton--row" aria-hidden="true" />
            <div className="skeleton skeleton--row" aria-hidden="true" />
          </div>
          <span className="sr-only">Loading saved cards</span>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bookings-page">
        <article className="page-card">
          <div className="alert alert--error" role="alert">
            {error}
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={fetchCards}
          >
            Retry
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="bookings-page">
      <article className="page-card" data-id="ID2">
        <div className="page-header">
          <h2 className="page-title">Your saved cards</h2>
          <p className="page-subtitle">
            We store only the card brand and last four digits. Full card numbers
            and CVV are never kept on our servers.
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="page-empty-state">
            <CreditCard size={48} className="page-empty-state__icon" />
            <p className="page-empty-state__title">No saved cards</p>
            <p className="page-empty-state__sub">
              Add a card below to speed up checkout on the Fleet page.
            </p>
          </div>
        ) : (
          <ul className="list-stack" role="list">
            {cards.map((card) => (
              <li key={card.id} className="list-card list-card--row">
                <span className="list-card__info">
                  <strong>{card.cardBrand || 'Card'}</strong> ending in{' '}
                  {card.cardLast4}
                  {card.isDefault ? (
                    <span className="status-pill status-pill--available">
                      Default
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => handleDelete(card.id)}
                  disabled={deletingId === card.id}
                >
                  {deletingId === card.id ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="page-card" data-id="ID2">
        <div className="page-header">
          <h2 className="page-title">Add a new card</h2>
        </div>

        <aside className="card-simulator-callout" role="note">
          <p className="card-simulator-callout__title">
            Coursework payment simulator
          </p>
          <p className="card-simulator-callout__lead">
            Only these test card numbers work when you book a scooter:
          </p>
          <ul className="card-simulator-callout__list">
            <li>
              <code>4242 4242 4242 4242</code>
              <span>Payment succeeds</span>
            </li>
            <li>
              <code>4000 0000 0000 0002</code>
              <span>Payment declined</span>
            </li>
          </ul>
          <p className="card-simulator-callout__footer">
            You may save other card numbers, but they cannot be charged in this
            build.
          </p>
        </aside>

        {SHOW_SIMULATOR ? (
          <details className="page-simulator">
            <summary className="page-simulator__label">
              Testing help (development only)
            </summary>
            <p className="page-simulator__note">
              Use <strong>4242 4242 4242 4242</strong> for a valid card.
            </p>
            <p className="page-simulator__note">
              Use <strong>4000 0000 0000 0002</strong> for a declined card.
            </p>
          </details>
        ) : null}

        <form className="page-form" onSubmit={handleAddCard}>
          <p className="page-simulator__label">
            <Lock size={16} aria-hidden="true" /> Card details
          </p>

          <div className="field">
            <label className="field__label" htmlFor="saved-card-name">
              Cardholder name
            </label>
            <input
              className="input"
              id="saved-card-name"
              name="cardholderName"
              type="text"
              autoComplete="cc-name"
              value={form.cardholderName}
              onChange={(e) =>
                handleFormChange('cardholderName', e.target.value)
              }
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="saved-card-number">
              Card number
            </label>
            <input
              className="input"
              id="saved-card-number"
              name="cardNumber"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={19}
              placeholder="16 digits"
              value={form.cardNumber}
              onChange={(e) => handleFormChange('cardNumber', e.target.value)}
              required
            />
          </div>

          <div className="page-form__row">
            <div className="field">
              <label className="field__label" htmlFor="saved-card-expiry">
                Expiry date
              </label>
              <input
                className="input"
                id="saved-card-expiry"
                name="expiryDate"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={5}
                placeholder="MM/YY"
                value={form.expiryDate}
                onChange={(e) => handleFormChange('expiryDate', e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="saved-card-cvv">
                CVV
              </label>
              <input
                className="input"
                id="saved-card-cvv"
                name="cvv"
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
                placeholder="123"
                value={form.cvv}
                onChange={(e) => handleFormChange('cvv', e.target.value)}
                required
              />
            </div>
          </div>

          {message.text ? (
            <div
              className={`alert ${message.state === 'error' ? 'alert--error' : 'alert--success'}`}
              aria-live="polite"
            >
              {message.text}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save card'}
          </button>
        </form>
      </article>
    </section>
  );
}
