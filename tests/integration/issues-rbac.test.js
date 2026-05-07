const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const { authHeader, setupTestApp, teardownTestApp } = require('./setup');

describe('HTTP integration: issues staff RBAC', () => {
  let app;
  let tokens;
  let issueId;

  before(async () => {
    ({ app, tokens } = await setupTestApp());

    const created = await request(app)
      .post('/api/issues')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-001',
        description: 'Broken brake lever (integration test).',
      });

    assert.equal(created.status, 201);
    issueId = created.body.data.id;
    assert.ok(Number.isInteger(issueId));
  });

  after(async () => {
    await teardownTestApp();
  });

  test('POST /api/issues 201 for authenticated rider', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        description: 'Loose handlebar (integration test).',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(Number.isInteger(res.body.data.id));
    assert.equal(res.body.data.userId, 2);
  });

  test('GET /api/issues 401 without token', async () => {
    const res = await request(app).get('/api/issues');
    assert.equal(res.status, 401);
  });

  test('GET /api/issues 403 for rider', async () => {
    const res = await request(app)
      .get('/api/issues')
      .set(authHeader(tokens.rider));
    assert.equal(res.status, 403);
  });

  test('GET /api/issues 200 for staff', async () => {
    const res = await request(app)
      .get('/api/issues')
      .set(authHeader(tokens.staff));

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((issue) => issue.id === issueId));
  });

  test('GET /api/issues 200 for admin', async () => {
    const res = await request(app)
      .get('/api/issues')
      .set(authHeader(tokens.admin));

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('PATCH issue priority / status 401 without token', async () => {
    const p1 = await request(app)
      .patch(`/api/issues/${issueId}/priority`)
      .send({ priority: 'high' });
    assert.equal(p1.status, 401);

    const s1 = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .send({ status: 'resolved' });
    assert.equal(s1.status, 401);
  });

  test('PATCH issue priority / status – rider 403; staff & admin 200', async () => {
    const prRider = await request(app)
      .patch(`/api/issues/${issueId}/priority`)
      .set(authHeader(tokens.rider))
      .send({ priority: 'high' });
    assert.equal(prRider.status, 403);

    const prStaff = await request(app)
      .patch(`/api/issues/${issueId}/priority`)
      .set(authHeader(tokens.staff))
      .send({ priority: 'high' });
    assert.equal(prStaff.status, 200);

    const stRider = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set(authHeader(tokens.rider))
      .send({ status: 'resolved' });
    assert.equal(stRider.status, 403);

    const stAdmin = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set(authHeader(tokens.admin))
      .send({ status: 'resolved' });
    assert.equal(stAdmin.status, 200);
    assert.equal(stAdmin.body.data.status, 'resolved');
  });
});
