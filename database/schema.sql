PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scooters (
  scooter_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN ('available', 'in_use', 'maintenance', 'offline')
  ),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  location_description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scooter_pricing (
  scooter_id TEXT PRIMARY KEY,
  one_hour REAL NOT NULL CHECK (one_hour >= 0),
  four_hours REAL NOT NULL CHECK (four_hours >= 0),
  one_day REAL NOT NULL CHECK (one_day >= 0),
  one_week REAL NOT NULL CHECK (one_week >= 0),
  FOREIGN KEY (scooter_id) REFERENCES scooters (scooter_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scooters_status ON scooters (status);
CREATE INDEX IF NOT EXISTS idx_scooters_location ON scooters (latitude, longitude);
