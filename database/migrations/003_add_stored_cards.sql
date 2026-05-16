-- Add stored_cards table for customer card storage (ID2/ID3).
-- Stores only last4 + SHA-256 hash of the normalized PAN; never the raw
-- card number or CVV. This is a coursework simulation — the hash is
-- deterministic so the payment simulator (which only accepts two fixed
-- test card numbers) can still resolve card inputs.
--
-- Run against an existing escooter.db:
--   sqlite3 data/escooter.db < database/migrations/003_add_stored_cards.sql

CREATE TABLE IF NOT EXISTS stored_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  card_last4 TEXT NOT NULL CHECK (length(card_last4) = 4),
  card_brand TEXT,
  card_hash TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stored_cards_user_hash ON stored_cards (user_id, card_hash);
CREATE INDEX IF NOT EXISTS idx_stored_cards_user_id ON stored_cards (user_id);
