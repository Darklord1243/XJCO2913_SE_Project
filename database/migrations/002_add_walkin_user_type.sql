-- Add 'walkin' to users.user_type CHECK constraint.
-- Walk-in accounts are created by staff for unregistered customers; they
-- cannot log in (rejected explicitly in POST /api/auth/login).
--
-- SQLite cannot ALTER a CHECK constraint in place; we recreate the table.
-- Run against an existing escooter.db:
--   sqlite3 data/escooter.db < database/migrations/002_add_walkin_user_type.sql
--
-- password_salt / password_hash: NOT NULL columns satisfied with unusable
-- placeholders. The 64-char hex hash matches scrypt output length used by
-- auth-service.js but was not produced from any real password, so login
-- is practically impossible even without the explicit walkin rejection.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  user_type TEXT NOT NULL DEFAULT 'standard' CHECK (
    user_type IN ('standard', 'student', 'senior', 'staff', 'admin', 'walkin')
  ),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (
  id,
  full_name,
  email,
  user_type,
  password_salt,
  password_hash,
  created_at
)
SELECT
  id,
  full_name,
  email,
  user_type,
  password_salt,
  password_hash,
  created_at
FROM users;

-- Seed the internal walk-in placeholder user (idempotent via INSERT OR IGNORE)
INSERT OR IGNORE INTO users_new (
  full_name,
  email,
  user_type,
  password_salt,
  password_hash
)
VALUES (
  'Walk-in Customer',
  'walkin@escooter.internal',
  'walkin',
  'walkin',
  '0000000000000000000000000000000000000000000000000000000000000000'
);

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

COMMIT;

PRAGMA foreign_keys = ON;
