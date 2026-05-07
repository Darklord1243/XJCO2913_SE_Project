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
});
