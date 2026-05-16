const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const {
  authHeader,
  SAMPLE_PAYMENT,
  setupTestApp,
  teardownTestApp,
} = require('./setup');

describe('HTTP integration: bookings + income RBAC', () => {
  let app;
  let tokens;

  before(async () => {
    ({ app, tokens } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  test('GET /api/bookings/income/weekly 401 / 403 / 200', async () => {
    const a1 = await request(app).get('/api/bookings/income/weekly');
    assert.equal(a1.status, 401);

    const a2 = await request(app)
      .get('/api/bookings/income/weekly')
      .set(authHeader(tokens.rider));
    assert.equal(a2.status, 403);

    const res = await request(app)
      .get('/api/bookings/income/weekly')
      .set(authHeader(tokens.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.weekStart === 'string');
    assert.ok(typeof res.body.data.grandTotal === 'number');
  });

  test('GET /api/admin/bookings filters optional query params', async () => {
    const active = await request(app)
      .get('/api/admin/bookings')
      .query({ status: 'completed' })
      .set(authHeader(tokens.admin));
    assert.equal(active.status, 200);

    const bad = await request(app)
      .get('/api/admin/bookings')
      .query({ status: 'bogus' })
      .set(authHeader(tokens.admin));
    assert.equal(bad.status, 400);

    const byScooter = await request(app)
      .get('/api/admin/bookings')
      .query({ scooterId: 'ESC-001' })
      .set(authHeader(tokens.admin));
    assert.equal(byScooter.status, 200);
  });

  test('POST /api/bookings 401 without auth', async () => {
    const res = await request(app).post('/api/bookings').send({
      scooterId: 'ESC-001',
      durationCode: 'oneHour',
      payment: SAMPLE_PAYMENT,
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/bookings 201 for rider when scooter available', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    const cancelRes = await request(app)
      .patch(`/api/bookings/${res.body.data.bookingId}/cancel`)
      .set(authHeader(tokens.rider));
    assert.equal(cancelRes.status, 200);
  });

  test('PATCH /api/bookings/:bookingId/cancel successfully cancels an active booking', async () => {
    // 1) Use the minted standard-user token (tokens.rider from setupTestApp)
    const riderAuth = authHeader(tokens.rider);

    // 2) Create an active booking via the existing HTTP pattern
    const bookRes = await request(app)
      .post('/api/bookings')
      .set(riderAuth)
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });

    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.body.success, true);
    assert.equal(bookRes.body.data.status, 'active');

    // 3) Cancel the booking
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookRes.body.data.bookingId}/cancel`)
      .set(riderAuth);

    // 4) Assert 200 + completed status
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.success, true);
    assert.equal(cancelRes.body.data.status, 'completed');
  });

  test('POST /api/bookings 409 when scooter is retired', async () => {
    await request(app)
      .delete('/api/scooters/ESC-001')
      .set(authHeader(tokens.admin));

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });

    assert.equal(res.status, 409);
    assert.match(res.body.error || '', /not available/i);
  });

  test('sendMailBestEffort does not throw on transport error; booking HTTP 201 is unaffected', async () => {
    const { sendMailBestEffort } = require('../../src/backend/email-service');

    const result = await sendMailBestEffort(
      {
        to: 'rider@test.local',
        subject: 'Test',
        text: 'Test body',
      },
      {
        env: {
          SMTP_USER: 'user@test.local',
          SMTP_PASS: 'secret',
        },
        createTransport: () => ({
          sendMail: async () => {
            throw new Error('ECONNREFUSED');
          },
        }),
      }
    );

    assert.equal(result.sent, false);

    // HTTP booking still returns 201 (email failure is fire-and-forget)
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    // Cancel the booking to free ESC-002 for subsequent tests
    const cancelRes = await request(app)
      .patch(`/api/bookings/${res.body.data.bookingId}/cancel`)
      .set(authHeader(tokens.rider));
    assert.equal(cancelRes.status, 200);
  });

  // -------------------------------------------------------------------------
  // ID 11: Extend booking integration tests
  // -------------------------------------------------------------------------

  test('PATCH /api/bookings/:bookingId/extend 200 with valid longer plan', async () => {
    // Create an active booking
    const bookRes = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });
    assert.equal(bookRes.status, 201);

    const bookingId = bookRes.body.data.bookingId;

    // Extend from oneHour to fourHours
    const extendRes = await request(app)
      .patch(`/api/bookings/${bookingId}/extend`)
      .set(authHeader(tokens.rider))
      .send({ newDurationCode: 'fourHours' });

    assert.equal(extendRes.status, 200);
    assert.equal(extendRes.body.success, true);
    assert.equal(extendRes.body.data.durationCode, 'fourHours');
    assert.ok(
      extendRes.body.data.totalPrice > bookRes.body.data.totalPrice,
      'extended price should be higher'
    );
    assert.equal(extendRes.body.data.previousDuration, 'oneHour');

    // Cleanup: cancel the extended booking
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set(authHeader(tokens.rider));
    assert.equal(cancelRes.status, 200);
  });

  test('PATCH /api/bookings/:bookingId/extend 400 when new plan is shorter or equal', async () => {
    const bookRes = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneDay',
        payment: SAMPLE_PAYMENT,
      });
    assert.equal(bookRes.status, 201);

    const bookingId = bookRes.body.data.bookingId;

    // Try to extend to a shorter plan → 400
    const short = await request(app)
      .patch(`/api/bookings/${bookingId}/extend`)
      .set(authHeader(tokens.rider))
      .send({ newDurationCode: 'oneHour' });

    assert.equal(short.status, 400);
    assert.match(short.body.error || '', /longer/i);

    // Cleanup
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set(authHeader(tokens.rider));
    assert.equal(cancelRes.status, 200);
  });

  test('PATCH /api/bookings/:bookingId/extend 403 for another user', async () => {
    // Rider creates a booking
    const bookRes = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });
    assert.equal(bookRes.status, 201);

    // Staff tries to extend rider's booking → 403
    const extendRes = await request(app)
      .patch(`/api/bookings/${bookRes.body.data.bookingId}/extend`)
      .set(authHeader(tokens.staff))
      .send({ newDurationCode: 'fourHours' });

    assert.equal(extendRes.status, 403);

    // Cleanup: rider cancels their own booking
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookRes.body.data.bookingId}/cancel`)
      .set(authHeader(tokens.rider));
    assert.equal(cancelRes.status, 200);
  });

  // -------------------------------------------------------------------------
  // ID 20: Daily income integration tests
  // -------------------------------------------------------------------------

  test('GET /api/bookings/income/daily 401 / 403 / 200 with valid structure', async () => {
    const unauth = await request(app).get('/api/bookings/income/daily');
    assert.equal(unauth.status, 401);

    const forbidden = await request(app)
      .get('/api/bookings/income/daily')
      .set(authHeader(tokens.rider));
    assert.equal(forbidden.status, 403);

    const res = await request(app)
      .get('/api/bookings/income/daily')
      .set(authHeader(tokens.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.weekStart === 'string');
    assert.ok(typeof res.body.data.weekEnd === 'string');
    assert.equal(res.body.data.days.length, 7);
    assert.ok(typeof res.body.data.grandTotal === 'number');

    // Each day has the expected shape
    for (const day of res.body.data.days) {
      assert.ok(typeof day.date === 'string');
      assert.ok(typeof day.totalIncome === 'number');
      assert.ok(typeof day.bookingCount === 'number');
      assert.ok(day.breakdown && typeof day.breakdown === 'object');
      assert.ok('oneHour' in day.breakdown);
      assert.ok('fourHours' in day.breakdown);
      assert.ok('oneDay' in day.breakdown);
      assert.ok('oneWeek' in day.breakdown);
    }
  });

  test('GET /api/bookings/income/daily rejects non-Monday weekStart', async () => {
    // A Tuesday is not a Monday
    const res = await request(app)
      .get('/api/bookings/income/daily?weekStart=2026-05-12')
      .set(authHeader(tokens.admin));

    assert.equal(res.status, 400);
    assert.match(res.body.error || '', /Monday/i);
  });
});
