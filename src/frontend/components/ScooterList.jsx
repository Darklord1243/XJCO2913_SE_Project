import { useScooters } from '../hooks/useScooters';
import './ScooterList.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getAvailabilityLabel(status) {
  return status === 'available' ? 'Available' : 'Unavailable';
}

export default function ScooterList() {
  const { scooters, isLoading, error, refetchScooters } = useScooters();

  if (isLoading) {
    return (
      <section className="scooter-list-section" aria-live="polite">
        <h2>Available Scooters</h2>
        <p>Loading scooter availability...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="scooter-list-section" aria-live="polite">
        <h2>Available Scooters</h2>
        <p role="alert">Could not load scooters: {error}</p>
        <button
          type="button"
          className="retry-button"
          onClick={refetchScooters}
          aria-label="Retry loading scooters"
        >
          Retry
        </button>
      </section>
    );
  }

  if (scooters.length === 0) {
    return (
      <section className="scooter-list-section" aria-live="polite">
        <h2>Available Scooters</h2>
        <p>No scooters found right now. Please check again soon.</p>
      </section>
    );
  }

  return (
    <section
      className="scooter-list-section"
      aria-labelledby="scooter-list-title"
    >
      <h2 id="scooter-list-title">Available Scooters</h2>
      <ul className="scooter-grid" aria-label="Scooter availability list">
        {scooters.map((scooter) => (
          <li key={scooter.scooterId} className="scooter-card-wrapper">
            <article className="scooter-card">
              <header className="scooter-card-header">
                <h3>{scooter.scooterId}</h3>
                <span
                  className={`status-chip status-${scooter.status}`}
                  aria-label={`Status: ${getAvailabilityLabel(scooter.status)}`}
                >
                  {getAvailabilityLabel(scooter.status)}
                </span>
              </header>

              <p className="scooter-location">
                <strong>Location:</strong>{' '}
                {scooter.location?.description || 'Unknown'}
              </p>

              <div className="pricing-section">
                <h4>Hire Costs</h4>
                <table className="pricing-table">
                  <caption className="sr-only">
                    Hire pricing for scooter {scooter.scooterId}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">1hr</th>
                      <th scope="col">4hrs</th>
                      <th scope="col">1day</th>
                      <th scope="col">1week</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatCurrency(scooter.pricing?.oneHour ?? 0)}</td>
                      <td>{formatCurrency(scooter.pricing?.fourHours ?? 0)}</td>
                      <td>{formatCurrency(scooter.pricing?.oneDay ?? 0)}</td>
                      <td>{formatCurrency(scooter.pricing?.oneWeek ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
