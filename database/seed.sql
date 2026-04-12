PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT OR IGNORE INTO scooters (
  scooter_id,
  status,
  latitude,
  longitude,
  location_description
)
VALUES
  ('ESC-001', 'available', 53.8008, -1.5491, 'City Centre Square'),
  ('ESC-002', 'available', 53.7972, -1.5416, 'Leeds Station Entrance'),
  ('ESC-003', 'maintenance', 53.8067, -1.5550, 'University Campus Hub');

INSERT OR IGNORE INTO scooter_pricing (
  scooter_id,
  one_hour,
  four_hours,
  one_day,
  one_week
)
VALUES
  ('ESC-001', 5.0, 15.0, 30.0, 120.0),
  ('ESC-002', 5.5, 16.0, 31.0, 122.0),
  ('ESC-003', 4.5, 14.0, 28.0, 115.0);

COMMIT;
