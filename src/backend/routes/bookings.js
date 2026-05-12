const express = require('express');
const { authenticateRequest, requireAdmin } = require('../auth-middleware');
const {
  calculateWeeklyUserHours,
  createBookingInTransaction,
  durationCodes,
  normalizeId,
  normalizeText,
  pricingColumnMap,
  simulatePayment,
  validatePaymentPayload,
} = require('../booking-service');
const { transactionMutex } = require('../database');
const db = require('../db/connection');
const {
  sendBookingCompletedEmail,
  sendBookingConfirmationEmail,
} = require('../email-service');

const DISCOUNTED_USER_TYPES = new Set(['student', 'senior']);
const FREQUENT_USER_HOURS_THRESHOLD = 8;
const DISCOUNT_MULTIPLIER = 0.8;

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

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

    const baseTotalPrice = scooter[pricingColumnMap[durationCode]];

    if (
      typeof baseTotalPrice !== 'number' ||
      !Number.isFinite(baseTotalPrice) ||
      baseTotalPrice < 0
    ) {
      console.error(
        `POST /api/bookings: invalid base price for scooter=${scooterId} duration=${durationCode}`
      );
      return res.status(500).json({
        success: false,
        error: 'Failed to determine booking price.',
      });
    }

    const userType =
      typeof user.user_type === 'string' ? user.user_type : 'standard';

    let weeklyHours = 0;

    try {
      weeklyHours = await calculateWeeklyUserHours({
        dbAll,
        userId: user.id,
      });
    } catch (weeklyHoursError) {
      console.error(
        `POST /api/bookings: failed to compute weekly hours for userId=${user.id}:`,
        weeklyHoursError
      );
      throw weeklyHoursError;
    }

    const isDiscountedUserType = DISCOUNTED_USER_TYPES.has(userType);
    const isFrequentUser = weeklyHours >= FREQUENT_USER_HOURS_THRESHOLD;
    const discountApplied = isDiscountedUserType || isFrequentUser;

    const originalPrice = roundToTwoDecimals(baseTotalPrice);
    const totalPrice = discountApplied
      ? roundToTwoDecimals(baseTotalPrice * DISCOUNT_MULTIPLIER)
      : originalPrice;

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
        transactionMutex,
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

    const responseData = {
      ...mapBookingRow(createdBooking),
      paymentStatus: paymentResult.value.paymentStatus,
      paymentReference: paymentResult.value.paymentReference,
      scooterStatus: 'in_use',
      discountApplied,
      originalPrice,
    };

    void sendBookingConfirmationEmail({
      user,
      booking: responseData,
    });

    return res.status(201).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('POST /api/bookings failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create booking.',
    });
  }
});

// ---------------------------------------------------------------------------
// ID 12: Cancel booking
// ---------------------------------------------------------------------------

const DURATION_RANK = { oneHour: 0, fourHours: 1, oneDay: 2, oneWeek: 3 };

router.patch('/bookings/:bookingId/cancel', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    const bookingId = Number(req.params.bookingId);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID.',
      });
    }

    const booking = await dbGet(
      'SELECT id, user_id, scooter_id, status FROM bookings WHERE id = ?;',
      [bookingId]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found.',
      });
    }

    if (booking.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only cancel your own bookings.',
      });
    }

    if (booking.status !== 'active') {
      return res.status(409).json({
        success: false,
        error: 'Only active bookings can be cancelled.',
      });
    }

    await transactionMutex.runExclusive(async () => {
      await dbRun('BEGIN TRANSACTION');

      try {
        await dbRun(
          `UPDATE bookings
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?;`,
          [bookingId]
        );

        await dbRun(
          `UPDATE scooters
           SET status = 'available', updated_at = CURRENT_TIMESTAMP
           WHERE scooter_id = ?;`,
          [booking.scooter_id]
        );

        await dbRun('COMMIT');
      } catch (txError) {
        try {
          await dbRun('ROLLBACK');
        } catch (rollbackError) {
          console.error(
            'Cancel booking transaction rollback failed:',
            rollbackError
          );
        }
        throw txError;
      }
    });

    const updated = await dbGet(
      `SELECT id, scooter_id, duration_code, total_price, status,
              created_at, updated_at
       FROM bookings WHERE id = ?;`,
      [bookingId]
    );

    const responseData = mapBookingRow(updated);

    void sendBookingCompletedEmail({
      user,
      booking: responseData,
    });

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('PATCH /api/bookings/:bookingId/cancel failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel booking.',
    });
  }
});

// ---------------------------------------------------------------------------
// ID 11: Extend current booking
// ---------------------------------------------------------------------------

