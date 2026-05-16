import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, MapPin, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useAdminScooters } from '../hooks/useAdminScooters';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { formatCurrency } from '../utils/currency';

const API_BASE = 'http://127.0.0.1:3000/api';

const STATUS_OPTIONS_BASE = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
];

const STATUS_OPTION_RETIRED = { value: 'retired', label: 'Retired' };

function editStatusOptions(scooter) {
  if (scooter?.status === 'retired') {
    return [...STATUS_OPTIONS_BASE, STATUS_OPTION_RETIRED];
  }

  return STATUS_OPTIONS_BASE;
}

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
  const { scooters, isLoading, error, refetchScooters } =
    useAdminScooters(token);
  const [editingId, setEditingId] = useState(null);
  const [editState, setEditState] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', state: '' });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createState, setCreateState] = useState({ ...EMPTY_CREATE_STATE });
  const [isCreating, setIsCreating] = useState(false);
  const [retiringId, setRetiringId] = useState(null);

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

  /** Opens the edit form with status pre-filled to Available (reactivation path). */
  function startReactivate(scooter) {
    setIsCreateOpen(false);
    setEditingId(scooter.scooterId);
    setEditState({ ...buildEditState(scooter), status: 'available' });
    setActionMessage({ text: '', state: '' });
  }

  const handleRetire = useCallback(
    async (scooter) => {
      if (!token || retiringId) {
        return;
      }

      if (
        !window.confirm(
          `Retire scooter ${scooter.scooterId}? It will disappear from the rider map until you re-activate it.`
        )
      ) {
        return;
      }

      setRetiringId(scooter.scooterId);
      setActionMessage({ text: '', state: '' });

      try {
        await requestJson(`${API_BASE}/scooters/${scooter.scooterId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setActionMessage({
          text: `${scooter.scooterId} retired.`,
          state: 'success',
        });

        if (editingId === scooter.scooterId) {
          setEditingId(null);
          setEditState(null);
        }

        await refetchScooters();
      } catch (retireError) {
        console.error('AdminFleet: retire failed', retireError);
        setActionMessage({
          text: retireError?.message || 'Failed to retire scooter.',
          state: 'error',
        });
      } finally {
        setRetiringId(null);
      }
    },
    [editingId, refetchScooters, retiringId, token]
  );

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
      <section className="admin-shell">
        <article className="admin-card admin-card--accent">
          <div className="admin-header">
            <div className="admin-header__text">
              <h2 className="admin-title">Fleet management</h2>
            </div>
          </div>
          <p className="admin-empty">
            Sign in as an administrator to manage the fleet.
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
            <h2 className="admin-title">Fleet management</h2>
          </div>
          {!isCreateOpen ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreateForm}
            >
              <Plus size={16} aria-hidden="true" />
              Add scooter
            </button>
          ) : null}
        </div>

        {isCreateOpen ? (
          <form
            className="crud-form"
            onSubmit={handleCreateSubmit}
            aria-label="Add a scooter to the fleet"
          >
            <h3 className="crud-form__title">New scooter</h3>

            <div className="field">
              <label className="field__label" htmlFor="create-scooter-id">
                Scooter ID
              </label>
              <input
                className="input"
                id="create-scooter-id"
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
            </div>

            <div className="field">
              <label className="field__label" htmlFor="create-status">
                Status
              </label>
              <select
                className="input"
                id="create-status"
                value={createState.status}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {STATUS_OPTIONS_BASE.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="create-description">
                Location description
              </label>
              <input
                className="input"
                id="create-description"
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
            </div>

            <div className="crud-form__grid">
              <div className="field">
                <label className="field__label" htmlFor="create-latitude">
                  Latitude
                </label>
                <input
                  className="input"
                  id="create-latitude"
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
              </div>
              <div className="field">
                <label className="field__label" htmlFor="create-longitude">
                  Longitude
                </label>
                <input
                  className="input"
                  id="create-longitude"
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
              </div>
            </div>

            <div className="crud-form__grid">
              <div className="field">
                <label className="field__label" htmlFor="create-one-hour">
                  1 hour price (£)
                </label>
                <input
                  className="input"
                  id="create-one-hour"
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
              </div>
              <div className="field">
                <label className="field__label" htmlFor="create-four-hours">
                  4 hours price (£)
                </label>
                <input
                  className="input"
                  id="create-four-hours"
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
              </div>
            </div>

            <div className="crud-form__grid">
              <div className="field">
                <label className="field__label" htmlFor="create-one-day">
                  1 day price (£)
                </label>
                <input
                  className="input"
                  id="create-one-day"
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
              </div>
              <div className="field">
                <label className="field__label" htmlFor="create-one-week">
                  1 week price (£)
                </label>
                <input
                  className="input"
                  id="create-one-week"
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
              </div>
            </div>

            <div className="crud-form__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={closeCreateForm}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isCreating}
              >
                {isCreating ? 'Adding...' : 'Add scooter'}
              </button>
            </div>
          </form>
        ) : null}

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
          <p className="admin-loading">Loading fleet...</p>
        ) : error ? (
          <>
            <div className="alert alert--error" role="alert">
              Could not load scooters: {error}
            </div>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={refetchScooters}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Retry
            </button>
          </>
        ) : scooters.length === 0 ? (
          <p className="admin-empty">No scooters configured yet.</p>
        ) : (
          <div className="fleet-card-grid">
            {scooters.map((scooter) => {
              const isEditingThis =
                editingId === scooter.scooterId && editState;

              return (
                <article
                  key={scooter.scooterId}
                  className={`fleet-card${scooter.status === 'retired' ? ' is-retired' : ''}`}
                >
                  <div className="fleet-card__header">
                    <div>
                      <p className="fleet-card__label">Scooter</p>
                      <p className="fleet-card__id">{scooter.scooterId}</p>
                    </div>
                    <span
                      className={`status-pill status-pill--${scooter.status}`}
                    >
                      {toStatusLabel(scooter.status)}
                    </span>
                  </div>

                  {isEditingThis ? (
                    <form className="crud-form" onSubmit={handleSubmit}>
                      <div className="field">
                        <label className="field__label" htmlFor="edit-status">
                          Status
                        </label>
                        <select
                          className="input"
                          id="edit-status"
                          value={editState.status}
                          onChange={(event) =>
                            setEditState((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                        >
                          {editStatusOptions(editingScooter).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label className="field__label" htmlFor="edit-description">
                          Location description
                        </label>
                        <input
                          className="input"
                          id="edit-description"
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
                      </div>

                      <div className="crud-form__grid">
                        <div className="field">
                          <label className="field__label" htmlFor="edit-latitude">
                            Latitude
                          </label>
                          <input
                            className="input"
                            id="edit-latitude"
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
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor="edit-longitude">
                            Longitude
                          </label>
                          <input
                            className="input"
                            id="edit-longitude"
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
                        </div>
                      </div>

                      <div className="crud-form__grid">
                        <div className="field">
                          <label className="field__label" htmlFor="edit-one-hour">
                            1 hour price (£)
                          </label>
                          <input
                            className="input"
                            id="edit-one-hour"
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
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor="edit-four-hours">
                            4 hours price (£)
                          </label>
                          <input
                            className="input"
                            id="edit-four-hours"
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
                        </div>
                      </div>

                      <div className="crud-form__grid">
                        <div className="field">
                          <label className="field__label" htmlFor="edit-one-day">
                            1 day price (£)
                          </label>
                          <input
                            className="input"
                            id="edit-one-day"
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
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor="edit-one-week">
                            1 week price (£)
                          </label>
                          <input
                            className="input"
                            id="edit-one-week"
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
                        </div>
                      </div>

                      <div className="crud-form__actions">
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn--primary"
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="fleet-card__meta">
                        <div className="fleet-card__stat">
                          <p className="fleet-card__label">Location</p>
                          <p className="fleet-card__stat-value">
                            {scooter.location?.description || 'Unknown'}
                          </p>
                          <p className="fleet-card__stat-sub">
                            <MapPin size={12} aria-hidden="true" />
                            {' '}
                            {scooter.location?.latitude},{' '}
                            {scooter.location?.longitude}
                          </p>
                        </div>
                        <div className="fleet-card__stat">
                          <p className="fleet-card__label">1 hour</p>
                          <p className="fleet-card__stat-value">
                            {formatCurrency(scooter.pricing?.oneHour ?? 0)}
                          </p>
                        </div>
                        <div className="fleet-card__stat">
                          <p className="fleet-card__label">4 hours</p>
                          <p className="fleet-card__stat-value">
                            {formatCurrency(scooter.pricing?.fourHours ?? 0)}
                          </p>
                        </div>
                        <div className="fleet-card__stat">
                          <p className="fleet-card__label">1 day</p>
                          <p className="fleet-card__stat-value">
                            {formatCurrency(scooter.pricing?.oneDay ?? 0)}
                          </p>
                        </div>
                        <div className="fleet-card__stat">
                          <p className="fleet-card__label">1 week</p>
                          <p className="fleet-card__stat-value">
                            {formatCurrency(scooter.pricing?.oneWeek ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="fleet-card__actions">
                        {scooter.status !== 'retired' ? (
                          <button
                            type="button"
                            className="btn btn--danger"
                            disabled={Boolean(retiringId)}
                            onClick={() => handleRetire(scooter)}
                          >
                            <Archive size={14} aria-hidden="true" />
                            {retiringId === scooter.scooterId
                              ? 'Retiring…'
                              : 'Retire'}
                          </button>
                        ) : null}
                        {scooter.status === 'retired' ? (
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => startReactivate(scooter)}
                          >
                            Re-activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => startEdit(scooter)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit scooter
                          </button>
                        )}
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
