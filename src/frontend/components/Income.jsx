import { useCallback, useEffect, useState } from 'react';
import { getSessionToken } from '../session';

const API_BASE = 'http://127.0.0.1:3000/api';

const PLAN_CONFIG = [
  { key: 'oneHour', label: '1 Hour' },
  { key: 'fourHours', label: '4 Hours' },
  { key: 'oneDay', label: '1 Day' },
  { key: 'oneWeek', label: '1 Week' },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWeekLabel(dateStr) {
  if (!dateStr) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateStr}T00:00:00`));
}

function getMondayOfCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

function shiftWeek(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

export default function Income({ session }) {
  const token = getSessionToken(session);
  const [weekStart, setWeekStart] = useState(getMondayOfCurrentWeek);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIncome = useCallback(
    async (signal) => {
      if (!token) {
        setData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/bookings/income/weekly?weekStart=${weekStart}`,
          {
            signal,
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const payload = await res.json();

        if (!res.ok) {
          throw new Error(payload?.error || 'Request failed.');
        }

        setData(payload.data);
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }

        setError(err?.message || 'Failed to fetch income data.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [token, weekStart]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchIncome(controller.signal);
    return () => controller.abort();
  }, [fetchIncome]);

  if (!token) {
    return (
      <section className="income-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <p className="panel-kicker">ID19</p>
            <h2>Weekly income</h2>
          </div>
          <p className="empty-state">Sign in to view revenue analytics.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="income-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header">
          <p className="panel-kicker">ID19</p>
          <h2>Weekly income by rental option</h2>
        </div>

        <div className="week-navigator">
          <button
            type="button"
            className="secondary"
            onClick={() => setWeekStart((ws) => shiftWeek(ws, -1))}
          >
            ← Previous
          </button>
          <span className="week-navigator__label">
            Week of {formatWeekLabel(weekStart)}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => setWeekStart((ws) => shiftWeek(ws, 1))}
          >
            Next →
          </button>
        </div>

        {isLoading ? (
          <p className="empty-state">Loading income data...</p>
        ) : error ? (
          <p className="message" data-state="error" role="alert">
            {error}
          </p>
        ) : data ? (
          <>
            <div className="income-grid" role="list">
              {PLAN_CONFIG.map((plan) => (
                <div key={plan.key} className="income-card" role="listitem">
                  <p className="income-card__label">{plan.label}</p>
                  <p className="income-card__value">
                    {formatCurrency(data.income?.[plan.key] ?? 0)}
                  </p>
                  <p className="income-card__meta">
                    {data.counts?.[plan.key] ?? 0} booking
                    {(data.counts?.[plan.key] ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>

            <div className="income-total">
              <p className="summary-label">Grand total</p>
              <p className="summary-value income-total__value">
                {formatCurrency(data.grandTotal ?? 0)}
              </p>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
