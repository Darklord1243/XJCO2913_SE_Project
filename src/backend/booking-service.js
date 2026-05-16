const crypto = require('node:crypto');

const SUPPORTED_SUCCESS_CARD = '4242424242424242';
const SUPPORTED_DECLINE_CARD = '4000000000000002';
const SIMULATOR_CARD_NUMBERS = [SUPPORTED_SUCCESS_CARD, SUPPORTED_DECLINE_CARD];

const DISCOUNTED_USER_TYPES = new Set(['student', 'senior']);
const FREQUENT_USER_HOURS_THRESHOLD = 8;
const DISCOUNT_MULTIPLIER = 0.8;

// ---------------------------------------------------------------------------
// ID2/ID3: Card storage helpers (coursework simulation only)
// ---------------------------------------------------------------------------
// HMAC-SHA256 of the normalised PAN (secret from env). Legacy plain SHA-256
// hashes are still recognised when resolving saved cards. In production the
// PAN would never touch our servers — a PSP token + last4 would be stored.

function getCardHashSecret() {
  const secret = process.env.CARD_HASH_SECRET;

  if (typeof secret === 'string' && secret.trim() !== '') {
    return secret.trim();
  }

  return 'escooter-dev-card-hash-v1';
}

function hashCardPanLegacy(cardNumber) {
  const normalised = String(cardNumber).replace(/\s+/g, '');
  return crypto.createHash('sha256').update(normalised).digest('hex');
}

function hashCardPan(cardNumber) {
  const normalised = String(cardNumber).replace(/\s+/g, '');
  return crypto
    .createHmac('sha256', getCardHashSecret())
    .update(normalised)
    .digest('hex');
}

function isSimulatorSupportedPan(cardNumber) {
  const normalised = String(cardNumber).replace(/\s+/g, '');
  return SIMULATOR_CARD_NUMBERS.includes(normalised);
}

function resolveSimulatorPanFromHash(cardHash) {
  if (typeof cardHash !== 'string' || cardHash.trim() === '') {
    return null;
  }

  for (const pan of SIMULATOR_CARD_NUMBERS) {
    if (hashCardPan(pan) === cardHash || hashCardPanLegacy(pan) === cardHash) {
      return pan;
    }
  }

  return null;
}

function validateCvv(cvv) {
  const normalized = normalizeText(cvv);

  if (!/^\d{3,4}$/.test(normalized)) {
    return {
      ok: false,
      message: 'CVV must contain 3 or 4 digits.',
    };
  }

  return { ok: true, value: normalized };
}

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function computeBookingPricing({ userType, weeklyHours, baseTotalPrice }) {
  const normalizedType = typeof userType === 'string' ? userType : 'standard';
  const safeWeeklyHours =
    typeof weeklyHours === 'number' && Number.isFinite(weeklyHours)
      ? Math.max(0, weeklyHours)
      : 0;

  if (
    typeof baseTotalPrice !== 'number' ||
    !Number.isFinite(baseTotalPrice) ||
    baseTotalPrice < 0
  ) {
    throw new TypeError(
      'computeBookingPricing requires a non-negative baseTotalPrice.'
    );
  }

  const isDiscountedUserType = DISCOUNTED_USER_TYPES.has(normalizedType);
  const isFrequentUser = safeWeeklyHours >= FREQUENT_USER_HOURS_THRESHOLD;
  const discountApplied = isDiscountedUserType || isFrequentUser;

  let discountReason = null;

  if (discountApplied) {
    if (isDiscountedUserType) {
      discountReason = normalizedType;
    } else {
      discountReason = 'frequent';
    }
  }

  const originalPrice = roundToTwoDecimals(baseTotalPrice);
  const totalPrice = discountApplied
    ? roundToTwoDecimals(baseTotalPrice * DISCOUNT_MULTIPLIER)
    : originalPrice;

  return {
    originalPrice,
    totalPrice,
    discountApplied,
    discountReason,
    weeklyHours: safeWeeklyHours,
    frequentUserHoursThreshold: FREQUENT_USER_HOURS_THRESHOLD,
    hoursUntilFrequentDiscount: Math.max(
      0,
      FREQUENT_USER_HOURS_THRESHOLD - safeWeeklyHours
    ),
  };
}

function extractLast4(cardNumber) {
  const normalised = String(cardNumber).replace(/\s+/g, '');
  return normalised.slice(-4);
}

function detectCardBrand(cardNumber) {
  const normalised = String(cardNumber).replace(/\s+/g, '');
  if (/^4\d{15}$/.test(normalised)) return 'Visa';
  if (/^5[1-5]\d{14}$/.test(normalised)) return 'Mastercard';
  if (/^3[47]\d{13}$/.test(normalised)) return 'Amex';
  if (/^6011\d{12}$/.test(normalised)) return 'Discover';
  return null;
}

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
  SUPPORTED_DECLINE_CARD,
  SUPPORTED_SUCCESS_CARD,
  calculateWeeklyUserHours,
  computeBookingPricing,
  createBookingInTransaction,
  detectCardBrand,
  durationCodes,
  durationHoursMap,
  extractLast4,
  FREQUENT_USER_HOURS_THRESHOLD,
  hashCardPan,
  hashCardPanLegacy,
  isSimulatorSupportedPan,
  normalizeId,
  normalizeText,
  pricingColumnMap,
  resolveSimulatorPanFromHash,
  simulatePayment,
  validateCvv,
  validatePaymentPayload,
};
