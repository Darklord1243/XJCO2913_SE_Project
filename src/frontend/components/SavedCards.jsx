import { useCallback, useEffect, useState } from 'react';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';

const CARDS_ENDPOINT = 'http://127.0.0.1:3000/api/cards';
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
      await requestJson(CARDS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setMessage({ text: 'Card saved.', state: 'success' });
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
      <section className="saved-cards-view">
        <article className="panel">
          <p className="empty-state">Loading saved cards...</p>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="saved-cards-view">
        <article className="panel">
          <p className="message" role="alert">
            {error}
          </p>
          <button type="button" className="secondary" onClick={fetchCards}>
            Retry
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="saved-cards-view">
      <article className="panel" data-id="ID2">
        <div className="panel-header">
          <h2>Your saved cards</h2>
        </div>

        {cards.length === 0 ? (
          <p className="empty-state">No saved cards yet.</p>
        ) : (
          <ul className="saved-cards-list" role="list">
            {cards.map((card) => (
              <li key={card.id} className="saved-card-item">
                <span className="saved-card-info">
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
                  className="secondary"
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

      <article className="panel" data-id="ID2">
        <div className="panel-header">
          <h2>Add a new card</h2>
        </div>

        {SHOW_SIMULATOR ? (
          <div className="booking-summary-card">
            <p className="summary-label">Payment simulator (dev only)</p>
            <p className="payment-note">
              Use <strong>4242 4242 4242 4242</strong> for a valid card.
            </p>
            <p className="payment-note">
              Use <strong>4000 0000 0000 0002</strong> for a declined card.
            </p>
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleAddCard}>
          <label htmlFor="saved-card-name">
            Cardholder name
            <input
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
          </label>

          <label htmlFor="saved-card-number">
            Card number
            <input
              id="saved-card-number"
              name="cardNumber"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={19}
              placeholder="4242 4242 4242 4242"
              value={form.cardNumber}
              onChange={(e) => handleFormChange('cardNumber', e.target.value)}
              required
            />
          </label>

          <div className="payment-grid">
            <label htmlFor="saved-card-expiry">
              Expiry date
              <input
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
            </label>

            <label htmlFor="saved-card-cvv">
              CVV
              <input
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
            </label>
          </div>

          <p
            className="message"
            data-state={message.state || undefined}
            aria-live="polite"
          >
            {message.text}
          </p>

          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save card'}
          </button>
        </form>
      </article>
    </section>
  );
}
