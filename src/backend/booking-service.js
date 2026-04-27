const SUPPORTED_SUCCESS_CARD = '4242424242424242';
const SUPPORTED_DECLINE_CARD = '4000000000000002';

const durationCodes = ['oneHour', 'fourHours', 'oneDay', 'oneWeek'];
const pricingColumnMap = {
  oneHour: 'one_hour',
  fourHours: 'four_hours',
  oneDay: 'one_day',
  oneWeek: 'one_week',
};
const durationHoursMap = {
  oneHour: 1,
  fourHours: 4,
  oneDay: 24,
  oneWeek: 168,
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeId(value) {
  return normalizeText(value).toUpperCase();
}

function validatePaymentPayload(payment) {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
    return {
      ok: false,
      message: 'Payment details are required.',
    };
  }

  const cardholderName = normalizeText(payment.cardholderName);

  if (!cardholderName) {
    return {
      ok: false,
      message: 'Cardholder name is required.',
    };
  }

  const cardNumber = normalizeText(payment.cardNumber).replace(/\s+/g, '');

  if (!/^\d{16}$/.test(cardNumber)) {
    return {
      ok: false,
      message: 'Card number must contain exactly 16 digits.',
    };
  }

  const expiryDate = normalizeText(payment.expiryDate);
  const expiryMatch = expiryDate.match(/^(\d{2})\/(\d{2})$/);

  if (!expiryMatch) {
    return {
      ok: false,
      message: 'Expiry date must use MM/YY format.',
    };
  }

  const expiryMonth = Number(expiryMatch[1]);

  if (expiryMonth < 1 || expiryMonth > 12) {
    return {
      ok: false,
      message: 'Expiry month must be between 01 and 12.',
    };
  }

  const cvv = normalizeText(payment.cvv);

  if (!/^\d{3,4}$/.test(cvv)) {
    return {
      ok: false,
      message: 'CVV must contain 3 or 4 digits.',
    };
  }

  return {
    ok: true,
    value: {
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
    },
  };
}

function simulatePayment(payment) {
  if (payment.cardNumber === SUPPORTED_DECLINE_CARD) {
    return {
      ok: false,
      statusCode: 402,
      message: 'Payment was declined by the simulator.',
    };
  }

  if (payment.cardNumber !== SUPPORTED_SUCCESS_CARD) {
    return {
      ok: false,
      statusCode: 400,
      message:
        'Unsupported simulator card. Use 4242424242424242 or 4000000000000002.',
    };
  }

  return {
    ok: true,
    value: {
      paymentReference: `PAY-${Date.now()}-${payment.cardNumber.slice(-4)}`,
      paymentStatus: 'paid',
    },
  };
}

function buildClientError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.clientMessage = message;
  return error;
}

/**
 * Atomically reserves the scooter (available -> in_use) and inserts the booking row.
 * Expects dbRun/dbGet to target a single SQLite connection so BEGIN/COMMIT/ROLLBACK apply.
 */
async function createBookingInTransaction({
  dbRun,
  dbGet,
  userId,
  scooterId,
  durationCode,
  totalPrice,
  transactionMutex,
}) {
  const runInLock =
    transactionMutex && typeof transactionMutex.runExclusive === 'function'
      ? (callback) => transactionMutex.runExclusive(callback)
      : async (callback) => callback();

  return runInLock(async () => {
    await dbRun('BEGIN TRANSACTION');

    try {
      const scooterUpdate = await dbRun(
        `
          UPDATE scooters
          SET
            status = 'in_use',
            updated_at = CURRENT_TIMESTAMP
          WHERE scooter_id = ? AND status = 'available';
        `,
        [scooterId]
      );

      if (scooterUpdate.changes !== 1) {
        throw buildClientError(409, 'Scooter is not available for booking.');
      }

      const bookingInsert = await dbRun(
        `
          INSERT INTO bookings (
            user_id,
            scooter_id,
            duration_code,
            total_price,
            status
          )
          VALUES (?, ?, ?, ?, 'active');
        `,
        [userId, scooterId, durationCode, totalPrice]
      );

      const createdBooking = await dbGet(
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
          WHERE id = ?;
        `,
        [bookingInsert.lastID]
      );

      if (!createdBooking) {
        throw new Error('Failed to load booking row after insert.');
      }

      await dbRun('COMMIT');

      return createdBooking;
    } catch (error) {
      try {
        await dbRun('ROLLBACK');
      } catch (rollbackError) {
        console.error('Booking transaction rollback failed:', rollbackError);
      }

      throw error;
    }
  });
}

/**
 * Calculates the total hire hours for a user across active/completed bookings
 * created within the last 7 days. Used to evaluate the 'frequent user'
 * discount eligibility (>= 8 hours).
 *
 * Performs strict input validation and ignores rows whose duration_code is
 * not a known mapping, so unexpected DB values cannot inflate totals.
 */
async function calculateWeeklyUserHours({ dbAll, userId } = {}) {
  if (typeof dbAll !== 'function') {
    throw new TypeError('calculateWeeklyUserHours requires a dbAll function.');
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError(
      'calculateWeeklyUserHours requires a positive integer userId.'
    );
  }

  let rows;

  try {
    rows = await dbAll(
      `
        SELECT duration_code
        FROM bookings
        WHERE user_id = ?
          AND status IN ('active', 'completed')
          AND created_at >= datetime('now', '-7 days');
      `,
      [userId]
    );
  } catch (error) {
    console.error(
      `calculateWeeklyUserHours: query failed for userId=${userId}:`,
      error
    );
    throw error;
  }

  if (!Array.isArray(rows)) {
    return 0;
  }

  let totalHours = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const durationCode = row.duration_code;

    if (
      typeof durationCode !== 'string' ||
      !Object.prototype.hasOwnProperty.call(durationHoursMap, durationCode)
    ) {
      continue;
    }

    totalHours += durationHoursMap[durationCode];
  }

  return totalHours;
}

module.exports = {
  calculateWeeklyUserHours,
  createBookingInTransaction,
  durationCodes,
  durationHoursMap,
  normalizeId,
  normalizeText,
  pricingColumnMap,
  simulatePayment,
  validatePaymentPayload,
};
