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

## Phase 1: Advanced Business Logic & Discounts

### User types in schema and session payload

The `users` table now includes a `user_type` field used for pricing eligibility:

- Allowed values: `standard`, `student`, `senior`
- Default value: `standard`
- Enforced at database level via `CHECK` constraint

Current schema shape (relevant columns):

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  user_type TEXT NOT NULL DEFAULT 'standard' CHECK (
    user_type IN ('standard', 'student', 'senior')
  ),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

After login/register, the session token payload includes `userType` so backend and frontend can reason about profile-based pricing:

```json
{
  "userId": 12,
  "email": "rider@example.com",
  "userType": "student"
}
```

### Pricing rules and discount eligibility

Booking pricing supports a single flat discount model:

- Discount rate: **20% off** the base selected plan price.
- Discount is **non-stacking**. Even if multiple paths are true, only one 20% discount is applied.

Eligibility paths (OR logic):

1. **Student** user (`user_type = 'student'`)
2. **Senior** user (`user_type = 'senior'`)
3. **Frequent User**: user has **8+ cumulative booking hours** created in the **last 7 days**

The backend computes a base/original price first, then applies the 20% reduction once when any eligibility condition is met.

### POST `/api/bookings` response additions

Booking creation responses now include discount visibility fields:

- `discountApplied` (`boolean`): whether the 20% discount path was triggered
- `originalPrice` (`number`): the pre-discount base price used before applying discount logic

Example (abridged):

```json
{
  "success": true,
  "data": {
    "bookingId": 101,
    "scooterId": "ESC-001",
    "durationCode": "fourHours",
    "originalPrice": 15,
    "totalPrice": 12,
    "discountApplied": true,
    "status": "active"
  }
}
```

### Business logic note: cancelled bookings and frequent-user hours

Current system behavior is intentional:

- Cancelled bookings are persisted as `status = 'completed'`.
- These completed/cancelled records are included in the 7-day cumulative-hours calculation.

This is a deliberate product decision to reward broader platform engagement, not only currently active hires.

## Phase 2: Feedback & Escalation Pipeline

### Issues schema

The platform now persists rider-reported faults in the `issues` table. This table supports escalation and resolution workflows while preserving audit timestamps.

- `id`: auto-increment primary key
- `user_id`: reporting user (`FOREIGN KEY` to `users.id`)
- `scooter_id`: reported scooter (`FOREIGN KEY` to `scooters.scooter_id`)
- `description`: free-text fault details from the reporting user
- `priority`: `low` or `high` (`CHECK` constrained, default `low`)
- `status`: `open` or `resolved` (`CHECK` constrained, default `open`)
- `created_at`, `updated_at`: automatic lifecycle timestamps

### Issues API endpoints

`POST /api/issues` (authenticated user fault reporting)
- Purpose: submit a new scooter issue report.
- Auth: requires a valid session token.
- Body: `scooterId`, `description`.
- Behavior: creates issue with default `priority = low` and `status = open`.

`GET /api/issues` (staff queryable list)
- Purpose: return issue list for staff triage and monitoring.
- Auth: requires a valid session token and staff role.
- Query params:
  - `status` (optional): `open` or `resolved`
  - `priority` (optional): `low` or `high` (use `priority=high` for escalated-only view)
- Behavior: returns all issues when no filters are provided, otherwise filtered subset.

`PATCH /api/issues/:id/priority` (staff escalation route)
- Purpose: escalate or otherwise update issue priority (e.g., `low -> high`).
- Auth: requires a valid session token and staff role.
- Body: `priority` with allowed values `low` or `high`.
- Behavior: validates issue exists, updates priority, and refreshes `updated_at`.

`PATCH /api/issues/:id/status` (staff resolution route)
- Purpose: resolve issue state (e.g., `open -> resolved`) or update status.
- Auth: requires a valid session token and staff role.
- Body: `status` with allowed values `open` or `resolved`.
- Behavior: validates issue exists, updates status, and refreshes `updated_at`.

### RBAC and security constraints

The Issues staff-management routes enforce role-based access control:

- `GET /api/issues`
- `PATCH /api/issues/:id/priority`
- `PATCH /api/issues/:id/status`

Each route requires:
1. A valid `Authorization` session token.
2. The token's associated user record to have `user_type === 'staff'`.

If a user is authenticated but not staff, the API returns `403 Forbidden`. This implements the project's non-functional security constraint that escalation and resolution controls are restricted to staff operators.

## Phase 3: Visual + Non-Functional Enhancements

### ID 21: Graphical weekly income plotting (`/income`)

The income dashboard now includes a graphical weekly income view built with the `recharts` library.

- Route: `/income`
- Visualization: responsive bar chart (`BarChart`) for hire-plan income comparison
- X-axis: hire plans (`1 Hour`, `4 Hours`, `1 Day`, `1 Week`)
- Y-axis: income amount in GBP
- Tooltip behavior: hover now reveals exact income and booking count for each plan
- Data shaping: backend `income` and `counts` objects are merged into chart-friendly records in the frontend (e.g., `{ plan, income, bookings }`)

This enhancement improves scanability of revenue patterns versus text-only cards while retaining exact value visibility through tooltip interactions.

### ID 24: Mobile responsiveness hardening

UI responsiveness has been explicitly hardened for small viewports (especially `< 768px`) using CSS media queries.

- Grid-based layouts (including income cards and booking-history detail grids) now stack to single-column flows on mobile.
- Top navigation is mobile-safe and remains usable by allowing horizontal scroll when link density exceeds available width.
- Supporting spacing and control layout adjustments prevent overflow and maintain interaction clarity on narrow screens.
- The Leaflet map container now respects mobile-friendly height constraints/aspect behavior so map rendering does not break surrounding layout.

These updates ensure the same user workflows remain usable and readable across desktop, tablet, and mobile breakpoints.

### ID 25: Accessibility (a11y) compliance improvements

The frontend has been updated to better align with modern accessibility standards and keyboard-first navigation requirements.

- Semantic structure is used consistently with landmarks/components such as `nav`, `main`, `section`, and `article` rather than relying on generic layout wrappers.
- Ambiguous interactive controls now include explicit ARIA labeling where needed (for example, income week navigation actions).
- Focus visibility has been reinforced through clear, high-contrast focus/focus-visible styles for keyboard users.
- No focus outline suppression without fallback is used, preserving accessible keyboard traversal cues.

Collectively, these a11y enhancements strengthen conformance with modern web standards and improve usability for assistive-technology and keyboard-only users.

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