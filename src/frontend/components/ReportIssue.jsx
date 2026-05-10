import { useState } from 'react';
import { useScooters } from '../hooks/useScooters';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';

const API_BASE = 'http://127.0.0.1:3000/api';

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
      <section className="report-issue-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Report a problem</h2>
          </div>
          <p className="empty-state">
            Sign in to report an issue with a scooter.
          </p>
        </article>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="report-issue-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Report a problem</h2>
          </div>
          <p className="empty-state">Loading scooter list...</p>
        </article>
      </section>
    );
  }

  if (error) {
    return (
      <section className="report-issue-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Report a problem</h2>
          </div>
          <p className="message" data-state="error" role="alert">
            Could not load scooters: {error}
          </p>
          <button type="button" className="secondary" onClick={refetchScooters}>
            Retry
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="report-issue-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header">
          <h2>Report a problem</h2>
        </div>

        {createdIssue ? (
          <div
            className="booking-confirmation"
            role="status"
            aria-live="polite"
          >
            <div className="panel-header">
              <h3>Issue reported</h3>
            </div>
            <div className="booking-confirmation__grid">
              <div className="summary-card">
                <p className="summary-label">Issue ID</p>
                <p className="summary-value">{createdIssue.id}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">Scooter</p>
                <p className="summary-value">{createdIssue.scooterId}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">Status</p>
                <p className="summary-value">{createdIssue.status}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">Priority</p>
                <p className="summary-value">{createdIssue.priority}</p>
              </div>
            </div>
            <p className="hire-note" style={{ marginTop: '0.75rem' }}>
              Your report has been submitted. Staff will review it shortly.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <button type="button" onClick={resetForm}>
                Report another issue
              </button>
            </div>
          </div>
        ) : (
          <>
            {scooters.length === 0 ? (
              <p className="empty-state">
                No scooters are available to report at this time.
              </p>
            ) : (
              <form className="form-grid" onSubmit={handleSubmit}>
                <label htmlFor="report-scooter-id">
                  Scooter
                  <select
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
                </label>

                <label htmlFor="report-description">
                  Description
                  <textarea
                    id="report-description"
                    rows={4}
                    placeholder="Describe the issue with the scooter..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </label>

                {formMessage.text ? (
                  <p
                    className="message"
                    data-state={formMessage.state || undefined}
                    role="alert"
                    aria-live="polite"
                  >
                    {formMessage.text}
                  </p>
                ) : null}

                <div className="form-actions">
                  <button type="submit" disabled={isSubmitting}>
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
