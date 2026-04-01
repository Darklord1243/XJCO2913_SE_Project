const express = require('express');
const db = require('../db/connection');

const router = express.Router();
const scooterStatuses = ['available', 'in_use', 'maintenance', 'offline'];

const selectScootersWithPricingQuery = `
  SELECT
    s.scooter_id,
    s.status,
    s.latitude,
    s.longitude,
    s.location_description,
    p.one_hour,
    p.four_hours,
    p.one_day,
    p.one_week
  FROM scooters s
  INNER JOIN scooter_pricing p ON p.scooter_id = s.scooter_id
  ORDER BY s.scooter_id ASC;
`;

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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows ?? []);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row ?? null);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        changes: this.changes,
      });
    });
  });
}

function mapRowsToApiContract(rows) {
  return rows.map((row) => ({
    scooterId: row.scooter_id,
    status: row.status,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      description: row.location_description,
    },
    pricing: {
      oneHour: row.one_hour,
      fourHours: row.four_hours,
      oneDay: row.one_day,
      oneWeek: row.one_week,
    },
  }));
}

async function getAllScootersWithPricing() {
  return dbAll(selectScootersWithPricingQuery, []);
}

async function getScooterById(scooterId) {
  const row = await dbGet(
    `
      SELECT
        s.scooter_id,
        s.status,
        s.latitude,
        s.longitude,
        s.location_description,
        p.one_hour,
        p.four_hours,
        p.one_day,
        p.one_week
      FROM scooters s
      INNER JOIN scooter_pricing p ON p.scooter_id = s.scooter_id
      WHERE s.scooter_id = ?;
    `,
    [scooterId]
  );

  return row ? mapRowsToApiContract([row])[0] : null;
}

router.get('/scooters', async (_req, res) => {
  try {
    const rows = await getAllScootersWithPricing();
    const data = mapRowsToApiContract(rows);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET /api/scooters failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scooters from database',
    });
  }
});

router.post('/scooters', async (req, res) => {
  const validation = validateScooterPayload(req.body || {});

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      error: validation.message,
    });
  }

  try {
    const existing = await getScooterById(validation.value.scooterId);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A scooter with this ID already exists.',
      });
    }

    await dbRun('BEGIN TRANSACTION');

    try {
      await dbRun(
        `
          INSERT INTO scooters (
            scooter_id,
            status,
            latitude,
            longitude,
            location_description
          )
          VALUES (?, ?, ?, ?, ?);
        `,
        [
          validation.value.scooterId,
          validation.value.status,
          validation.value.location.latitude,
          validation.value.location.longitude,
          validation.value.location.description,
        ]
      );

      await dbRun(
        `
          INSERT INTO scooter_pricing (
            scooter_id,
            one_hour,
            four_hours,
            one_day,
            one_week
          )
          VALUES (?, ?, ?, ?, ?);
        `,
        [
          validation.value.scooterId,
          validation.value.pricing.oneHour,
          validation.value.pricing.fourHours,
          validation.value.pricing.oneDay,
          validation.value.pricing.oneWeek,
        ]
      );

      await dbRun('COMMIT');
    } catch (transactionError) {
      await dbRun('ROLLBACK');
      throw transactionError;
    }

    const created = await getScooterById(validation.value.scooterId);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    console.error('POST /api/scooters failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create scooter.',
    });
  }
});

router.put('/scooters/:scooterId', async (req, res) => {
  const validation = validateScooterPayload(req.body || {});

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      error: validation.message,
    });
  }

  const scooterId = normalizeId(req.params.scooterId);

  if (validation.value.scooterId !== scooterId) {
    return res.status(400).json({
      success: false,
      error: 'Scooter ID in the URL must match the request body.',
    });
  }

  try {
    const existing = await getScooterById(scooterId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Scooter not found.',
      });
    }

    await dbRun('BEGIN TRANSACTION');

    try {
      await dbRun(
        `
          UPDATE scooters
          SET
            status = ?,
            latitude = ?,
            longitude = ?,
            location_description = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE scooter_id = ?;
        `,
        [
          validation.value.status,
          validation.value.location.latitude,
          validation.value.location.longitude,
          validation.value.location.description,
          scooterId,
        ]
      );

      await dbRun(
        `
          UPDATE scooter_pricing
          SET
            one_hour = ?,
            four_hours = ?,
            one_day = ?,
            one_week = ?
          WHERE scooter_id = ?;
        `,
        [
          validation.value.pricing.oneHour,
          validation.value.pricing.fourHours,
          validation.value.pricing.oneDay,
          validation.value.pricing.oneWeek,
          scooterId,
        ]
      );

      await dbRun('COMMIT');
    } catch (transactionError) {
      await dbRun('ROLLBACK');
      throw transactionError;
    }

    const updated = await getScooterById(scooterId);

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('PUT /api/scooters/:scooterId failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update scooter.',
    });
  }
});

module.exports = router;