router.patch('/bookings/:bookingId/extend', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    const bookingId = Number(req.params.bookingId);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID.',
      });
    }

    const newDurationCode = normalizeText(req.body?.newDurationCode);

    if (!durationCodes.includes(newDurationCode)) {
      return res.status(400).json({
        success: false,
        error: `New duration code must be one of: ${durationCodes.join(', ')}.`,
      });
    }

    const booking = await dbGet(
      `SELECT id, user_id, scooter_id, duration_code, total_price, status
       FROM bookings WHERE id = ?;`,
      [bookingId]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found.',
      });
    }

    if (booking.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only extend your own bookings.',
      });
    }

    if (booking.status !== 'active') {
      return res.status(409).json({
        success: false,
        error: 'Only active bookings can be extended.',
      });
    }

    if (
      (DURATION_RANK[newDurationCode] ?? -1) <=
      (DURATION_RANK[booking.duration_code] ?? -1)
    ) {
      return res.status(400).json({
        success: false,
        error: 'New duration must be longer than the current hire plan.',
      });
    }

    const scooterPricing = await getScooterPricingSnapshot(booking.scooter_id);

    if (!scooterPricing) {
      return res.status(404).json({
        success: false,
        error: 'Scooter pricing not found.',
      });
    }

    const newTotalPrice = scooterPricing[pricingColumnMap[newDurationCode]];

    await dbRun(
      `UPDATE bookings
       SET duration_code = ?, total_price = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [newDurationCode, newTotalPrice, bookingId]
    );

    const updated = await dbGet(
      `SELECT id, scooter_id, duration_code, total_price, status,
              created_at, updated_at
       FROM bookings WHERE id = ?;`,
      [bookingId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...mapBookingRow(updated),
        previousDuration: booking.duration_code,
        previousPrice: booking.total_price,
      },
    });
  } catch (error) {
    console.error('PATCH /api/bookings/:bookingId/extend failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to extend booking.',
    });
  }
});

// ---------------------------------------------------------------------------
// ID 19: Weekly income for rental options (administrator only)
// ---------------------------------------------------------------------------

router.get('/bookings/income/weekly', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    if (!requireAdmin(res, user)) {
      return;
    }

    // Accept optional weekStart query (YYYY-MM-DD); default to current Monday
    let weekStart;
    const qsWeekStart = normalizeText(req.query?.weekStart);

    if (/^\d{4}-\d{2}-\d{2}$/.test(qsWeekStart)) {
      weekStart = qsWeekStart;
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      weekStart = monday.toISOString().slice(0, 10);
    }

    // weekEnd = weekStart + 7 days (exclusive upper bound)
    const weekEndDate = new Date(`${weekStart}T00:00:00Z`);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
    const weekEnd = weekEndDate.toISOString().slice(0, 10);

    const rows = await dbAll(
      `SELECT duration_code,
              SUM(total_price) AS total_income,
              COUNT(*)         AS booking_count
       FROM bookings
       WHERE date(created_at) >= ? AND date(created_at) < ?
       GROUP BY duration_code;`,
      [weekStart, weekEnd]
    );

    const income = {
      oneHour: 0,
      fourHours: 0,
      oneDay: 0,
      oneWeek: 0,
    };

    const counts = {
      oneHour: 0,
      fourHours: 0,
      oneDay: 0,
      oneWeek: 0,
    };

    for (const row of rows) {
      if (income.hasOwnProperty(row.duration_code)) {
        income[row.duration_code] = row.total_income;
        counts[row.duration_code] = row.booking_count;
      }
    }

    const grandTotal =
      income.oneHour + income.fourHours + income.oneDay + income.oneWeek;

    return res.status(200).json({
      success: true,
      data: {
        weekStart,
        weekEnd,
        income,
        counts,
        grandTotal,
      },
    });
  } catch (error) {
    console.error('GET /api/bookings/income/weekly failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly income.',
    });
  }
});

// ---------------------------------------------------------------------------
// Admin bookings oversight: every booking, optionally filtered by status,
// scooter, or user. Restricted to administrator accounts so individual rider
// histories are never exposed to non-admin users.
// ---------------------------------------------------------------------------

const ALLOWED_OVERSIGHT_STATUSES = new Set(['active', 'completed']);

router.get('/admin/bookings', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);

    if (!user) {
      return;
    }

    if (!requireAdmin(res, user)) {
      return;
    }

    const filters = [];
    const params = [];
    const rawStatus = normalizeText(req.query?.status);
    const rawScooterId = normalizeId(req.query?.scooterId);
    const rawUserIdInput = req.query?.userId;

    if (rawStatus) {
      if (!ALLOWED_OVERSIGHT_STATUSES.has(rawStatus)) {
        return res.status(400).json({
          success: false,
          error: `Status filter must be one of: ${[...ALLOWED_OVERSIGHT_STATUSES].join(', ')}.`,
        });
      }
      filters.push('b.status = ?');
      params.push(rawStatus);
    }

    if (rawScooterId) {
      filters.push('b.scooter_id = ?');
      params.push(rawScooterId);
    }

    if (
      rawUserIdInput !== undefined &&
      rawUserIdInput !== null &&
      rawUserIdInput !== ''
    ) {
      const numericUserId = Number(rawUserIdInput);

      if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'userId filter must be a positive integer.',
        });
      }

      filters.push('b.user_id = ?');
      params.push(numericUserId);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await dbAll(
      `
        SELECT
          b.id,
          b.user_id,
          b.scooter_id,
          b.duration_code,
          b.total_price,
          b.status,
          b.created_at,
          b.updated_at,
          u.full_name AS user_full_name,
          u.email     AS user_email
        FROM bookings b
        LEFT JOIN users u ON u.id = b.user_id
        ${whereSql}
        ORDER BY b.created_at DESC, b.id DESC;
      `,
      params
    );

    const data = rows.map((row) => ({
      ...mapBookingRow(row),
      userId: row.user_id,
      userFullName: row.user_full_name || null,
      userEmail: row.user_email || null,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET /api/admin/bookings failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings overview.',
    });
  }
});

module.exports = router;
