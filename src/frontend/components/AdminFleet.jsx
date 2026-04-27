import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScooters } from '../hooks/useScooters';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const API_BASE = 'http://127.0.0.1:3000/api';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
];

function toStatusLabel(status) {
  return String(status || '')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildEditState(scooter) {
  return {
    status: scooter?.status ?? 'available',
    description: scooter?.location?.description ?? '',
    latitude: String(scooter?.location?.latitude ?? ''),
    longitude: String(scooter?.location?.longitude ?? ''),
    oneHour: String(scooter?.pricing?.oneHour ?? ''),
    fourHours: String(scooter?.pricing?.fourHours ?? ''),
    oneDay: String(scooter?.pricing?.oneDay ?? ''),
    oneWeek: String(scooter?.pricing?.oneWeek ?? ''),
  };
}

const EMPTY_CREATE_STATE = Object.freeze({
  scooterId: '',
  status: 'available',
  description: '',
  latitude: '',
  longitude: '',
  oneHour: '',
  fourHours: '',
  oneDay: '',
  oneWeek: '',
});

// Mirrors the backend pattern at src/backend/scooter-service.js so the
// user gets the same error message both client- and server-side. Keep
// these in sync if the backend constraint is ever loosened.
const SCOOTER_ID_PATTERN = /^[A-Z0-9-]{4,20}$/;

export default function AdminFleet({ session }) {
  const token = getSessionToken(session);
  const { scooters, isLoading, error, refetchScooters } = useScooters();
  const [editingId, setEditingId] = useState(null);
  const [editState, setEditState] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', state: '' });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createState, setCreateState] = useState({ ...EMPTY_CREATE_STATE });
  const [isCreating, setIsCreating] = useState(false);

  const existingIds = useMemo(
    () =>
      new Set(
        scooters.map((scooter) => String(scooter.scooterId || '').toUpperCase())
      ),
    [scooters]
  );

  const editingScooter = useMemo(
    () => scooters.find((scooter) => scooter.scooterId === editingId) || null,
    [editingId, scooters]
  );

  useEffect(() => {
    if (!editingScooter) {
      setEditState(null);
    }
  }, [editingScooter]);

  function startEdit(scooter) {
    setEditingId(scooter.scooterId);
    setEditState(buildEditState(scooter));
    setActionMessage({ text: '', state: '' });
  }

  function cancelEdit() {
    if (isSaving) {
      return;
    }

    setEditingId(null);
    setEditState(null);
    setActionMessage({ text: '', state: '' });
  }

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!token || !editingScooter || !editState) {
        return;
      }

      setIsSaving(true);
      setActionMessage({ text: '', state: '' });

      const numericLatitude = Number(editState.latitude);
      const numericLongitude = Number(editState.longitude);

      if (
        !Number.isFinite(numericLatitude) ||
        !Number.isFinite(numericLongitude)
      ) {
        setActionMessage({
          text: 'Latitude and longitude must be valid numbers.',
          state: 'error',
        });
        setIsSaving(false);
        return;
      }

      const payload = {
        scooterId: editingScooter.scooterId,
        status: editState.status,
        location: {
          latitude: numericLatitude,
          longitude: numericLongitude,
          description: editState.description.trim(),
        },
        pricing: {
          oneHour: Number(editState.oneHour),
          fourHours: Number(editState.fourHours),
          oneDay: Number(editState.oneDay),
          oneWeek: Number(editState.oneWeek),
        },
      };

      try {
        await requestJson(`${API_BASE}/scooters/${editingScooter.scooterId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        setActionMessage({
          text: `${editingScooter.scooterId} updated successfully.`,
          state: 'success',
        });
        await refetchScooters();
        setEditingId(null);
        setEditState(null);
      } catch (saveError) {
        console.error('AdminFleet: update failed', saveError);
        setActionMessage({
          text: saveError?.message || 'Failed to update scooter.',
          state: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [editState, editingScooter, refetchScooters, token]
  );

  function openCreateForm() {
    if (editingId) {
      cancelEdit();
    }

    setCreateState({ ...EMPTY_CREATE_STATE });
    setIsCreateOpen(true);
    setActionMessage({ text: '', state: '' });
  }

  function closeCreateForm() {
    if (isCreating) {
      return;
    }

    setIsCreateOpen(false);
    setCreateState({ ...EMPTY_CREATE_STATE });
  }

  const handleCreateSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!token) {
        return;
      }

      const normalizedId = String(createState.scooterId || '')
        .trim()
        .toUpperCase();

      if (!SCOOTER_ID_PATTERN.test(normalizedId)) {
        setActionMessage({
          text: 'Scooter ID must be 4-20 characters and use only letters, numbers, or hyphens.',
          state: 'error',
        });
        return;
      }

      if (existingIds.has(normalizedId)) {
        setActionMessage({
          text: `A scooter with ID ${normalizedId} already exists.`,
          state: 'error',
        });
        return;
      }

      const numericLatitude = Number(createState.latitude);
      const numericLongitude = Number(createState.longitude);

      if (
        !Number.isFinite(numericLatitude) ||
        !Number.isFinite(numericLongitude)
      ) {
        setActionMessage({
          text: 'Latitude and longitude must be valid numbers.',
          state: 'error',
        });
        return;
      }

      const payload = {
        scooterId: normalizedId,
        status: createState.status,
        location: {
          latitude: numericLatitude,
          longitude: numericLongitude,
          description: createState.description.trim(),
        },
        pricing: {
          oneHour: Number(createState.oneHour),
          fourHours: Number(createState.fourHours),
          oneDay: Number(createState.oneDay),
          oneWeek: Number(createState.oneWeek),
        },
      };

      setIsCreating(true);
      setActionMessage({ text: '', state: '' });

      try {
        await requestJson(`${API_BASE}/scooters`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        setActionMessage({
          text: `${normalizedId} added to the fleet.`,
          state: 'success',
        });
        await refetchScooters();
        setCreateState({ ...EMPTY_CREATE_STATE });
        setIsCreateOpen(false);
      } catch (createError) {
        console.error('AdminFleet: create failed', createError);
        setActionMessage({
          text: createError?.message || 'Failed to add scooter.',
          state: 'error',
        });
      } finally {
        setIsCreating(false);
      }
    },
    [createState, existingIds, refetchScooters, token]
  );

  if (!token) {
    return (
      <section className="my-bookings-view">
        <article className="panel panel-accent panel-wide">
          <div className="panel-header">
            <h2>Fleet management</h2>
          </div>
          <p className="empty-state">
            Sign in as an administrator to manage the fleet.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="my-bookings-view">
      <article className="panel panel-accent panel-wide">
        <div className="panel-header panel-header--row">
          <div>
            <p className="panel-kicker">Admin</p>
            <h2>Fleet management</h2>
          </div>
          {!isCreateOpen ? (
            <button type="button" onClick={openCreateForm}>
              Add scooter
            </button>
          ) : null}
        </div>

        {isCreateOpen ? (
          <form
            className="form-grid admin-fleet-create"
            onSubmit={handleCreateSubmit}
            aria-label="Add a scooter to the fleet"
          >
            <p className="summary-label">New scooter</p>

            <label>
              Scooter ID
              <input
                type="text"
                value={createState.scooterId}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    scooterId: event.target.value,
                  }))
                }
                placeholder="ESC-010"
                required
                pattern="[A-Za-z0-9-]{4,20}"
                title="4-20 characters, letters, numbers, or hyphens"
              />
            </label>

            <label>
              Status
              <select
                value={createState.status}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Location description
              <input
                type="text"
                value={createState.description}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="City Centre Square"
                required
              />
            </label>

            <div className="payment-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={createState.latitude}
                  onChange={(event) =>
                    setCreateState((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={createState.longitude}
                  onChange={(event) =>
                    setCreateState((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <div className="payment-grid">
              <label>
                1 hour price (£)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createState.oneHour}
                  onChange={(event) =>
                    setCreateState((current) => ({
                      ...current,
                      oneHour: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                4 hours price (£)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createState.fourHours}
                  onChange={(event) =>
                    setCreateState((current) => ({
                      ...current,
                      fourHours: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <div className="payment-grid">
              <label>
                1 day price (£)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createState.oneDay}
                  onChange={(event) =>
                    setCreateState((current) => ({
                      ...current,
                      oneDay: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                1 week price (£)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createState.oneWeek}
                  onChange={(event) =>
                    setCreateState((current) => ({
                      ...current,
                      oneWeek: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={closeCreateForm}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button type="submit" disabled={isCreating}>
                {isCreating ? 'Adding...' : 'Add scooter'}
              </button>
            </div>
          </form>
        ) : null}

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
          <p className="empty-state">Loading fleet...</p>
        ) : error ? (
          <>
            <p className="message" data-state="error" role="alert">
              Could not load scooters: {error}
            </p>
            <button
              type="button"
              className="secondary"
              onClick={refetchScooters}
            >
              Retry
            </button>
          </>
        ) : scooters.length === 0 ? (
          <p className="empty-state">No scooters configured yet.</p>
        ) : (
          <div className="booking-history" role="list">
            {scooters.map((scooter) => {
              const isEditingThis =
                editingId === scooter.scooterId && editState;

              return (
                <article
                  key={scooter.scooterId}
                  className="booking-history__item"
                  role="listitem"
                >
                  <div className="booking-history__header">
                    <div>
                      <p className="summary-label">Scooter</p>
                      <p className="summary-value">{scooter.scooterId}</p>
                    </div>
                    <span
                      className={`status-pill status-pill--${scooter.status}`}
                    >
                      {toStatusLabel(scooter.status)}
                    </span>
                  </div>

                  {isEditingThis ? (
                    <form className="form-grid" onSubmit={handleSubmit}>
                      <label>
                        Status
                        <select
                          value={editState.status}
                          onChange={(event) =>
                            setEditState((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Location description
                        <input
                          type="text"
                          value={editState.description}
                          onChange={(event) =>
                            setEditState((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>

                      <div className="payment-grid">
                        <label>
                          Latitude
                          <input
                            type="number"
                            step="any"
                            value={editState.latitude}
                            onChange={(event) =>
                              setEditState((current) => ({
                                ...current,
                                latitude: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label>
                          Longitude
                          <input
                            type="number"
                            step="any"
                            value={editState.longitude}
                            onChange={(event) =>
                              setEditState((current) => ({
                                ...current,
                                longitude: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </div>

                      <div className="payment-grid">
                        <label>
                          1 hour price (£)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editState.oneHour}
                            onChange={(event) =>
                              setEditState((current) => ({
                                ...current,
                                oneHour: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label>
                          4 hours price (£)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editState.fourHours}
                            onChange={(event) =>
                              setEditState((current) => ({
                                ...current,
                                fourHours: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </div>

                      <div className="payment-grid">
                        <label>
                          1 day price (£)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editState.oneDay}
                            onChange={(event) =>
                              setEditState((current) => ({
                                ...current,
                                oneDay: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label>
                          1 week price (£)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editState.oneWeek}
                            onChange={(event) =>
                              setEditState((current) => ({
                                ...current,
                                oneWeek: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </div>

                      <div className="modal-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                        <button type="submit" disabled={isSaving}>
                          {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="booking-history__grid">
                        <div className="summary-card">
                          <p className="summary-label">Location</p>
                          <p className="summary-value">
                            {scooter.location?.description || 'Unknown'}
                          </p>
                          <p className="hire-note">
                            {scooter.location?.latitude},{' '}
                            {scooter.location?.longitude}
                          </p>
                        </div>
                        <div className="summary-card">
                          <p className="summary-label">1 hour</p>
                          <p className="summary-value">
                            {formatCurrency(scooter.pricing?.oneHour ?? 0)}
                          </p>
                        </div>
                        <div className="summary-card">
                          <p className="summary-label">4 hours</p>
                          <p className="summary-value">
                            {formatCurrency(scooter.pricing?.fourHours ?? 0)}
                          </p>
                        </div>
                        <div className="summary-card">
                          <p className="summary-label">1 day</p>
                          <p className="summary-value">
                            {formatCurrency(scooter.pricing?.oneDay ?? 0)}
                          </p>
                        </div>
                        <div className="summary-card">
                          <p className="summary-label">1 week</p>
                          <p className="summary-value">
                            {formatCurrency(scooter.pricing?.oneWeek ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="booking-actions">
                        <button
                          type="button"
                          onClick={() => startEdit(scooter)}
                        >
                          Edit scooter
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
