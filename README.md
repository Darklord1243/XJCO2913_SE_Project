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

## Local Run Command Set (Copy/Paste)
Put this command set in your terminal exactly as shown.

### Where to run these commands
- Run all commands from the project root: ` /home/lingod/XJCO2913_SE_Project `
- Use separate terminals where noted (Terminal A / Terminal B)

### 1) Install required runtime dependencies (project root)
```bash
npm install express sqlite3 react react-dom
```

### 2) Prepare the SQLite database (project root)
```bash
mkdir -p data
sqlite3 data/escooter.db < database/schema.sql
sqlite3 data/escooter.db < database/seed.sql
```

### 3) Start backend API (Terminal A, project root)
```bash
node src/backend/server.js
```

### 4) Verify API contract quickly (Terminal B, project root)
If `jq` is installed:
```bash
curl -s http://localhost:3000/api/scooters | jq
```

Without `jq`:
```bash
curl -s http://localhost:3000/api/scooters
```

### 5) Verify seeded records from SQLite directly (Terminal B, project root)
```bash
sqlite3 data/escooter.db "
SELECT s.scooter_id,s.status,s.location_description,p.one_hour,p.four_hours,p.one_day,p.one_week
FROM scooters s
JOIN scooter_pricing p ON p.scooter_id=s.scooter_id
ORDER BY s.scooter_id;
"
```

### 6) Run formatter before commit (project root)
```bash
npm run format
```