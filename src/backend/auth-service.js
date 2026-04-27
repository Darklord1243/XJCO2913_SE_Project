const crypto = require('node:crypto');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const ALLOWED_USER_TYPES = new Set(['standard', 'student', 'senior']);

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password, passwordSalt, expectedHash) {
  const actualHash = crypto
    .scryptSync(password, passwordSalt, 64)
    .toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}

function validateRegistrationInput(payload) {
  const fullName = sanitizeName(payload?.fullName);
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || '');

  if (fullName.length < 2) {
    return {
      ok: false,
      message: 'Full name must contain at least 2 characters.',
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      message: 'Please provide a valid email address.',
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  return {
    ok: true,
    value: { email, fullName, password },
  };
}

function validateLoginInput(payload) {
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || '');

  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      message: 'Please provide a valid email address.',
    };
  }

  if (!password) {
    return {
      ok: false,
      message: 'Password is required.',
    };
  }

  return {
    ok: true,
    value: { email, password },
  };
}

function toPublicUser(user) {
  const normalizedUserType = ALLOWED_USER_TYPES.has(user?.user_type)
    ? user.user_type
    : 'standard';

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    userType: normalizedUserType,
    createdAt: user.created_at,
  };
}

function createSessionToken(user) {
  const normalizedUserType = ALLOWED_USER_TYPES.has(user?.user_type)
    ? user.user_type
    : 'standard';

  const payload = JSON.stringify({
    email: user.email,
    issuedAt: new Date().toISOString(),
    userId: user.id,
    userType: normalizedUserType,
  });

  return Buffer.from(payload, 'utf8').toString('base64url');
}

function parseSessionToken(token) {
  if (typeof token !== 'string' || token.trim() === '') {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(token.trim(), 'base64url').toString('utf8')
    );

    if (
      !payload ||
      !Number.isInteger(payload.userId) ||
      payload.userId <= 0 ||
      typeof payload.email !== 'string' ||
      payload.email.trim() === ''
    ) {
      return null;
    }

    return {
      email: payload.email,
      issuedAt: payload.issuedAt || null,
      userId: payload.userId,
      userType: ALLOWED_USER_TYPES.has(payload.userType)
        ? payload.userType
        : 'standard',
    };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  createSessionToken,
  hashPassword,
  parseSessionToken,
  toPublicUser,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
};
