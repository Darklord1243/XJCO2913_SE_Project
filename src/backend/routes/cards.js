const express = require('express');
const { authenticateRequest } = require('../auth-middleware');
const {
  detectCardBrand,
  extractLast4,
  hashCardPan,
  isSimulatorSupportedPan,
  validatePaymentPayload,
} = require('../booking-service');
const { transactionMutex } = require('../database');
const db = require('../db/connection');

const router = express.Router();

// ---------------------------------------------------------------------------
// Local db helpers (same pattern as bookings.js)
// ---------------------------------------------------------------------------

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// ---------------------------------------------------------------------------
// Row mapping (snake_case → camelCase)
// ---------------------------------------------------------------------------

function mapCardRow(row) {
  return {
    id: row.id,
    cardLast4: row.card_last4,
    cardBrand: row.card_brand || null,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at
      ? `${String(row.created_at).replace(' ', 'T')}Z`
      : null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/cards — save a new card for the authenticated user
// ---------------------------------------------------------------------------

router.post('/cards', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    // Validate payment payload to ensure card details meet format requirements
    const paymentValidation = validatePaymentPayload(req.body);
    if (!paymentValidation.ok) {
      return res.status(400).json({
        success: false,
        error: paymentValidation.message,
      });
    }

    const { cardNumber: rawCardNumber } = paymentValidation.value;
    const cardHash = hashCardPan(rawCardNumber);
    const cardLast4 = extractLast4(rawCardNumber);
    const cardBrand = detectCardBrand(rawCardNumber);
    const isDefault = Boolean(req.body?.isDefault);

    // Check for duplicate card (same PAN hash) for this user
    const existing = await dbGet(
      'SELECT id FROM stored_cards WHERE card_hash = ? AND user_id = ?;',
      [cardHash, user.id]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'This card is already saved on your account.',
      });
    }

    let created;

    await transactionMutex.runExclusive(async () => {
      await dbRun('BEGIN TRANSACTION');
      try {
        // If setting as default, unset any existing default first
        if (isDefault) {
          await dbRun(
            'UPDATE stored_cards SET is_default = 0 WHERE user_id = ? AND is_default = 1;',
            [user.id]
          );
        }

        const result = await dbRun(
          `INSERT INTO stored_cards (user_id, card_last4, card_brand, card_hash, is_default)
           VALUES (?, ?, ?, ?, ?);`,
          [user.id, cardLast4, cardBrand, cardHash, isDefault ? 1 : 0]
        );

        created = await dbGet(
          'SELECT id, user_id, card_last4, card_brand, card_hash, is_default, created_at FROM stored_cards WHERE id = ?;',
          [result.lastID]
        );

        await dbRun('COMMIT');
      } catch (txError) {
        try {
          await dbRun('ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        throw txError;
      }
    });

    const responseBody = {
      success: true,
      data: mapCardRow(created),
    };

    if (!isSimulatorSupportedPan(rawCardNumber)) {
      responseBody.warning =
        'Card saved, but only simulator test cards (4242 4242 4242 4242 or 4000 0000 0000 0002) can be used for bookings in this coursework build.';
    }

    return res.status(201).json(responseBody);
  } catch (error) {
    console.error('POST /api/cards failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save card.',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cards — list saved cards for the authenticated user
// ---------------------------------------------------------------------------

router.get('/cards', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    const rows = await dbAll(
      `SELECT id, card_last4, card_brand, is_default, created_at
       FROM stored_cards
       WHERE user_id = ?
       ORDER BY is_default DESC, created_at DESC, id DESC;`,
      [user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows.map(mapCardRow),
    });
  } catch (error) {
    console.error('GET /api/cards failed:', error);
    const message = String(error?.message || '');

    if (message.includes('no such table: stored_cards')) {
      return res.status(503).json({
        success: false,
        error:
          'Saved cards are not available on this database. Run npm run db:init or apply database/migrations/003_add_stored_cards.sql.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch saved cards.',
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/cards/:id — remove a saved card (owner only)
// ---------------------------------------------------------------------------

router.delete('/cards/:id', async (req, res) => {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) return;

    const cardId = Number(req.params.id);
    if (!Number.isInteger(cardId) || cardId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card ID.',
      });
    }

    const card = await dbGet(
      'SELECT id, user_id FROM stored_cards WHERE id = ?;',
      [cardId]
    );

    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Saved card not found.',
      });
    }

    if (card.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only remove your own saved cards.',
      });
    }

    await dbRun('DELETE FROM stored_cards WHERE id = ?;', [cardId]);

    return res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('DELETE /api/cards/:id failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove saved card.',
    });
  }
});

module.exports = router;
