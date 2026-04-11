const express = require('express');
const { parseSessionToken } = require('../auth-service');
const {
  createBookingInTransaction,
  durationCodes,
  normalizeId,
  normalizeText,
  pricingColumnMap,
  simulatePayment,
  validatePaymentPayload,
} = require('../booking-service');
const { findUserById } = require('../database');
const db = require('../db/connection');

const router = express.Router();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        changes: this.changes,
        lastID: this.lastID,
      });
    });
  });
}

function extractSessionToken(authorizationHeader) {
  const normalizedHeader = normalizeText(authorizationHeader);

  if (!normalizedHeader) {
    return '';
  }

  const bearerMatch = normalizedHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch ? bearerMatch[1].trim() : normalizedHeader;
}

async function getScooterPricingSnapshot(scooterId) {
  return dbGet(
    `
      SELECT
        s.scooter_id,
        s.status,
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
}

function toIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  return `${String(value).replace(' ', 'T')}Z`;
}

function mapBookingRow(row) {
  return {
    bookingId: row.id,
    scooterId: row.scooter_id,
    durationCode: row.duration_code,
    totalPrice: row.total_price,
    status: row.status,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

async function authenticateRequest(req, res) {
  const authorizationHeader = req.get('authorization');

  if (!authorizationHeader) {
    res.status(401).json({
      success: false,
      error: 'Authorization header is required.',
    });
    return null;
  }

  const session = parseSessionToken(extractSessionToken(authorizationHeader));

  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Invalid session token.',
    });
    return null;
  }

  const user = await findUserById(session.userId);

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Invalid session token.',
    });
    return null;
  }

  return user;
}

async function handleGetMyBookings(req, res) {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    const rows = await dbAll(
      `
        SELECT
          id,
          scooter_id,
          duration_code,
          total_price,
          status,
          created_at,
          updated_at
        FROM bookings
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC;
      `,
      [user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows.map(mapBookingRow),
    });
  } catch (error) {
    console.error(`GET ${req.baseUrl}${req.path} failed:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings.',
    });
  }
}

router.get('/bookings/me', handleGetMyBookings);

router.get('/bookings', handleGetMyBookings);

router.post('/bookings', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    const scooterId = normalizeId(req.body?.scooterId);

    if (!scooterId) {
      return res.status(400).json({
        success: false,
        error: 'Scooter ID is required.',
      });
    }

    const scooter = await getScooterPricingSnapshot(scooterId);

    if (!scooter) {
      return res.status(404).json({
        success: false,
        error: 'Scooter not found.',
      });
    }

    if (scooter.status !== 'available') {
      return res.status(409).json({
        success: false,
        error: 'Scooter is not available for booking.',
      });
    }

    const durationCode = normalizeText(req.body?.durationCode);

    if (!durationCodes.includes(durationCode)) {
      return res.status(400).json({
        success: false,
        error: `Duration code must be one of: ${durationCodes.join(', ')}.`,
      });
    }

    const totalPrice = scooter[pricingColumnMap[durationCode]];
    const paymentValidation = validatePaymentPayload(req.body?.payment);

    if (!paymentValidation.ok) {
      return res.status(400).json({
        success: false,
        error: paymentValidation.message,
      });
    }

    const paymentResult = simulatePayment(paymentValidation.value);

    if (!paymentResult.ok) {
      return res.status(paymentResult.statusCode).json({
        success: false,
        error: paymentResult.message,
      });
    }

    let createdBooking;

    try {
      createdBooking = await createBookingInTransaction({
        dbRun,
        dbGet,
        userId: user.id,
        scooterId,
        durationCode,
        totalPrice,
      });
    } catch (transactionError) {
      if (transactionError.statusCode) {
        return res.status(transactionError.statusCode).json({
          success: false,
          error: transactionError.clientMessage,
        });
      }

      throw transactionError;
    }

    return res.status(201).json({
      success: true,
      data: {
        ...mapBookingRow(createdBooking),
        paymentStatus: paymentResult.value.paymentStatus,
        paymentReference: paymentResult.value.paymentReference,
        scooterStatus: 'in_use',
      },
    });
  } catch (error) {
    console.error('POST /api/bookings failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create booking.',
    });
  }
});

module.exports = router;
