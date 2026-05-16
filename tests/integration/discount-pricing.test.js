const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const {
  authHeader,
  SAMPLE_PAYMENT,
  setupTestApp,
  teardownTestApp,
} = require('./setup');

describe('HTTP integration: discount pricing (ID22)', () => {
  let app;
  let tokens;
  let studentToken;

  before(async () => {
    const ctx = await setupTestApp();
    app = ctx.app;
    tokens = ctx.tokens;

    const {
      hashPassword,
      createSessionToken,
    } = require('../../src/backend/auth-service');
    const { createUser } = require('../../src/backend/database');
    const { passwordHash, passwordSalt } = hashPassword('StudentPass123!');
    const student = await createUser({
      fullName: 'Student Rider',
      email: 'student-discount@test.local',
      userType: 'student',
      passwordHash,
      passwordSalt,
    });
    studentToken = createSessionToken(student);
  });

  after(async () => {
    await teardownTestApp();
  });

  test('GET /api/bookings/pricing-preview 401 without auth', async () => {
    const res = await request(app).get('/api/bookings/pricing-preview').query({
      scooterId: 'ESC-001',
      durationCode: 'oneHour',
    });
    assert.equal(res.status, 401);
  });

  test('GET /api/bookings/pricing-preview 200 for standard rider without discount', async () => {
    const res = await request(app)
      .get('/api/bookings/pricing-preview')
      .query({ scooterId: 'ESC-001', durationCode: 'oneHour' })
      .set(authHeader(tokens.rider));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.discountApplied, false);
    assert.equal(res.body.data.originalPrice, res.body.data.totalPrice);
  });

  test('GET /api/bookings/pricing-preview 200 applies student discount', async () => {
    const res = await request(app)
      .get('/api/bookings/pricing-preview')
      .query({ scooterId: 'ESC-001', durationCode: 'oneHour' })
      .set(authHeader(studentToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.discountApplied, true);
    assert.equal(res.body.data.discountReason, 'student');
    assert.ok(res.body.data.totalPrice < res.body.data.originalPrice);
  });

  test('POST /api/bookings applies student discount on create', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(studentToken))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.discountApplied, true);
    assert.equal(res.body.data.discountReason, 'student');
    assert.ok(res.body.data.totalPrice < res.body.data.originalPrice);
  });

  test('PATCH /api/auth/profile updates account type and returns new token', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set(authHeader(tokens.rider))
      .send({ userType: 'senior' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.userType, 'senior');
    assert.ok(res.body.data.token);

    const preview = await request(app)
      .get('/api/bookings/pricing-preview')
      .query({ scooterId: 'ESC-002', durationCode: 'oneHour' })
      .set(authHeader(res.body.data.token));
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.discountReason, 'senior');
  });
});
