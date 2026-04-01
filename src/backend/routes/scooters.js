const express = require('express');
const db = require('../db/connection');

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

function getAllScootersWithPricing() {
  return new Promise((resolve, reject) => {
    db.all(selectScootersWithPricingQuery, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows ?? []);
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

module.exports = router;
