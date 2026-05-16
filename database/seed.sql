PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Fleet: 13 scooters across Leeds (ESC-001 … ESC-013)
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
  ('ESC-003', 'maintenance', 53.8067, -1.5550, 'University Campus Hub'),
  ('ESC-004', 'available', 53.8210, -1.5765, 'Headingley Arndale Centre'),
  ('ESC-005', 'available', 53.8095, -1.5600, 'Hyde Park Corner'),
  ('ESC-006', 'available', 53.8070, -1.5490, 'Woodhouse Lane Car Park'),
  ('ESC-007', 'in_use', 53.8160, -1.6020, 'Kirkstall Abbey Entrance'),
  ('ESC-008', 'available', 53.8290, -1.5640, 'Meanwood Park'),
  ('ESC-009', 'available', 53.7870, -1.5470, 'Holbeck Moor Road'),
  ('ESC-010', 'maintenance', 53.7985, -1.5850, 'Armley Town Street'),
  ('ESC-011', 'available', 53.8120, -1.5800, 'Burley Road Shops'),
  ('ESC-012', 'available', 53.8060, -1.5200, 'Harehills Lane'),
  ('ESC-013', 'available', 53.7750, -1.5550, 'Beeston Co-op');

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
  ('ESC-003', 4.5, 14.0, 28.0, 115.0),
  ('ESC-004', 4.5, 13.5, 24.8, 90.0),
  ('ESC-005', 5.0, 15.0, 27.5, 100.0),
  ('ESC-006', 4.0, 12.0, 22.0, 80.0),
  ('ESC-007', 4.5, 13.5, 24.8, 90.0),
  ('ESC-008', 5.0, 15.0, 27.5, 100.0),
  ('ESC-009', 4.0, 12.0, 22.0, 80.0),
  ('ESC-010', 4.5, 13.5, 24.8, 90.0),
  ('ESC-011', 5.0, 15.0, 27.5, 100.0),
  ('ESC-012', 4.0, 12.0, 22.0, 80.0),
  ('ESC-013', 4.5, 13.5, 24.8, 90.0);

COMMIT;
