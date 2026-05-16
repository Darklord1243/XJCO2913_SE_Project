const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');
const request = require('supertest');

const {
  authHeader,
  SAMPLE_PAYMENT,
  setupTestApp,
  teardownTestApp,
} = require('./setup');

const DECLINE_PAYMENT = Object.freeze({
  cardholderName: 'Decline Tester',
  cardNumber: '4000000000000002',
  expiryDate: '12/30',
  cvv: '123',
});

describe('HTTP integration: stored cards RBAC (ID2/ID3)', () => {
  let app;
  let tokens;

  before(async () => {
    ({ app, tokens } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  // -----------------------------------------------------------------------
  // POST /api/cards
  // -----------------------------------------------------------------------

  test('POST /api/cards 401 without auth', async () => {
    const res = await request(app).post('/api/cards').send(SAMPLE_PAYMENT);
    assert.equal(res.status, 401);
  });

  test('POST /api/cards 400 with invalid payment payload', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.rider))
      .send({ cardholderName: '', cardNumber: 'abc', expiryDate: '', cvv: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('POST /api/cards 201 for rider with valid simulator card', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.rider))
      .send({ ...SAMPLE_PAYMENT, isDefault: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.id === 'number');
    assert.equal(res.body.data.cardLast4, '4242');
    assert.equal(res.body.data.cardBrand, 'Visa');
    assert.equal(res.body.data.isDefault, true);
    // Hash must never leak into the response
    assert.equal(res.body.data.cardHash, undefined);
    assert.equal(res.body.warning, undefined);
  });

  test('POST /api/cards 201 with warning for non-simulator PAN', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.rider))
      .send({
        ...SAMPLE_PAYMENT,
        cardNumber: '4111111111111111',
      });
    assert.equal(res.status, 201);
    assert.match(String(res.body.warning || ''), /simulator/i);
  });

  test('POST /api/cards 409 when duplicate card for same user', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.rider))
      .send(SAMPLE_PAYMENT);
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  test('POST /api/cards same card number allowed for different user', async () => {
    // The UNIQUE index is on (user_id, card_hash), so two different users
    // can store the same simulator card independently.
    const res = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.admin))
      .send(SAMPLE_PAYMENT);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.cardLast4, '4242');
  });

  test('POST /api/cards stores isDefault:false faithfully for first card', async () => {
    // Use a unique card — the declined one, stored by a fresh rider who
    // hasn't saved any card yet (the admin test above failed to save).
    // Actually rider already has 4242... saved. Let's use staff.
    const res = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.staff))
      .send({ ...DECLINE_PAYMENT, isDefault: false });
    assert.equal(res.status, 201);
    // Staff doesn't have other cards, so even with isDefault=false it's
    // still the only card (isDefault reflects what was stored).
    assert.equal(res.body.data.isDefault, false);
  });

  // -----------------------------------------------------------------------
  // GET /api/cards
  // -----------------------------------------------------------------------

  test('GET /api/cards 401 without auth', async () => {
    const res = await request(app).get('/api/cards');
    assert.equal(res.status, 401);
  });

  test('GET /api/cards 200 returns rider cards only', async () => {
    const res = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    // No hash in response
    for (const card of res.body.data) {
      assert.equal(card.cardHash, undefined);
    }
  });

  test('GET /api/cards cross-user isolation', async () => {
    // Admin saved the same simulator card as rider (allowed because
    // UNIQUE is per-user). Each user sees only their own cards.
    const adminCards = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.admin));
    assert.equal(adminCards.status, 200);
    assert.equal(adminCards.body.data.length, 1);

    const riderCards = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    assert.equal(riderCards.status, 200);
    assert.ok(riderCards.body.data.length >= 1);

    // Different users, different card IDs
    assert.notEqual(adminCards.body.data[0].id, riderCards.body.data[0].id);
  });

  // -----------------------------------------------------------------------
  // DELETE /api/cards/:id
  // -----------------------------------------------------------------------

  test('DELETE /api/cards/:id 401 without auth', async () => {
    const res = await request(app).delete('/api/cards/1');
    assert.equal(res.status, 401);
  });

  test('DELETE /api/cards/:id 404 for non-existent card', async () => {
    const res = await request(app)
      .delete('/api/cards/99999')
      .set(authHeader(tokens.rider));
    assert.equal(res.status, 404);
  });

  test('DELETE /api/cards/:id 403 for wrong user', async () => {
    // Rider's card ID — find it first
    const list = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    const riderCardId = list.body.data[0]?.id;
    assert.ok(riderCardId, 'Rider should have at least one card');

    const res = await request(app)
      .delete(`/api/cards/${riderCardId}`)
      .set(authHeader(tokens.staff));
    assert.equal(res.status, 403);
  });

  test('DELETE /api/cards/:id 200 for owner', async () => {
    const list = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    const riderCardId = list.body.data[0]?.id;

    const res = await request(app)
      .delete(`/api/cards/${riderCardId}`)
      .set(authHeader(tokens.rider));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify card is gone
    const after = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    assert.equal(
      after.body.data.find((c) => c.id === riderCardId),
      undefined
    );
  });

  // -----------------------------------------------------------------------
  // POST /api/bookings with savedCardId
  // -----------------------------------------------------------------------

  test('POST /api/bookings with savedCardId books successfully', async () => {
    // Re-save a card first (rider's card was deleted above)
    const save = await request(app)
      .post('/api/cards')
      .set(authHeader(tokens.rider))
      .send(SAMPLE_PAYMENT);
    assert.equal(save.status, 201);
    const cardId = save.body.data.id;

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-002',
        durationCode: 'oneHour',
        savedCardId: cardId,
        cvv: '123',
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.paymentStatus, 'paid');
  });

  test('POST /api/bookings with savedCardId 403 for wrong user', async () => {
    const list = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    const cardId = list.body.data[0]?.id;
    assert.ok(cardId);

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.staff))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        savedCardId: cardId,
      });
    assert.equal(res.status, 403);
  });

  test('POST /api/bookings with savedCardId 400 without cvv', async () => {
    const list = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    const cardId = list.body.data[0]?.id;
    assert.ok(cardId);

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        savedCardId: cardId,
      });
    assert.equal(res.status, 400);
  });

  test('POST /api/bookings with savedCardId 404 for non-existent card', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        savedCardId: 99999,
      });
    assert.equal(res.status, 404);
  });

  test('POST /api/bookings with savedCardId 400 for invalid id', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        savedCardId: -1,
      });
    assert.equal(res.status, 400);
  });

  test('POST /api/bookings with savedCardId and manual payment uses savedCardId', async () => {
    const list = await request(app)
      .get('/api/cards')
      .set(authHeader(tokens.rider));
    const cardId = list.body.data[0]?.id;
    assert.ok(cardId);

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeader(tokens.rider))
      .send({
        scooterId: 'ESC-001',
        durationCode: 'oneHour',
        savedCardId: cardId,
        cvv: '123',
        payment: DECLINE_PAYMENT, // decline card — should be ignored
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.paymentStatus, 'paid');
  });
});
