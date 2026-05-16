import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getSessionToken } from '../session';
import { useTheme } from '../hooks/useTheme';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const API_BASE = 'http://127.0.0.1:3000/api';

const PLAN_CONFIG = [
  { key: 'oneHour', label: '1 Hour' },
  { key: 'fourHours', label: '4 Hours' },
  { key: 'oneDay', label: '1 Day' },
  { key: 'oneWeek', label: '1 Week' },
];

function readCssToken(name) {
  if (typeof document === 'undefined') {
    return '';
  }

  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function useChartTheme() {
  const { theme } = useTheme();
  const [chartTheme, setChartTheme] = useState({
    accent: '',
    accentStrong: '',
    textMuted: '',
    border: '',
    accentSoft: '',
  });

  useEffect(() => {
    setChartTheme({
      accent: readCssToken('--accent'),
      accentStrong: readCssToken('--accent-strong'),
      textMuted: readCssToken('--text-muted'),
      border: readCssToken('--border'),
      accentSoft: readCssToken('--accent-soft'),
    });
  }, [theme]);

  return chartTheme;
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
          <span key={p.key} className="income-chart__tooltip-line">
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
  const chartTheme = useChartTheme();

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
      <section className="admin-shell">
        <article className="admin-card admin-card--accent" data-id="ID19">
          <div className="admin-header">
            <div className="admin-header__text">
              <p className="admin-kicker">Admin</p>
              <h2 className="admin-title">Weekly income</h2>
            </div>
          </div>
          <p className="admin-empty">
            Sign in as an administrator to view revenue analytics.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="admin-shell">
      <article className="admin-card admin-card--accent" data-id="ID19">
        <div className="admin-header">
          <div className="admin-header__text">
            <p className="admin-kicker">Admin</p>
            <h2 className="admin-title">Weekly income by rental option</h2>
          </div>

          <div className="income-segmented" role="group" aria-label="Chart view">
            <button
              type="button"
              className={`income-segmented__btn${viewMode === 'plan' ? ' is-active' : ''}`}
              onClick={() => setViewMode('plan')}
              aria-pressed={viewMode === 'plan'}
            >
              <BarChart3 size={14} aria-hidden="true" />
              By Plan
            </button>
            <button
              type="button"
              className={`income-segmented__btn${viewMode === 'day' ? ' is-active' : ''}`}
              onClick={() => setViewMode('day')}
              aria-pressed={viewMode === 'day'}
            >
              <CalendarDays size={14} aria-hidden="true" />
              By Day
            </button>
          </div>
        </div>

        <div className="income-week-nav">
          <button
            type="button"
            className="btn btn--secondary"
            aria-label={`View income for previous week before ${formatWeekLabel(weekStart)}`}
            onClick={() => setWeekStart((ws) => shiftWeek(ws, -1))}
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Previous
          </button>
          <p className="income-week-nav__label">
            Week of {formatWeekLabel(weekStart)}
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            aria-label={`View income for next week after ${formatWeekLabel(weekStart)}`}
            onClick={() => setWeekStart((ws) => shiftWeek(ws, 1))}
          >
            Next
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <>
            <div className="admin-skeleton-kpi">
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
              <div className="skeleton skeleton--row" aria-hidden="true" />
            </div>
            <div className="income-chart-skeleton">
              <div className="skeleton skeleton--map" aria-hidden="true" />
            </div>
            <span className="sr-only">Loading income data</span>
          </>
        ) : error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : data ? (
          <>
            {viewMode === 'plan' ? (
              <div className="kpi-grid" role="list">
                {PLAN_CONFIG.map((plan) => (
                  <div key={plan.key} className="kpi-card" role="listitem">
                    <p className="kpi-card__label">{plan.label}</p>
                    <p className="kpi-card__value">
                      {formatCurrency(data.income?.[plan.key] ?? 0)}
                    </p>
                    <p className="kpi-card__meta">
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
                      <CartesianGrid
                        stroke={chartTheme.border || 'currentColor'}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="plan"
                        tick={{ fontSize: 12, fill: chartTheme.textMuted }}
                        tickLine={false}
                        axisLine={{ stroke: chartTheme.border }}
                      />
                      <YAxis
                        tickFormatter={formatAxisCurrency}
                        tick={{ fontSize: 12, fill: chartTheme.textMuted }}
                        tickLine={false}
                        axisLine={{ stroke: chartTheme.border }}
                        width={64}
                      />
                      <Tooltip
                        cursor={{ fill: chartTheme.accentSoft }}
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
                        fill={chartTheme.accentStrong || chartTheme.accent}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={72}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            ) : null}

            <div className="income-grand-total">
              <p className="income-grand-total__label">Grand total</p>
              <p className="income-grand-total__value">
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
