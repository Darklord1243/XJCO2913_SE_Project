const crypto = require('node:crypto');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

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
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    createdAt: user.created_at,
  };
}

function createSessionToken(user) {
  const payload = JSON.stringify({
    email: user.email,
    issuedAt: new Date().toISOString(),
    userId: user.id,
  });

  return Buffer.from(payload, 'utf8').toString('base64url');
}

module.exports = {
  createSessionToken,
  hashPassword,
  toPublicUser,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
};
