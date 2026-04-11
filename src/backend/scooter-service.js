const scooterStatuses = ['available', 'in_use', 'reserved', 'maintenance'];

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

function validateDateField(value, label) {
  const normalizedValue = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return {
      ok: false,
      message: `${label} must use YYYY-MM-DD format.`,
    };
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      ok: false,
      message: `${label} must be a real calendar date.`,
    };
  }

  if (parsedDate.toISOString().slice(0, 10) !== normalizedValue) {
    return {
      ok: false,
      message: `${label} must be a real calendar date.`,
    };
  }

  return {
    ok: true,
    value: normalizedValue,
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

  if (!/^[A-Z0-9-]{4,20}$/.test(scooterId)) {
    return {
      ok: false,
      message:
        'Scooter ID must be 4-20 characters and use only letters, numbers, or hyphens.',
    };
  }

  const status = normalizeText(input.status).toLowerCase();

  if (!scooterStatuses.includes(status)) {
    return {
      ok: false,
      message: `Scooter status must be one of: ${scooterStatuses.join(', ')}.`,
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

  const details = input.details;

  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {
      ok: false,
      message: 'Scooter details are required.',
    };
  }

  const displayName = normalizeText(details.displayName);

  if (!displayName) {
    return {
      ok: false,
      message: 'Display name is required.',
    };
  }

  const model = normalizeText(details.model);

  if (!model) {
    return {
      ok: false,
      message: 'Model name is required.',
    };
  }

  const batteryLevel = validateNumberField(
    details.batteryLevel,
    'Battery level',
    {
      min: 0,
      max: 100,
    }
  );

  if (!batteryLevel.ok) {
    return batteryLevel;
  }

  const rangeKm = validateNumberField(details.rangeKm, 'Range (km)', {
    min: 0,
  });

  if (!rangeKm.ok) {
    return rangeKm;
  }

  const maxSpeedKph = validateNumberField(
    details.maxSpeedKph,
    'Max speed (km/h)',
    {
      min: 0,
    }
  );

  if (!maxSpeedKph.ok) {
    return maxSpeedKph;
  }

  const lastServiceDate = validateDateField(
    details.lastServiceDate,
    'Last service date'
  );

  if (!lastServiceDate.ok) {
    return lastServiceDate;
  }

  const availabilityNote = normalizeText(details.availabilityNote);

  if (!availabilityNote) {
    return {
      ok: false,
      message: 'Availability note is required.',
    };
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
      details: {
        displayName,
        model,
        batteryLevel: Math.round(batteryLevel.value),
        rangeKm: Math.round(rangeKm.value),
        maxSpeedKph: Math.round(maxSpeedKph.value),
        lastServiceDate: lastServiceDate.value,
        availabilityNote,
      },
    },
  };
}

module.exports = {
  scooterStatuses,
  validateScooterPayload,
};
