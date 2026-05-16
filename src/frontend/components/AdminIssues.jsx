import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, RotateCcw } from 'lucide-react';
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
      <section className="admin-shell">
        <article className="admin-card admin-card--accent">
          <div className="admin-header">
            <div className="admin-header__text">
              <h2 className="admin-title">Issue management</h2>
            </div>
          </div>
          <p className="admin-empty">
            Sign in as staff or administrator to triage issues.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="admin-shell">
      <article className="admin-card admin-card--accent">
        <div className="admin-header">
          <div className="admin-header__text">
            <p className="admin-kicker">Admin</p>
            <h2 className="admin-title">Issue management</h2>
          </div>
        </div>

        <div className="admin-filters">
          <div className="field">
            <label className="field__label" htmlFor="admin-issues-status">
              Status
            </label>
            <select
              className="input"
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
          </div>
          <div className="field">
            <label className="field__label" htmlFor="admin-issues-priority">
              Priority
            </label>
            <select
              className="input"
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
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset filters
          </button>
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

        {isLoading ? (
          <>
            <div className="skeleton-stack">
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
            </div>
            <span className="sr-only">Loading issues</span>
          </>
        ) : error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : issues.length === 0 ? (
          <div className="admin-empty-state">
            <AlertTriangle size={48} className="admin-empty-state__icon" aria-hidden="true" />
            <p className="admin-empty-state__title">No issues match the current filters</p>
            <p className="admin-empty-state__sub">Try clearing status or priority filters.</p>
          </div>
        ) : (
          <div className="issue-list">
            {issues.map((issue) => {
              const isResolveBusy = pendingId === `${issue.id}-status`;
              const isPriorityBusy = pendingId === `${issue.id}-priority`;

              return (
                <article
                  key={issue.id}
                  className="issue-row"
                >
                  <div className="issue-row__header">
                    <div className="issue-row__heading">
                      <p className="fleet-card__label">Issue</p>
                      <p className="issue-row__id">#{issue.id}</p>
                    </div>
                    <span
                      className={`status-pill status-pill--${issue.status}`}
                    >
                      {toStatusLabel(issue.status)}
                    </span>
                  </div>

                  <div className="issue-row__meta">
                    <div className="fleet-card__stat">
                      <p className="fleet-card__label">Scooter</p>
                      <p className="fleet-card__stat-value">{issue.scooterId}</p>
                    </div>
                    <div className="fleet-card__stat">
                      <p className="fleet-card__label">Reporter</p>
                      <p className="fleet-card__stat-value">User #{issue.userId}</p>
                    </div>
                    <div className="fleet-card__stat">
                      <p className="fleet-card__label">Priority</p>
                      <span className={`priority-badge priority-badge--${issue.priority}`}>
                        {toStatusLabel(issue.priority)}
                      </span>
                    </div>
                    <div className="fleet-card__stat">
                      <p className="fleet-card__label">Reported</p>
                      <p className="fleet-card__stat-value">
                        {formatDateTime(issue.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="issue-row__description">
                    {issue.description}
                  </p>

                  <div className="issue-row__actions">
                    {issue.priority === 'low' ? (
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() =>
                          updateIssueField(issue, 'priority', 'high')
                        }
                        disabled={isPriorityBusy || !!pendingId}
                      >
                        <ArrowUp size={14} aria-hidden="true" />
                        {isPriorityBusy ? 'Escalating...' : 'Escalate'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() =>
                          updateIssueField(issue, 'priority', 'low')
                        }
                        disabled={isPriorityBusy || !!pendingId}
                      >
                        <ArrowDown size={14} aria-hidden="true" />
                        {isPriorityBusy ? 'Updating...' : 'De-escalate'}
                      </button>
                    )}
                    {issue.status === 'open' ? (
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() =>
                          updateIssueField(issue, 'status', 'resolved')
                        }
                        disabled={isResolveBusy || !!pendingId}
                      >
                        <CheckCircle2 size={14} aria-hidden="true" />
                        {isResolveBusy ? 'Resolving...' : 'Resolve'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--secondary"
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
