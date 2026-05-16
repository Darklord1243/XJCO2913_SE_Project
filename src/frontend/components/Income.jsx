import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const API_BASE = 'http://127.0.0.1:3000/api';

const PLAN_CONFIG = [
  { key: 'oneHour', label: '1 Hour' },
  { key: 'fourHours', label: '4 Hours' },
  { key: 'oneDay', label: '1 Day' },
  { key: 'oneWeek', label: '1 Week' },
];

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

function formatAxisCurrency(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '£0';
  }

  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

function formatDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
  }).format(d);
}

function IncomeChartTooltip({ active, payload }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  const bookings = Number.isFinite(point.bookings) ? point.bookings : 0;
  const income = Number.isFinite(point.income) ? point.income : 0;

  return (
    <div className="income-chart__tooltip" role="tooltip">
      <p className="income-chart__tooltip-label">{point.plan}</p>
      <p className="income-chart__tooltip-value">{formatCurrency(income)}</p>
      <p className="income-chart__tooltip-meta">
        {bookings} booking{bookings === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function DailyChartTooltip({ active, payload }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  const income = Number.isFinite(point.income) ? point.income : 0;
  const bk = point.breakdown || {};

  return (
    <div className="income-chart__tooltip" role="tooltip">
      <p className="income-chart__tooltip-label">{point.plan}</p>
      <p className="income-chart__tooltip-value">{formatCurrency(income)}</p>
      <p className="income-chart__tooltip-meta">
        {PLAN_CONFIG.map((p) => (
          <span key={p.key} style={{ display: 'block' }}>
            {p.label}: {formatCurrency(bk[p.key] ?? 0)}
          </span>
        ))}
      </p>
    </div>
  );
}

export default function Income({ session }) {
  const token = getSessionToken(session);
  const [weekStart, setWeekStart] = useState(getMondayOfCurrentWeek);
  const [data, setData] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [viewMode, setViewMode] = useState('plan'); // 'plan' | 'day'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIncome = useCallback(
    async (signal) => {
      if (!token) {
        setData(null);
        setDailyData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [weeklyRes, dailyRes] = await Promise.all([
          requestJson(
            `${API_BASE}/bookings/income/weekly?weekStart=${weekStart}`,
            { signal, headers: { Authorization: `Bearer ${token}` } }
          ),
          requestJson(
            `${API_BASE}/bookings/income/daily?weekStart=${weekStart}`,
            { signal, headers: { Authorization: `Bearer ${token}` } }
          ),
        ]);

        setData(weeklyRes.data);
        setDailyData(dailyRes.data);
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }

        setError(err?.message || 'Failed to fetch income data.');
        setData(null);
        setDailyData(null);
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

  const chartData = useMemo(() => {
    if (viewMode === 'plan' && data) {
      return PLAN_CONFIG.map((plan) => ({
        plan: plan.label,
        income: Number(data.income?.[plan.key] ?? 0),
        bookings: Number(data.counts?.[plan.key] ?? 0),
      }));
    }

    if (viewMode === 'day' && dailyData) {
      return (dailyData.days || []).map((day) => ({
        plan: formatDayLabel(day.date),
        income: Number(day.totalIncome ?? 0),
        bookings: Number(day.bookingCount ?? 0),
        breakdown: day.breakdown,
      }));
    }

    return [];
  }, [data, dailyData, viewMode]);

  const chartTitle =
    viewMode === 'day' ? 'Income by day' : 'Income by hire plan';

  if (!token) {
    return (
      <section className="income-view">
        <article className="panel panel-accent panel-wide" data-id="ID19">
          <div className="panel-header">
            <p className="panel-kicker">Admin</p>
            <h2>Weekly income</h2>
          </div>
          <p className="empty-state">
            Sign in as an administrator to view revenue analytics.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="income-view">
      <article className="panel panel-accent panel-wide" data-id="ID19">
        <div className="panel-header panel-header--row">
          <div>
            <p className="panel-kicker">Admin</p>
            <h2>Weekly income by rental option</h2>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={viewMode === 'plan' ? '' : 'secondary'}
              onClick={() => setViewMode('plan')}
              aria-pressed={viewMode === 'plan'}
            >
              By Plan
            </button>
            <button
              type="button"
              className={viewMode === 'day' ? '' : 'secondary'}
              onClick={() => setViewMode('day')}
              aria-pressed={viewMode === 'day'}
            >
              By Day
            </button>
          </div>
        </div>

        <div className="week-navigator">
          <button
            type="button"
            className="secondary"
            aria-label={`View income for previous week before ${formatWeekLabel(weekStart)}`}
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
            aria-label={`View income for next week after ${formatWeekLabel(weekStart)}`}
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
            {viewMode === 'plan' ? (
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
            ) : null}

            {chartData.length > 0 ? (
              <figure
                className="income-chart"
                aria-label="Weekly income chart"
                data-id="ID21"
              >
                <figcaption className="income-chart__caption">
                  <span className="income-chart__title">{chartTitle}</span>
                </figcaption>
                <div className="income-chart__canvas">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
                    >
                      <XAxis
                        dataKey="plan"
                        tick={{ fontSize: 12, fill: 'var(--muted)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(15, 118, 110, 0.2)' }}
                      />
                      <YAxis
                        tickFormatter={formatAxisCurrency}
                        tick={{ fontSize: 12, fill: 'var(--muted)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(15, 118, 110, 0.2)' }}
                        width={64}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
                        content={
                          viewMode === 'day' ? (
                            <DailyChartTooltip />
                          ) : (
                            <IncomeChartTooltip />
                          )
                        }
                      />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="var(--accent-strong, #0f766e)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={72}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            ) : null}

            <div className="income-total">
              <p className="summary-label">Grand total</p>
              <p className="summary-value income-total__value">
                {formatCurrency(
                  viewMode === 'day'
                    ? (dailyData?.grandTotal ?? 0)
                    : (data.grandTotal ?? 0)
                )}
              </p>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
