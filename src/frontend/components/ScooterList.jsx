import { useScooters } from '../hooks/useScooters';
import { useMemo, useState } from 'react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toStatusLabel(status) {
  return String(status || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ScooterList() {
  const { scooters, isLoading, error, refetchScooters } = useScooters();
  const [selectedScooterId, setSelectedScooterId] = useState(null);

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

  if (isLoading) {
    return (
      <main className="shell" aria-live="polite">
        <section className="pricing-layout">
          <article className="panel panel-accent">
            <div className="pricing-summary">
              <div className="summary-card">
                <p className="summary-label">Status</p>
                <p className="summary-value">Loading pricing...</p>
              </div>
            </div>
          </article>
          <article className="panel">
            <p className="empty-state">Loading scooters...</p>
          </article>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <section className="pricing-layout">
          <article className="panel panel-accent">
            <div className="panel-header">
              <p className="panel-kicker">ID4</p>
              <h2>View hire options and cost</h2>
            </div>
            <p
              id="pricing-message"
              className="message"
              role="alert"
              aria-live="polite"
            >
              Could not load scooters: {error}
            </p>
            <button
              type="button"
              className="secondary"
              onClick={refetchScooters}
            >
              Retry
            </button>
          </article>
        </section>
      </main>
    );
  }

  if (scooters.length === 0) {
    return (
      <main className="shell">
        <section className="pricing-layout">
          <article className="panel panel-accent">
            <div className="panel-header">
              <p className="panel-kicker">ID4 + ID17</p>
              <h2>Pricing and fleet availability</h2>
            </div>
            <p className="empty-state">
              No scooters are configured for hire pricing yet.
            </p>
          </article>
        </section>
      </main>
    );
  }

  const availableCount = scooters.filter(
    (scooter) => scooter.status === 'available'
  ).length;

  return (
    <main className="shell">
      <section className="pricing-layout">
        <article className="panel panel-accent">
          <div className="panel-header">
            <p className="panel-kicker">ID4</p>
            <h2>View hire options and cost</h2>
          </div>
          <div className="pricing-summary">
            <div className="summary-card">
              <p className="summary-label">Selected scooter</p>
              <p className="summary-value">{selectedScooter?.scooterId}</p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Location</p>
              <p className="summary-value">
                {selectedScooter?.location?.description || 'Unknown'}
              </p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Availability</p>
              <p className="summary-value">
                {toStatusLabel(selectedScooter?.status || 'unavailable')}
              </p>
            </div>
            <div className="summary-card">
              <p className="summary-label">Fleet ready now</p>
              <p className="summary-value">
                {availableCount} of {scooters.length} scooters available
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <p className="panel-kicker">Scooters</p>
            <h2>Choose a vehicle</h2>
          </div>
          <div className="scooter-list" role="list" aria-live="polite">
            {scooters.map((scooter) => (
              <button
                key={scooter.scooterId}
                type="button"
                className={`scooter-option${
                  selectedScooter?.scooterId === scooter.scooterId
                    ? ' is-selected'
                    : ''
                }`}
                aria-pressed={selectedScooter?.scooterId === scooter.scooterId}
                onClick={() => setSelectedScooterId(scooter.scooterId)}
              >
                <div className="scooter-option__top">
                  <strong>{scooter.scooterId}</strong>
                  <span
                    className={`status-pill status-pill--${scooter.status}`}
                  >
                    {toStatusLabel(scooter.status)}
                  </span>
                </div>
                <p className="scooter-option__location">
                  {scooter.location?.description || 'Unknown'}
                </p>
                <p className="scooter-option__rate">
                  Starts at {formatCurrency(scooter.pricing?.oneHour ?? 0)} per
                  hour
                </p>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <p className="panel-kicker">Pricing</p>
            <h2>Hire plans</h2>
          </div>
          <div className="hire-grid" role="list" aria-live="polite">
            {hirePlanConfig.map((plan) => {
              const planPrice = selectedScooter?.pricing?.[plan.key] ?? 0;
              return (
                <article key={plan.key} className="hire-card">
                  <h3>{plan.title}</h3>
                  <p className="hire-price">{formatCurrency(planPrice)}</p>
                  <p className="hire-meta">
                    {plan.durationHours === 1
                      ? 'Flexible pay-as-you-go rate'
                      : `${formatCurrency(
                          planPrice / plan.durationHours
                        )} average per hour`}
                  </p>
                  <p className="hire-note">{plan.description}</p>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      <section className="fleet-layout">
        <article className="panel panel-accent">
          <div className="panel-header">
            <p className="panel-kicker">ID17</p>
            <h2>Fleet availability overview</h2>
          </div>
          <div className="availability-overview" role="list" aria-live="polite">
            {availabilityCounts.map((entry) => (
              <div
                key={entry.key}
                className={`summary-card summary-card--${entry.key}`}
              >
                <p className="summary-label">{entry.label}</p>
                <p className="summary-value">
                  {entry.count} scooter{entry.count === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
