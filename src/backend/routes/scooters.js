const express = require('express');
const { authenticateRequest, requireAdmin } = require('../auth-middleware');
const db = require('../db/connection');
const { normalizeId, validateScooterPayload } = require('../scooter-service');

const router = express.Router();

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
  const user = await authenticateRequest(req, res);

  if (!user) {
    return;
  }

  if (!requireAdmin(res, user)) {
    return;
  }

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
  const user = await authenticateRequest(req, res);

  if (!user) {
    return;
  }

  if (!requireAdmin(res, user)) {
    return;
  }

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
