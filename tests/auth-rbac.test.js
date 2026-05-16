const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALL_USER_TYPES,
  PRIVILEGED_USER_TYPES,
  REGULAR_USER_TYPES,
  hasStaffAccess,
  isAdmin,
  isSelfRegistrableUserType,
  normalizeUserType,
} = require('../src/backend/roles');

const {
  createSessionToken,
  parseSessionToken,
  toPublicUser,
  validateLoginInput,
  validateRegistrationInput,
} = require('../src/backend/auth-service');

test('roles: canonical sets are mutually consistent', () => {
  for (const type of REGULAR_USER_TYPES) {
    assert.ok(
      ALL_USER_TYPES.has(type),
      `regular type ${type} should be in ALL_USER_TYPES`
    );
    assert.ok(
      !PRIVILEGED_USER_TYPES.has(type),
      `regular type ${type} should not be in PRIVILEGED_USER_TYPES`
    );
  }

  for (const type of PRIVILEGED_USER_TYPES) {
    assert.ok(
      ALL_USER_TYPES.has(type),
      `privileged type ${type} should be in ALL_USER_TYPES`
    );
  }
});

test('roles: isAdmin only matches admin role', () => {
  assert.equal(isAdmin({ user_type: 'admin' }), true);
  assert.equal(isAdmin({ userType: 'admin' }), true);
  assert.equal(isAdmin({ user_type: 'staff' }), false);
  assert.equal(isAdmin({ user_type: 'standard' }), false);
  assert.equal(isAdmin({}), false);
  assert.equal(isAdmin(null), false);
});

test('roles: hasStaffAccess admits staff and admin only', () => {
  assert.equal(hasStaffAccess({ user_type: 'admin' }), true);
  assert.equal(hasStaffAccess({ user_type: 'staff' }), true);
  assert.equal(hasStaffAccess({ user_type: 'standard' }), false);
  assert.equal(hasStaffAccess({ user_type: 'student' }), false);
  assert.equal(hasStaffAccess({ user_type: 'senior' }), false);
  assert.equal(hasStaffAccess(null), false);
});

test('roles: normalizeUserType falls back to standard for unknown values', () => {
  assert.equal(normalizeUserType('admin'), 'admin');
  assert.equal(normalizeUserType('staff'), 'staff');
  assert.equal(normalizeUserType('student'), 'student');
  assert.equal(normalizeUserType('walkin'), 'walkin');
  assert.equal(normalizeUserType('Admin'), 'standard');
  assert.equal(normalizeUserType('superuser'), 'standard');
  assert.equal(normalizeUserType(undefined), 'standard');
});

test('roles: isSelfRegistrableUserType blocks privileged roles', () => {
  assert.equal(isSelfRegistrableUserType('standard'), true);
  assert.equal(isSelfRegistrableUserType('student'), true);
  assert.equal(isSelfRegistrableUserType('senior'), true);
  assert.equal(isSelfRegistrableUserType('staff'), false);
  assert.equal(isSelfRegistrableUserType('admin'), false);
  assert.equal(isSelfRegistrableUserType(''), false);
});

test('auth-service: validateRegistrationInput rejects mismatched confirmPassword', () => {
  const result = validateRegistrationInput({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword2',
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /do not match/i);
});

test('auth-service: validateRegistrationInput accepts a valid payload (no confirm)', () => {
  const result = validateRegistrationInput({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'StrongPassword1',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.email, 'ada@example.com');
});

test('auth-service: validateRegistrationInput accepts a matching confirmPassword', () => {
  const result = validateRegistrationInput({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
  });

  assert.equal(result.ok, true);
});

test('auth-service: validateRegistrationInput rejects short passwords', () => {
  const result = validateRegistrationInput({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'short',
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /at least 8/);
});

test('auth-service: validateLoginInput rejects empty password', () => {
  const result = validateLoginInput({ email: 'ada@example.com', password: '' });
  assert.equal(result.ok, false);
});

test('auth-service: parseSessionToken preserves admin role', () => {
  const adminUser = {
    id: 1,
    full_name: 'Admin',
    email: 'admin@example.com',
    user_type: 'admin',
    created_at: new Date().toISOString(),
  };

  const token = createSessionToken(adminUser);
  const parsed = parseSessionToken(token);

  assert.ok(parsed);
  assert.equal(parsed.userId, 1);
  assert.equal(parsed.email, 'admin@example.com');
  assert.equal(parsed.userType, 'admin');
});

test('auth-service: parseSessionToken normalizes unknown role to standard', () => {
  const sneakyPayload = JSON.stringify({
    email: 'evil@example.com',
    issuedAt: new Date().toISOString(),
    userId: 99,
    userType: 'superuser',
  });
  const token = Buffer.from(sneakyPayload, 'utf8').toString('base64url');

  const parsed = parseSessionToken(token);

  assert.ok(parsed);
  assert.equal(parsed.userType, 'standard');
});

test('auth-service: parseSessionToken rejects malformed tokens', () => {
  assert.equal(parseSessionToken(''), null);
  assert.equal(parseSessionToken('notbase64'), null);
  assert.equal(parseSessionToken(undefined), null);
  assert.equal(parseSessionToken(null), null);
});

test('auth-service: toPublicUser preserves admin role', () => {
  const publicUser = toPublicUser({
    id: 5,
    full_name: 'Admin',
    email: 'admin@example.com',
    user_type: 'admin',
    created_at: '2024-01-01T00:00:00Z',
  });

  assert.equal(publicUser.userType, 'admin');
  assert.equal(publicUser.id, 5);
  assert.equal(publicUser.fullName, 'Admin');
});

test('auth-service: toPublicUser preserves staff role', () => {
  const publicUser = toPublicUser({
    id: 6,
    full_name: 'Operator',
    email: 'ops@example.com',
    user_type: 'staff',
    created_at: '2024-01-01T00:00:00Z',
  });

  assert.equal(publicUser.userType, 'staff');
});
