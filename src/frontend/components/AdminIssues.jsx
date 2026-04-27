import { useCallback, useEffect, useState } from 'react';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';

const API_BASE = 'http://127.0.0.1:3000/api';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

const PRIORITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
];

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
    console.error('AdminIssues: failed to format date', error);
    return 'Not available';
  }
}

function toStatusLabel(value) {
  return String(value || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AdminIssues({ session }) {
  const token = getSessionToken(session);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState({ text: '', state: '' });
  const [pendingId, setPendingId] = useState(null);

  const fetchIssues = useCallback(
    async (signal) => {
      if (!token) {
        setIssues([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();

      if (statusFilter) {
        params.set('status', statusFilter);
      }

      if (priorityFilter) {
        params.set('priority', priorityFilter);
      }

      const queryString = params.toString();
      const url = queryString
        ? `${API_BASE}/issues?${queryString}`
        : `${API_BASE}/issues`;

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
          throw new Error('Invalid API response contract for issues.');
        }

        setIssues(payload.data);
      } catch (fetchError) {
        if (fetchError?.name === 'AbortError') {
          return;
        }

        console.error('AdminIssues: failed to fetch issues', fetchError);
        setError(fetchError?.message || 'Failed to load issues.');
        setIssues([]);
      } finally {
        setIsLoading(false);
      }
    },
    [priorityFilter, statusFilter, token]
  );

  useEffect(() => {
    if (!token) {
      setIssues([]);
      return undefined;
    }

    const controller = new AbortController();
    fetchIssues(controller.signal);
    return () => controller.abort();
  }, [fetchIssues, token]);

  async function updateIssueField(issue, path, value) {
    if (!token || pendingId) {
      return;
    }

    setPendingId(`${issue.id}-${path}`);
    setActionMessage({ text: '', state: '' });

    try {
      await requestJson(`${API_BASE}/issues/${issue.id}/${path}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [path]: value }),
      });

      setActionMessage({
        text: `Issue #${issue.id} ${path} set to ${value}.`,
        state: 'success',
      });
      await fetchIssues();
    } catch (updateError) {
      console.error('AdminIssues: update failed', updateError);
      setActionMessage({
        text: updateError?.message || 'Failed to update issue.',
        state: 'error',
      });
    } finally {
      setPendingId(null);
    }
  }

  if (!token) {
    return (
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Issue management</h2>
          </div>
          <p className="empty-state">
            Sign in as staff or administrator to triage issues.
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
          <h2>Issue management</h2>
        </div>

        <div className="admin-filter-grid">
          <label htmlFor="admin-issues-status">
            Status
            <select
              id="admin-issues-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="admin-issues-priority">
            Priority
            <select
              id="admin-issues-priority"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              {PRIORITY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
            }}
          >
            Reset filters
          </button>
        </div>

        {actionMessage.text ? (
          <p
            className="message"
            data-state={actionMessage.state || undefined}
            role="status"
            aria-live="polite"
          >
            {actionMessage.text}
          </p>
        ) : null}

        {isLoading ? (
          <p className="empty-state">Loading issues...</p>
        ) : error ? (
          <p className="message" data-state="error" role="alert">
            {error}
          </p>
        ) : issues.length === 0 ? (
          <p className="empty-state">No issues match the current filters.</p>
        ) : (
          <div className="booking-history" role="list">
            {issues.map((issue) => {
              const isResolveBusy = pendingId === `${issue.id}-status`;
              const isPriorityBusy = pendingId === `${issue.id}-priority`;

              return (
                <article
                  key={issue.id}
                  className="booking-history__item"
                  role="listitem"
                >
                  <div className="booking-history__header">
                    <div>
                      <p className="summary-label">Issue</p>
                      <p className="summary-value">#{issue.id}</p>
                    </div>
                    <span
                      className={`status-pill status-pill--${issue.status}`}
                    >
                      {toStatusLabel(issue.status)}
                    </span>
                  </div>

                  <div className="booking-history__grid">
                    <div className="summary-card">
                      <p className="summary-label">Scooter</p>
                      <p className="summary-value">{issue.scooterId}</p>
                    </div>
                    <div className="summary-card">
                      <p className="summary-label">Reporter</p>
                      <p className="summary-value">User #{issue.userId}</p>
                    </div>
                    <div className="summary-card">
                      <p className="summary-label">Priority</p>
                      <p className="summary-value">
                        {toStatusLabel(issue.priority)}
                      </p>
                    </div>
                    <div className="summary-card">
                      <p className="summary-label">Reported</p>
                      <p className="summary-value">
                        {formatDateTime(issue.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="hire-note" style={{ marginTop: '0.75rem' }}>
                    {issue.description}
                  </p>

                  <div className="booking-actions">
                    {issue.priority === 'low' ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateIssueField(issue, 'priority', 'high')
                        }
                        disabled={isPriorityBusy || !!pendingId}
                      >
                        {isPriorityBusy ? 'Escalating...' : 'Escalate'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          updateIssueField(issue, 'priority', 'low')
                        }
                        disabled={isPriorityBusy || !!pendingId}
                      >
                        {isPriorityBusy ? 'Updating...' : 'De-escalate'}
                      </button>
                    )}
                    {issue.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateIssueField(issue, 'status', 'resolved')
                        }
                        disabled={isResolveBusy || !!pendingId}
                      >
                        {isResolveBusy ? 'Resolving...' : 'Resolve'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          updateIssueField(issue, 'status', 'open')
                        }
                        disabled={isResolveBusy || !!pendingId}
                      >
                        {isResolveBusy ? 'Updating...' : 'Reopen'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
