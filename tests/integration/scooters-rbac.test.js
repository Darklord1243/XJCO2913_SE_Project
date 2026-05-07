const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const {
  authHeader,
  SAMPLE_PAYMENT,
  setupTestApp,
  teardownTestApp,
} = require('./setup');

const validScooterBody = (id) => ({
  scooterId: id,
  status: 'available',
  location: {
    latitude: 53.8,
    longitude: -1.55,
    description: 'Test location',
  },
  pricing: {
    oneHour: 5,
    fourHours: 15,
    oneDay: 30,
    oneWeek: 120,
  },
});

describe('HTTP integration: scooters + retire', () => {
  let app;
  let tokens;

  before(async () => {
    ({ app, tokens } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  test('GET /api/scooters is public and returns seed rows', async () => {
    const res = await request(app).get('/api/scooters');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const ids = res.body.data.map((s) => s.scooterId);
    assert.ok(ids.includes('ESC-001'));
    assert.ok(ids.includes('ESC-002'));
    assert.ok(ids.includes('ESC-003'));
  });

  test('GET /api/admin/scooters 401 / 403 / 200', async () => {
    const n1 = await request(app).get('/api/admin/scooters');
    assert.equal(n1.status, 401);

    const n2 = await request(app)
      .get('/api/admin/scooters')
      .set(authHeader(tokens.rider));
    assert.equal(n2.status, 403);

    const res = await request(app)
      .get('/api/admin/scooters')
      .set(authHeader(tokens.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
  });

  test('POST /api/scooters 401 / 403 / 400 / 201 / 409', async () => {
    const a1 = await request(app)
      .post('/api/scooters')
      .send(validScooterBody('ESC-900'));
    assert.equal(a1.status, 401);

    const a2 = await request(app)
      .post('/api/scooters')
      .set(authHeader(tokens.rider))
      .send(validScooterBody('ESC-900'));
    assert.equal(a2.status, 403);

    const bad = await request(app)
      .post('/api/scooters')
      .set(authHeader(tokens.admin))
      .send({
        ...validScooterBody('BAD'),
        scooterId: 'xx',
      });
    assert.equal(bad.status, 400);

    const ok = await request(app)
      .post('/api/scooters')
      .set(authHeader(tokens.admin))
      .send(validScooterBody('ESC-900'));
    assert.equal(ok.status, 201);

    const dup = await request(app)
      .post('/api/scooters')
      .set(authHeader(tokens.admin))
      .send(validScooterBody('ESC-900'));
    assert.equal(dup.status, 409);
  });

  test('PUT /api/scooters/:id 401 / 403 / 404 / 200', async () => {
    const u1 = await request(app)
      .put('/api/scooters/ESC-001')
      .send(validScooterBody('ESC-001'));
    assert.equal(u1.status, 401);

    const u2 = await request(app)
      .put('/api/scooters/ESC-001')
      .set(authHeader(tokens.rider))
      .send(validScooterBody('ESC-001'));
    assert.equal(u2.status, 403);

    const nf = await request(app)
      .put('/api/scooters/ESC-999')
      .set(authHeader(tokens.admin))
      .send(validScooterBody('ESC-999'));
    assert.equal(nf.status, 404);

    const ok = await request(app)
      .put('/api/scooters/ESC-001')
      .set(authHeader(tokens.admin))
      .send(validScooterBody('ESC-001'));
    assert.equal(ok.status, 200);
  });

  test('DELETE retire removes scooter from rider list; admin still sees it', async () => {
    const retire = await request(app)
      .delete('/api/scooters/ESC-003')
      .set(authHeader(tokens.admin));
    assert.equal(retire.status, 200);
    assert.equal(retire.body.data.status, 'retired');

    const riderList = await request(app).get('/api/scooters');
    const riderIds = riderList.body.data.map((s) => s.scooterId);
    assert.ok(!riderIds.includes('ESC-003'));

    const adminList = await request(app)
      .get('/api/admin/scooters')
      .set(authHeader(tokens.admin));
    const retired = adminList.body.data.find((s) => s.scooterId === 'ESC-003');
    assert.ok(retired);
    assert.equal(retired.status, 'retired');
  });

  test('DELETE already-retired scooter returns 409', async () => {
    const res = await request(app)
      .delete('/api/scooters/ESC-003')
      .set(authHeader(tokens.admin));
    assert.equal(res.status, 409);
    assert.match(
      res.body.error || '',
      /already retired/i,
      'B3 spec requires the "already retired" message'
    );
  });

  test('DELETE unknown scooter returns 404', async () => {
    const res = await request(app)
      .delete('/api/scooters/ESC-999')
      .set(authHeader(tokens.admin));
    assert.equal(res.status, 404);
  });

  test('DELETE while in_use returns 409', async () => {
    const bookRes = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        payment: SAMPLE_PAYMENT,
      });
    assert.equal(bookRes.status, 201);

    const del = await request(app)
      .delete('/api/scooters/ESC-002')
      .set(authHeader(tokens.admin));
    assert.equal(del.status, 409);
    assert.match(
      del.body.error || '',
      /currently in use/i,
      'B3 spec requires the "currently in use" message'
    );

    const bookingId = bookRes.body.data.bookingId;
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set(authHeader(tokens.rider));
    assert.equal(cancelRes.status, 200);
  });

  test('DELETE /api/scooters 401 / 403', async () => {
    const d1 = await request(app).delete('/api/scooters/ESC-001');
    assert.equal(d1.status, 401);

    const d2 = await request(app)
      .delete('/api/scooters/ESC-001')
      .set(authHeader(tokens.rider));
    assert.equal(d2.status, 403);
  });
});
