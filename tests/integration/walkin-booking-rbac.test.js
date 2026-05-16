const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const {
  authHeader,
  SAMPLE_PAYMENT,
  setupTestApp,
  teardownTestApp,
} = require('./setup');

// ---------------------------------------------------------------------------
// ID 9: Staff walk-in booking — RBAC tests
//
// Each test uses a different scooter (no cancelling — walkin-owned bookings
// cannot be cancelled by staff since the booking belongs to the walkin user
// and walkin users cannot authenticate).
// ---------------------------------------------------------------------------

describe('HTTP integration: walk-in booking RBAC', () => {
  let app;
  let tokens;

  before(async () => {
    ({ app, tokens } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  test('POST /api/admin/bookings 403 for rider (requireStaff)', async () => {
    const res = await request(app)
      .post('/api/admin/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });

    assert.equal(res.status, 403);
  });

  test('POST /api/admin/bookings 201 for staff with guest email', async () => {
    const res = await request(app)
      .post('/api/admin/bookings')
      .set(authHeader(tokens.staff))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
        guestName: 'Walk-in Tester',
        guestEmail: 'walkin-test@test.local',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.bookingId === 'number');
    assert.equal(res.body.data.discountApplied, false);
  });

  test('POST /api/admin/bookings 201 for admin (staff superset)', async () => {
    const res = await request(app)
      .post('/api/admin/bookings')
      .set(authHeader(tokens.admin))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
        guestName: 'Admin Walk-in',
        guestEmail: 'admin-walkin@test.local',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });

  test('POST /api/admin/bookings 201 for staff without guest email (internal placeholder)', async () => {
    // ESC-001 and ESC-002 were already booked above; create a fresh available scooter
    const createScooterRes = await request(app)
      .post('/api/scooters')
      .set(authHeader(tokens.admin))
      .send({
        scooterId: 'ESC-014',
        status: 'available',
        location: {
          latitude: 53.8,
          longitude: -1.55,
          description: 'Test scooter',
        },
        pricing: { oneHour: 5, fourHours: 15, oneDay: 30, oneWeek: 120 },
      });
    assert.equal(createScooterRes.status, 201);

    const res = await request(app)
      .post('/api/admin/bookings')
      .set(authHeader(tokens.staff))
      .send({
        scooterId: 'ESC-014',
        durationCode: 'fourHours',
        payment: SAMPLE_PAYMENT,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });

  test('walkin user cannot log in via POST /api/auth/login', async () => {
    // The walkin user should have been created by the first staff booking test
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'walkin-test@test.local',
      password: 'any-password-will-fail',
    });

    assert.equal(loginRes.status, 401);
    assert.match(
      loginRes.body.message || '',
      /walk-in accounts cannot log in/i
    );
  });
});
