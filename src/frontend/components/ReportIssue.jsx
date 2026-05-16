import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useScooters } from '../hooks/useScooters';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';

import { apiUrl } from '../utils/apiBase';

const API_BASE = apiUrl('/api');

export default function ReportIssue({ session }) {
  const { scooters, isLoading, error, refetchScooters } = useScooters();
  const [scooterId, setScooterId] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ text: '', state: '' });
  const [createdIssue, setCreatedIssue] = useState(null);

  const token = getSessionToken(session);

  function resetForm() {
    setScooterId('');
    setDescription('');
    setFormMessage({ text: '', state: '' });
    setCreatedIssue(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!token) {
      setFormMessage({
        text: 'You must be signed in to report an issue.',
        state: 'error',
      });
      return;
    }

    const trimmedScooterId = (scooterId || '').trim();
    const trimmedDescription = (description || '').trim();

    if (!trimmedScooterId) {
      setFormMessage({
        text: 'Please select a scooter.',
        state: 'error',
      });
      return;
    }

    if (!trimmedDescription) {
      setFormMessage({
        text: 'Please describe the issue.',
        state: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    setFormMessage({ text: '', state: '' });

    try {
      const result = await requestJson(`${API_BASE}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scooterId: trimmedScooterId,
          description: trimmedDescription,
        }),
      });

      setCreatedIssue(result.data);
      setScooterId('');
      setDescription('');
      setFormMessage({ text: '', state: '' });
    } catch (submitError) {
      console.error('Failed to submit issue report:', submitError);
      setFormMessage({
        text: submitError?.message || 'Failed to submit issue report.',
        state: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <section className="bookings-page">
        <article className="page-card page-card--accent page-card--wide">
          <div className="page-header">
            <h2 className="page-title">Report a problem</h2>
          </div>
          <p className="page-empty">
            Sign in to report an issue with a scooter.
          </p>
        </article>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="bookings-page">
        <article className="page-card page-card--accent page-card--wide">
          <div className="page-header">
            <h2 className="page-title">Report a problem</h2>
          </div>
          <div className="skeleton-stack">
            <div className="skeleton skeleton--title" aria-hidden="true" />
            <div className="skeleton skeleton--text" aria-hidden="true" />
            <div className="skeleton skeleton--text" aria-hidden="true" />
            <div className="skeleton skeleton--row" aria-hidden="true" />
          </div>
          <span className="sr-only">Loading scooter list</span>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bookings-page">
        <article className="page-card page-card--accent page-card--wide">
          <div className="page-header">
            <h2 className="page-title">Report a problem</h2>
          </div>
          <div className="alert alert--error" role="alert">
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

  return (
    <section className="bookings-page">
      <article className="page-card page-card--accent page-card--wide">
        <div className="page-header">
          <h2 className="page-title">Report a problem</h2>
        </div>

        {createdIssue ? (
          <div className="page-success" role="status" aria-live="polite">
            <h3 className="page-success__title">Issue reported</h3>
            <div className="page-success__grid">
              <div className="list-card__stat">
                <p className="list-card__label">Issue ID</p>
                <p className="list-card__value">{createdIssue.id}</p>
              </div>
              <div className="list-card__stat">
                <p className="list-card__label">Scooter</p>
                <p className="list-card__value">{createdIssue.scooterId}</p>
              </div>
              <div className="list-card__stat">
                <p className="list-card__label">Status</p>
                <p className="list-card__value">{createdIssue.status}</p>
              </div>
              <div className="list-card__stat">
                <p className="list-card__label">Priority</p>
                <p className="list-card__value">{createdIssue.priority}</p>
              </div>
            </div>
            <p className="page-success__note">
              Your report has been submitted. Staff will review it shortly.
            </p>
            <div className="page-success__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={resetForm}
              >
                Report another issue
              </button>
            </div>
          </div>
        ) : (
          <>
            {scooters.length === 0 ? (
              <div className="page-empty-state">
                <AlertCircle size={48} className="page-empty-state__icon" />
                <p className="page-empty-state__title">No scooters available</p>
                <p className="page-empty-state__sub">
                  No scooters are available to report at this time.
                </p>
              </div>
            ) : (
              <form className="page-form" onSubmit={handleSubmit}>
                <div className="field">
                  <label className="field__label" htmlFor="report-scooter-id">
                    Scooter
                  </label>
                  <select
                    className="input"
                    id="report-scooter-id"
                    value={scooterId}
                    onChange={(e) => setScooterId(e.target.value)}
                    required
                  >
                    <option value="">Select a scooter...</option>
                    {scooters.map((scooter) => (
                      <option key={scooter.scooterId} value={scooter.scooterId}>
                        {scooter.scooterId}
                        {scooter.location?.description
                          ? ` — ${scooter.location.description}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="report-description">
                    Description
                  </label>
                  <textarea
                    className="input"
                    id="report-description"
                    rows={4}
                    placeholder="Describe the issue with the scooter..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                {formMessage.text ? (
                  <div
                    className={`alert ${formMessage.state === 'error' ? 'alert--error' : 'alert--success'}`}
                    role="alert"
                    aria-live="polite"
                  >
                    {formMessage.text}
                  </div>
                ) : null}

                <div className="page-form__actions">
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit report'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </article>
    </section>
  );
}
