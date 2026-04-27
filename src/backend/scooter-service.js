/**
 * Pure validation helpers for the scooter create/update payload.
 *
 * Lives outside the Express route so it can be unit-tested in isolation
 * and reused by both `POST /api/scooters` and `PUT /api/scooters/:id`.
 *
 * The validator is deliberately strict: a single source of truth keeps
 * the create and update paths from drifting and prevents partial / weird
 * rows from reaching the database.
 */

const SCOOTER_STATUSES = Object.freeze([
  'available',
  'in_use',
  'maintenance',
  'offline',
]);

const SCOOTER_ID_PATTERN = /^[A-Z0-9-]{4,20}$/;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeId(value) {
  return normalizeText(value).toUpperCase();
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return NaN;
}

function validateNumberField(value, label, { min, max } = {}) {
  const parsedValue = parseNumber(value);

  if (!Number.isFinite(parsedValue)) {
    return {
      ok: false,
      message: `${label} must be a valid number.`,
    };
  }

  if (min !== undefined && parsedValue < min) {
    return {
      ok: false,
      message: `${label} must be at least ${min}.`,
    };
  }

  if (max !== undefined && parsedValue > max) {
    return {
      ok: false,
      message: `${label} must be no more than ${max}.`,
    };
  }

  return {
    ok: true,
    value: parsedValue,
  };
}

function validateScooterPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      message: 'Scooter payload must be a JSON object.',
    };
  }

  const scooterId = normalizeId(input.scooterId);

  if (!SCOOTER_ID_PATTERN.test(scooterId)) {
    return {
      ok: false,
      message:
        'Scooter ID must be 4-20 characters and use only letters, numbers, or hyphens.',
    };
  }

  const status = normalizeText(input.status).toLowerCase();

  if (!SCOOTER_STATUSES.includes(status)) {
    return {
      ok: false,
      message: `Scooter status must be one of: ${SCOOTER_STATUSES.join(', ')}.`,
    };
  }

  const location = input.location;

  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return {
      ok: false,
      message: 'Location details are required.',
    };
  }

  const latitude = validateNumberField(location.latitude, 'Latitude', {
    min: -90,
    max: 90,
  });

  if (!latitude.ok) {
    return latitude;
  }

  const longitude = validateNumberField(location.longitude, 'Longitude', {
    min: -180,
    max: 180,
  });

  if (!longitude.ok) {
    return longitude;
  }

  const locationDescription = normalizeText(location.description);

  if (!locationDescription) {
    return {
      ok: false,
      message: 'Location description is required.',
    };
  }

  const pricing = input.pricing;

  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) {
    return {
      ok: false,
      message: 'Pricing details are required.',
    };
  }

  const oneHour = validateNumberField(pricing.oneHour, 'One-hour price', {
    min: 0,
  });

  if (!oneHour.ok) {
    return oneHour;
  }

  const fourHours = validateNumberField(pricing.fourHours, 'Four-hour price', {
    min: 0,
  });

  if (!fourHours.ok) {
    return fourHours;
  }

  const oneDay = validateNumberField(pricing.oneDay, 'One-day price', {
    min: 0,
  });

  if (!oneDay.ok) {
    return oneDay;
  }

  const oneWeek = validateNumberField(pricing.oneWeek, 'One-week price', {
    min: 0,
  });

  if (!oneWeek.ok) {
    return oneWeek;
  }

  return {
    ok: true,
    value: {
      scooterId,
      status,
      location: {
        latitude: latitude.value,
        longitude: longitude.value,
        description: locationDescription,
      },
      pricing: {
        oneHour: oneHour.value,
        fourHours: fourHours.value,
        oneDay: oneDay.value,
        oneWeek: oneWeek.value,
      },
    },
  };
}

module.exports = {
  SCOOTER_ID_PATTERN,
  SCOOTER_STATUSES,
  normalizeId,
  validateScooterPayload,
};
