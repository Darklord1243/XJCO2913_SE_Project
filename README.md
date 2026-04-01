# E-Scooter Rental Platform

## Tech Stack
- **Frontend**: React
- **Backend**: Node.js & Express.js
- **Database**: SQLite

## Database Setup (Sprint 1)
Backlog coverage:
- **ID 4**: View hire options and cost
- **ID 17**: Display e-scooter availability/details

Schema and seed files are under `database/`.

### Create and seed database
Run the following commands from the project root:

```bash
mkdir -p data
sqlite3 data/escooter.db < database/schema.sql
sqlite3 data/escooter.db < database/seed.sql
```

### Verify seeded data
```bash
sqlite3 data/escooter.db "
SELECT
  s.scooter_id,
  s.status,
  s.latitude,
  s.longitude,
  s.location_description,
  p.one_hour,
  p.four_hours,
  p.one_day,
  p.one_week
FROM scooters s
JOIN scooter_pricing p ON p.scooter_id = s.scooter_id;
"
```

## Backend API
Implemented endpoint:
- `GET /api/scooters`

Expected response format:
```json
{
  "success": true,
  "data": [
    {
      "scooterId": "ESC-001",
      "status": "available",
      "location": {
        "latitude": 53.8008,
        "longitude": -1.5491,
        "description": "City Centre Square"
      },
      "pricing": {
        "oneHour": 5,
        "fourHours": 15,
        "oneDay": 30,
        "oneWeek": 120
      }
    }
  ]
}
```