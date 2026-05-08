const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const { authHeader, setupTestApp, teardownTestApp } = require('./setup');

describe('HTTP integration: auth + admin RBAC', () => {
  let app;
  let tokens;

  before(async () => {
    ({ app, tokens } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  test('POST /api/auth/register does not allow self-registering as admin', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Bad Actor',
      email: 'badactor@test.local',
      password: 'Password12!',
      confirmPassword: 'Password12!',
      userType: 'admin',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.userType, 'standard');

    // The route also issues a token in this response. That token MUST be
    // a standard-tier session, not an admin one. We verify by attempting
    // an admin-only request: a true admin would return 200; a standard
    // session must come back as 403 (authenticated but not authorized).
    const token = res.body.data.token;
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0);

    const adminRes = await request(app)
      .get('/api/admin/bookings')
      .set(authHeader(token));
    assert.equal(
      adminRes.status,
      403,
      'self-registered admin attempt must not yield admin-tier session'
    );
  });

  test('POST /api/auth/register happy path returns a usable token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Happy Path Rider',
      email: 'happy-rider@test.local',
      password: 'HappyPass123!',
      confirmPassword: 'HappyPass123!',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.userType, 'standard');
    assert.equal(res.body.data.user.email, 'happy-rider@test.local');

    const token = res.body.data.token;
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0, 'register response must include a token');

    // "Usable" = the auth middleware accepts it. Hitting an admin-only
    // endpoint and observing 403 (not 401) proves the token authenticated
    // successfully and only the RBAC layer rejected the request.
    const adminRes = await request(app)
      .get('/api/admin/bookings')
      .set(authHeader(token));
    assert.equal(
      adminRes.status,
      403,
      'newly registered token must authenticate (no 401) but not authorize as admin'
    );
  });

  test('POST /api/auth/login rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'rider@test.local',
      password: 'DefinitelyWrong123!',
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/auth/login succeeds for seeded rider', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'rider@test.local',
      password: 'RiderPass123!',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.email, 'rider@test.local');
  });

  test('GET /api/admin/bookings without token returns 401', async () => {
    const res = await request(app).get('/api/admin/bookings');

    assert.equal(res.status, 401);
  });

  test('GET /api/admin/bookings with rider token returns 403', async () => {
    const res = await request(app)
      .get('/api/admin/bookings')
      .set(authHeader(tokens.rider));

    assert.equal(res.status, 403);
  });

  test('GET /api/admin/bookings with admin token returns 200', async () => {
    const res = await request(app)
      .get('/api/admin/bookings')
      .set(authHeader(tokens.admin));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });
});
