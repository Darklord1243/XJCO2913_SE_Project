-- Extend scooters.status CHECK to include 'retired' (soft-delete / lifecycle).
-- Run once against an existing escooter.db created from an older schema.sql:
--   sqlite3 data/escooter.db < database/migrations/001_add_retired_scooter_status.sql
--
-- SQLite cannot ALTER a CHECK constraint in place; we recreate the table.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE scooters_new (
  scooter_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN ('available', 'in_use', 'maintenance', 'offline', 'retired')
  ),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO scooters_new (
  scooter_id,
  status,
  latitude,
  longitude,
  location_description,
  created_at,
  updated_at
)
SELECT
  scooter_id,
  status,
  latitude,
  longitude,
  location_description,
  created_at,
  updated_at
FROM scooters;

DROP TABLE scooters;

ALTER TABLE scooters_new RENAME TO scooters;

CREATE INDEX IF NOT EXISTS idx_scooters_status ON scooters (status);
CREATE INDEX IF NOT EXISTS idx_scooters_location ON scooters (latitude, longitude);

COMMIT;

PRAGMA foreign_keys = ON;
