# E-Scooter Rental Platform

Full-stack e-scooter rental platform (React + Express + SQLite) for XJCO2913 coursework.

## Tech Stack

- **Frontend**: React (Vite dev server)
- **Backend**: Node.js & Express.js
- **Database**: SQLite

Sprint plans, traceability matrix, and user manual: [`docs/wiki/`](docs/wiki/).

## Contents

- [Quick Start](#quick-start) — install, environment, database, run app, tests
- [Database Setup](#database-setup-sprint-1) — manual `sqlite3` commands and migrations
- [Backend API](#backend-api) — endpoint reference
- [Phase 1–4](#phase-1-advanced-business-logic--discounts) — business rules, issues, UX, admin
- [Testing](#testing)
- [Local Run Command Set](#local-run-command-set-copypaste) — copy/paste checklist for markers

## Quick Start

Get the app running in a few minutes. Phase-by-phase implementation notes and the full API reference are below.

### Prerequisites

- **Node.js** 18+ (20 LTS recommended) and **npm**
- **sqlite3** CLI (optional; only needed for [verify queries](#verify-seeded-data) and [migrations](#database-migrations-existing-escooterdb-only) — not for initial setup)
- Two terminal windows (backend + frontend)

### 1. Install dependencies

From the project root (the folder containing `package.json`):

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` only if you need non-default values. The app runs without SMTP; email is optional (see [Optional email notifications](#optional-email-notifications)).

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Backend API port |
| `DB_PATH` | `data/escooter.db` | SQLite database file |
| `SMTP_USER` / `SMTP_PASS` | *(unset)* | QQ Mail (or other SMTP) for registration/booking emails |
| `SMTP_HOST` / `SMTP_PORT` | *(unset)* | Alternative SMTP (e.g. local Mailpit); see `.env.example` |
| `CARD_HASH_SECRET` | *(unset)* | Optional secret for saved-card PAN hashing |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | see [Phase 4](#default-administrator-bootstrap) | Override defaults when running `npm run db:init` |

Never commit `.env` or real SMTP passwords.

### 3. Initialize the database

```bash
npm run db:init
```

This creates `data/escooter.db`, applies `database/schema.sql` and `database/seed.sql`, and bootstraps the default **admin** and walk-in placeholder accounts.

To reset an existing local database (stop the backend first to avoid `SQLITE_BUSY`):

```bash
npm run db:reset
```

### 4. Start the app (two terminals)

**Terminal A — backend** (listens on port `3000`):

```bash
node src/backend/server.js
```

**Terminal B — frontend** (Vite dev server; open the URL shown in the terminal, usually http://localhost:5173):

```bash
npm run dev
```

The Vite dev server proxies `/api` to the backend on port 3000.

### 5. Demo sign-in

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@escooter.local` | `AdminPass123!` |

Register a rider via the UI for customer flows. For simulated card payment, use test PAN `4242 4242 4242 4242` (shown in the booking modal when running `npm run dev`).

### 6. Run automated tests

From the project root (backend does not need to be running; tests use `DB_PATH=:memory:`):

```bash
npm test
```

See [Testing](#testing) for suite layout and conventions.

### Quick verify (with app running)

With the backend up (step 4, Terminal A):

```bash
curl -s http://localhost:3000/api/scooters
```

---

## Database Setup (Sprint 1)

**Fresh install:** use **`npm run db:init`** ([Quick Start](#quick-start)). It creates `data/`, applies `database/schema.sql` and `database/seed.sql`, and bootstraps the default admin and walk-in accounts. You do **not** need separate `mkdir` / `sqlite3` shell commands for normal setup.

Schema and seed sources live under `database/`. Use the `sqlite3` CLI only for inspection queries below or for [migrations](#database-migrations-existing-escooterdb-only) on an older file.

Backlog coverage:
- **ID 4**: View hire options and cost
- **ID 17**: Display e-scooter availability/details

### Verify seeded data

Requires a database already created via `npm run db:init`:
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

### Database migrations (existing `escooter.db` only)

If you already have a `data/escooter.db` file created from an older
`schema.sql` that does not allow `scooter` status `retired`, apply the
one-off migration (back up the file first):

```bash
sqlite3 data/escooter.db < database/migrations/001_add_retired_scooter_status.sql
```

New databases created from the current `database/schema.sql` do not
need this step.

## Backend API

### Complete API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/auth/register | none | Self-registration (standard/student/senior) |
| POST | /api/auth/login | none | Login |
| PATCH | /api/auth/profile | user | Update account type |
| GET | /api/scooters | none | Public fleet (excludes retired) |
| GET | /api/admin/scooters | admin | Full fleet including retired |
| POST | /api/scooters | admin | Create scooter + pricing |
| PUT | /api/scooters/:scooterId | admin | Update scooter |
| DELETE | /api/scooters/:scooterId | admin | Soft-retire |
| GET | /api/bookings/me | user | Own bookings |
| GET | /api/bookings | user | Alias for /me |
| GET | /api/bookings/pricing-preview | user | Price quote with discount |
| POST | /api/bookings | user | Create booking |
| PATCH | /api/bookings/:bookingId/cancel | user | Cancel own booking |
| PATCH | /api/bookings/:bookingId/extend | user | Extend own booking |
| GET | /api/bookings/income/weekly | admin | Weekly income analytics |
| GET | /api/bookings/income/daily | admin | Daily income breakdown |
| POST | /api/admin/bookings | staff+ | Walk-in booking |
| GET | /api/admin/bookings | admin | All bookings (filtered) |
| POST | /api/issues | user | Report scooter fault |
| GET | /api/issues | staff+ | List issues (filtered) |
| PATCH | /api/issues/:id/priority | staff+ | Escalate/de-escalate |
| PATCH | /api/issues/:id/status | staff+ | Resolve/reopen |
| POST | /api/cards | user | Save payment card |
| GET | /api/cards | user | List saved cards |
| DELETE | /api/cards/:id | user | Remove saved card |

### Example: `GET /api/scooters` response

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

### Optional email notifications

The backend can send SMTP email notifications after successful user
registration, booking confirmation, and booking completion/cancellation.
Email is optional: if SMTP credentials are not configured, the app logs
nothing and continues normally.

Copy `.env.example` to `.env` and set your own SMTP credentials (example
placeholders only):

```bash
SMTP_USER=your-email@example.com
SMTP_PASS=your_smtp_authorization_code
SMTP_FROM="E-Scooter Rental Platform <your-email@example.com>"
```

Defaults target QQ Mail SMTP (`smtp.qq.com`, port `465`, secure TLS) when
`SMTP_HOST` is omitted. For a local catch-all inbox, use Mailpit — see
comments in `.env.example`.

Never commit a real `.env` file or SMTP authorization code.

## Phase 1: Advanced Business Logic & Discounts

### User types in schema and session payload

The `users` table includes a `user_type` field used for both pricing
eligibility and role-based access control. The role model is documented
in detail under [Phase 4: Admin Mode + UX Hardening](#phase-4-admin-mode--ux-hardening).

- Allowed values: `standard`, `student`, `senior`, `staff`, `admin`
- Default value: `standard`
- Enforced at database level via `CHECK` constraint
- Self-registration via `POST /api/auth/register` is restricted to the
  three regular customer roles (`standard`, `student`, `senior`). Staff
  and admin accounts are provisioned out-of-band (see the bootstrap
  flow in [Phase 4](#phase-4-admin-mode--ux-hardening)).

Current schema shape (relevant columns):

```sql
CREATE TABLE IF NOT EXISTS users (
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
2. The token's associated user record to have user_type of staff or admin (both satisfy requireStaff).

If a user is authenticated but not staff, the API returns `403 Forbidden`. This implements the project's non-functional security constraint that escalation and resolution controls are restricted to staff operators.

## Phase 3: Visual + Non-Functional Enhancements

### ID 21: Graphical weekly income plotting (`/admin/income`)

The income dashboard now includes a graphical weekly income view built with the `recharts` library.

- Route: `/admin/income`
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

## Phase 4: Admin Mode + UX Hardening

### Canonical role model

The platform now uses a single canonical role model defined in
`src/backend/roles.js` (mirrored for the frontend by
`src/frontend/roles.js`). Two helper sets matter most:

- `REGULAR_USER_TYPES`: `standard`, `student`, `senior` &mdash; rider
  accounts. Differ only in pricing eligibility.
- `PRIVILEGED_USER_TYPES`: `staff`, `admin` &mdash; operator accounts.
  `staff` retains issue triage capability (Phase 2). `admin` is the
  superset role with access to income, fleet management, and bookings
  oversight.

Helpers used across the codebase:

- `isAdmin(user)`: strict `user_type === 'admin'` check.
- `hasStaffAccess(user)`: true for both `staff` and `admin`.
- `normalizeUserType(value)`: defensive normalization that falls back
  to `'standard'` for unknown / missing values, used both when
  serializing public users and when parsing session tokens. This
  prevents a crafted token from claiming an unknown privileged role.
- `isSelfRegistrableUserType(value)`: gatekeeper used by
  `POST /api/auth/register` so privileged roles cannot be created via
  the public signup endpoint.

### Default administrator bootstrap

`npm run db:init` (which calls `src/backend/db/init.js`) seeds a
default administrator account if and only if no admin user already
exists. Re-running the init script never overwrites an existing admin.

Defaults (override via environment variables):

| Variable          | Default                  |
| ----------------- | ------------------------ |
| `ADMIN_EMAIL`     | `admin@escooter.local`   |
| `ADMIN_NAME`      | `Platform Administrator` |
| `ADMIN_PASSWORD`  | `AdminPass123!`          |

Important: change `ADMIN_PASSWORD` for any non-development deployment.
The default password is intentionally documented to make coursework
review reproducible, not to be used in production.

### Backend authorization changes

Authorization is centralized in `src/backend/auth-middleware.js`.
Routes import `authenticateRequest`, `requireAdmin`, and
`requireStaff` rather than re-implementing token parsing inline.

Newly admin-gated and added endpoints:

| Method & Route                       | Required role | Purpose                                        |
| ------------------------------------ | ------------- | ---------------------------------------------- |
| `GET /api/bookings/income/weekly`    | `admin`       | Weekly income analytics (moved off rider UI). |
| `GET /api/scooters`                  | *(public)*    | Rider-visible fleet (excludes `retired`).       |
| `GET /api/admin/scooters`            | `admin`       | Full fleet including soft-retired rows.       |
| `POST /api/scooters`                 | `admin`       | Create a scooter (also seeds its pricing row). |
| `PUT /api/scooters/:scooterId`       | `admin`       | Update scooter status / location / pricing.    |
| `DELETE /api/scooters/:scooterId`    | `admin`       | Soft-retire (`status -> retired`; no row delete). |
| `GET /api/admin/bookings`            | `admin`       | List/filter all bookings across the platform.  |

| `PATCH /api/auth/profile` | *(authenticated)* | Update own account type |
| `POST /api/cards` | *(authenticated)* | Save a payment card |
| `GET /api/cards` | *(authenticated)* | List saved cards |
| `DELETE /api/cards/:id` | *(authenticated)* | Remove a saved card |

`GET /api/bookings/income/daily` (admin-only) returns a per-day income breakdown for a Monday-based week. The admin Income UI exposes a **By Day** toggle that switches the chart between weekly plan totals and this daily view.

The `POST /api/scooters` payload is identical to the `PUT` shape, with
the request body validated by the shared
`validateScooterPayload` helper in `src/backend/scooter-service.js`:

```json
{
  "scooterId": "ESC-010",
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
```

Constraints enforced server-side (and surfaced verbatim to the UI on
`400 Bad Request`):

- `scooterId` must match `^[A-Z0-9-]{4,20}$`. The validator
  uppercases and trims before checking, so user input like
  `" esc-010 "` is normalized.
- `status` must be one of `available`, `in_use`, `maintenance`, `offline`, `retired`.
- `latitude` must be in `[-90, 90]`, `longitude` in `[-180, 180]`.
- `location.description` is required and trimmed.
- All four pricing tiers must be finite numbers `>= 0`.

A duplicate scooter ID returns `409 Conflict` and leaves both
`scooters` and `scooter_pricing` rows untouched (the create path is
wrapped in a single SQLite transaction with rollback on failure).

**Soft retire (`DELETE /api/scooters/:scooterId`):** Sets
`status = 'retired'`. Does not delete the row (bookings and issues stay
linked for audit/income). Returns `409` if the scooter is `in_use`
(active hire) or already `retired`. Re-activation is done with
`PUT /api/scooters/:id` and `status: 'available'` (or another
operational status). Rider discovery uses `GET /api/scooters`, which
omits retired scooters; admins use `GET /api/admin/scooters` to see the
full set.

Existing databases created before the `retired` status was added must
run the one-off migration (see **Database migrations** below).

### Phase 4 update: scooter lifecycle

The fleet now supports a lifecycle soft-delete state, `retired`, for
operational decommissioning without data loss.

- `retired` is a **status transition**, not a row deletion. Booking and
  issue history remains linked to the same `scooter_id` for income and
  audit continuity.
- `DELETE /api/scooters/:scooterId` is admin-only and performs
  `status -> retired`.
  - `200`: retire succeeded; response returns the updated scooter row.
  - `404`: scooter ID does not exist.
  - `409`: scooter is `in_use` or already `retired`.
- Rider discovery (`GET /api/scooters`) deliberately excludes retired
  rows.
- Admin fleet management (`GET /api/admin/scooters`) returns the full
  set including retired rows so administrators can review and re-activate
  using `PUT /api/scooters/:scooterId`.

For existing developer databases created before `retired` was added to
the `scooters.status` CHECK constraint, run:

```bash
sqlite3 data/escooter.db < database/migrations/001_add_retired_scooter_status.sql
```

`GET /api/admin/bookings` accepts optional query params:
- `status`: `active` or `completed`
- `scooterId`: filter by scooter
- `userId`: filter by user

The previously documented Issues routes (`GET /api/issues`,
`PATCH /api/issues/:id/priority`, `PATCH /api/issues/:id/status`)
continue to require staff-tier access (`staff` or `admin`).

### Frontend route segmentation

The application now renders different route trees and navigation
menus depending on whether the active session is an admin
(`isAdminSession(session)` from `src/frontend/roles.js`).

Customer mode (regular users):
- Landing path: `/map`
- Nav order: `Map`, `Fleet`, `My Bookings` (Map deliberately first
  for discovery; `Income` is removed from the rider surface).
- Components: `ScooterMap.jsx`, `ScooterList.jsx`, `MyBookings.jsx`,
  `SavedCards.jsx`, `Profile.jsx`, `ReportIssue.jsx`,
  `AccountTypePicker.jsx`, `ThemeToggle.jsx`.

Admin mode:
- Landing path: `/admin/bookings`
- Nav order: `Bookings`, `Fleet Manage`, `Issues`, `Income`
- Components: `AdminBookings.jsx`, `AdminFleet.jsx`,
  `AdminIssues.jsx`, plus the existing `Income.jsx` reused under
  `/admin/income`, and `ThemeToggle.jsx`.
- The `Fleet Manage` page loads data via **`useAdminScooters()`** calling
  `GET /api/admin/scooters` (not the public rider list). It exposes
  **Edit scooter** (`PUT /api/scooters/:scooterId`), **Add scooter**
  (`POST /api/scooters`), **Retire** (`DELETE`, with a native
  `confirm()`), and **Re-activate** (opens the edit form with status
  pre-filled to `available`). Retired rows are visually de-emphasised in
  the list.

A role label is shown next to the brand in the navigation so the
active mode is always visible at a glance.

### Account-creation UX changes

`AuthManager.jsx` now offers:

- A confirm-password field on the registration form with client-side
  match validation. The backend also enforces the match
  defensively when `confirmPassword` is present in the payload (see
  `validateRegistrationInput` in `src/backend/auth-service.js`).
- Show/hide toggles on every password input on both login and
  registration forms via the shared `PasswordField` component.

### Payment simulator visibility

The payment simulator instructions inside the booking confirmation
modal are now gated behind a build-time flag in
`src/frontend/components/ScooterList.jsx`:

```js
const SHOW_PAYMENT_SIMULATOR = Boolean(import.meta.env?.DEV);
```

This means the &ldquo;Payment simulator (dev only)&rdquo; copy is
visible during `npm run dev` (Vite dev server) but disappears in
production builds, so end users never see test-card guidance in a
real release. The simulated booking flow itself is unchanged.

### Visible internal ID markers removed

The `IDx` text labels (e.g., `ID4`, `ID5`, `ID17`, `ID18`, `ID19`,
`ID21`) that previously decorated user-facing panels have been
removed from the rendered DOM. Where the markers were useful for QA,
they are now exposed as non-rendered `data-id` attributes instead, so
automated test selectors can still find them without polluting the
visual output.

### Visual redesign (complete)

Branch `feature/ui-redesign` delivers a token-driven UI built in atomic phases (0–10) without changing routes, API contracts, or test count.

**Foundation**
- `styles/tokens.css`, `styles/base.css`, `utils/theme.js` — spacing, type, radius, motion, shadows; customer emerald + admin indigo palettes; dark mode via `data-theme` and `localStorage` (`escooter.theme`).
- `styles/components/atoms.css` — shared `.btn`, `.input`, `.field`, `.alert`, `.skeleton`, `.sr-only`.

**Shell & screens**
- Layout: `layout.css`, `Layout.jsx`, `ThemeToggle.jsx` — sticky nav, role pill, mobile drawer, `body[data-area="admin"]`.
- Customer: `auth.css`, `map.css`, `fleet.css`, `bookings.css` — auth split-screen, map, fleet/booking modal, bookings/cards/issues.
- Admin: `admin.css`, `income.css` — bookings table, walk-in modal, fleet CRUD, issue triage, income dashboard with themed recharts.

**Polish (Phase 9–10)**
- Loading skeletons and icon empty states on list screens.
- Focus-visible and reduced-motion overrides; `<noscript>` fallback in `index.html`.
- Legacy rules removed from `styles.css`; component CSS is the single source of truth per screen.

**Demo notes**
- Payments are simulated (dev test card numbers in booking modal when using manual entry).
- Walk-in bookings are staff/admin-only: Admin → Bookings → **Book Walk-in** (`POST /api/admin/bookings`), not customer registration.
- Student/senior discounts use account type chosen at registration; frequent-user discount applies after 8+ hire hours in 7 days (server-side).

## Testing

The suite uses Node's built-in `node:test` runner (`npm test` runs
with `--test-concurrency=1` so integration tests do not overlap on the
same process-global SQLite handle). **[supertest](https://github.com/ladjs/supertest)**
(dev dependency) exercises real HTTP endpoints against an in-memory
database (`DB_PATH=:memory:`); see `tests/integration/setup.js` and
`tests/integration/*.test.js`.

```bash
npm test
```

**Integration tests** (`tests/integration/`): auth/RBAC smoke,
`scooters` create/update/delete retire vs public list,
`bookings`/income/admin bookings including booking against a retired
scooter, and issues staff gates.

**Unit tests** focus on security-critical primitives introduced in
Phase 4:

- Role helpers (`isAdmin`, `hasStaffAccess`, `normalizeUserType`,
  `isSelfRegistrableUserType`) and the canonical role sets
  (`tests/auth-rbac.test.js`).
- `validateRegistrationInput` confirm-password handling (mismatched
  rejection, backwards-compatible accept when omitted, short-password
  rejection).
- `parseSessionToken` / `createSessionToken` round-tripping admin
  payloads and refusing to honor unknown roles (downgrades to
  `standard`).
- `toPublicUser` correctly preserving privileged roles.
- `validateScooterPayload` accept path and every reject branch &mdash;
  bad scooter ID format, unknown status, non-object location,
  out-of-range lat/lng, empty description, missing pricing, negative
  prices, non-numeric prices (`tests/scooter-service.test.js`). The
  same helper is used by both `POST` and `PUT /api/scooters`, so these
  cases lock in the shared contract.

When extending RBAC, prefer adding cases to
`tests/auth-rbac.test.js` rather than re-deriving role logic in new
modules. Likewise, scooter create/update validation cases belong in
`tests/scooter-service.test.js`. New HTTP/RBAC regressions belong in a
matching file under `tests/integration/`.

## Local Run Command Set (Copy/Paste)

See [Quick Start](#quick-start) for the minimal path. This section repeats the full command set for markers and demos.

### Where to run these commands

- Run all commands from the **project root** (the directory that contains `package.json` and this `README.md`)
- Use **Terminal A** for the backend and **Terminal B** for the frontend (and optional curl/sqlite checks)

### 1) Install dependencies (project root)

```bash
npm install
```

### 2) Configure environment (project root)

```bash
cp .env.example .env
```

Edit `.env` only if you need custom `PORT`, `DB_PATH`, or SMTP settings.

### 3) Prepare the SQLite database (project root)

```bash
npm run db:init
```

### 4) Start backend API (Terminal A, project root)

```bash
node src/backend/server.js
```

### 5) Start frontend (Terminal B, project root)

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). API calls are proxied to `http://localhost:3000`.

### 6) Verify API contract (Terminal B or C, project root)

With the backend running:
If `jq` is installed:
```bash
curl -s http://localhost:3000/api/scooters | jq
```

Without `jq`:
```bash
curl -s http://localhost:3000/api/scooters
```

### 7) Verify seeded records from SQLite (project root)
```bash
sqlite3 data/escooter.db "
SELECT s.scooter_id,s.status,s.location_description,p.one_hour,p.four_hours,p.one_day,p.one_week
FROM scooters s
JOIN scooter_pricing p ON p.scooter_id=s.scooter_id
ORDER BY s.scooter_id;
"
```

### 8) Run automated tests (project root)

Backend does not need to be running:

```bash
npm test
```

### 9) Run formatter before commit (project root, optional)

```bash
npm run format
```

### 10) Custom administrator credentials (optional)

`npm run db:init` (step 3) already creates the default admin when none exists. Re-run on a fresh database, or use env overrides:

```bash
ADMIN_EMAIL=ops@example.com \
ADMIN_NAME="Ops Admin" \
ADMIN_PASSWORD="ChangeMeNow123!" \
  node src/backend/db/init.js
```
