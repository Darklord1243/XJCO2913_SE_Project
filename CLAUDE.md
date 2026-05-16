# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start frontend dev server (Vite)
npm run dev

# Start backend API (separate terminal)
node src/backend/server.js

# Initialize/reseed database (also bootstraps default admin)
npm run db:init

# Run all tests (unit + integration, single concurrency for SQLite safety)
npm test

# Run a single test file
node --test --test-concurrency=1 tests/scooter-service.test.js

# Format code before committing
npm run format
```

- Backend runs on port 3000 by default (override with `PORT` env var).
- The backend API serves the frontend on the same port in production; in dev, Vite runs its own dev server (usually port 5173).
- `npm test` uses `--test-concurrency=1` because tests share a process-global SQLite handle.

### Email notifications (ID7)

Transactional email uses **nodemailer** over SMTP. `server.js` loads `.env` via **dotenv** at startup.
`email-service.js` exports three fire-and-forget senders (all use `void` at call sites — email failure never
affects the HTTP response; transport errors are logged in `sendMailBestEffort()`, not thrown):

| Function | Trigger |
|---|---|
| `sendRegistrationEmail(user)` | POST `/api/auth/register` (`routes/auth.js`) |
| `sendBookingConfirmationEmail({ user, booking })` | POST `/api/bookings`; POST `/api/admin/bookings` when guest email provided (`routes/bookings.js`) |
| `sendBookingCompletedEmail({ user, booking })` | PATCH `/api/bookings/:id/cancel` (`routes/bookings.js`) |

No email on extend (ID11) — by design.

**Configuration** (see `.env.example`):

- **Disabled** — leave `SMTP_USER`/`SMTP_PASS` empty and `SMTP_HOST` empty; startup logs a warning; all endpoints still work.
- **Mailpit (local dev)** — `SMTP_HOST=localhost`, `SMTP_PORT=1025`, no `SMTP_USER`/`SMTP_PASS`; view mail at http://localhost:8025
- **QQ Mail (production-style)** — set `SMTP_USER` + `SMTP_PASS` (authorization code, not QQ password); defaults to `smtp.qq.com:465` with `secure: true` when host omitted

```bash
# Mailpit: docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
SMTP_HOST=localhost SMTP_PORT=1025 node src/backend/server.js

# QQ Mail (credentials in .env):
node src/backend/server.js
```

## Architecture

### Backend (Express 5 + SQLite3)

```
src/backend/
  server.js          Entry point (listen)
  app.js             Express app assembly (CORS, JSON, route mounting)
  database.js        Data access layer + AsyncMutex for transaction serialization
  auth-service.js    Password hashing (scrypt), session tokens (base64url JSON), validation
  auth-middleware.js  authenticateRequest, requireAdmin, requireStaff
  roles.js           Canonical role model (standard/student/senior/staff/admin)
  booking-service.js Payment simulator, booking transaction, weekly hours calculation
  email-service.js  SMTP transactional email via nodemailer (registration, booking confirmation, booking completed; fire-and-forget)
  scooter-service.js Scooter payload validation (shared by POST and PUT)
  routes/
    auth.js          POST /api/auth/register, POST /api/auth/login
    scooters.js      4 scooter endpoints (public list, admin CRUD with soft-retire)
    bookings.js      5 booking endpoints (create, list, cancel, extend, income, admin list)
    issues.js        4 issue endpoints (create, list, escalate, resolve)
  db/
    connection.js    SQLite singleton (reads DB_PATH env, enables foreign keys PRAGMA)
    init.js          Schema + seed + admin bootstrap script
```

- **Authentication**: Session tokens are base64url-encoded JSON payloads (`{userId, email, userType, issuedAt}`), not JWTs. The `parseSessionToken` function normalizes `userType` through `roles.normalizeUserType()` so unknown roles silently downgrade to `standard` — a deliberate security property.
- **Authorization flow**: Route handlers call `authenticateRequest(req, res)` first. If it returns null, abort. Then call `requireAdmin(res, user)` or `requireStaff(res, user)`. Admins are a superset of staff.
- **Database access**: `src/backend/database.js` exports `findUserByEmail`, `findUserById`, `createUser`, `createIssue`, etc. `src/backend/db/connection.js` exports the raw `sqlite3.Database` singleton. Routes that need custom queries use the raw `db` directly via `dbGet`/`dbRun`/`dbAll` helper patterns defined locally in each route file.
- **Transactions**: Write paths that touch multiple tables use `transactionMutex.runExclusive()` (an `AsyncMutex`) to serialize SQLite writes, avoiding `SQLITE_BUSY`.
- **Soft-retire**: `DELETE /api/scooters/:id` sets `status = 'retired'`, never deletes rows. The public rider list excludes retired scooters; `GET /api/admin/scooters` includes them.

### Frontend (React 19 + Vite 8 + react-router-dom 7)

```
src/frontend/
  main.jsx           Vite entry point
  App.jsx            Root component: route splitting by role, session state
  session.js         localStorage session persistence + token getter
  roles.js           Frontend mirror of backend role model (UI gating only)
  components/
    Layout.jsx       Shell (nav + <Outlet>) with role-aware nav items
    AuthManager.jsx  Login/register forms with password confirm + show/hide
    ScooterMap.jsx   Leaflet map view (customer landing page)
    ScooterList.jsx  Fleet list with booking modal + payment simulator
    MyBookings.jsx   Customer booking history with cancel/extend
    AdminBookings.jsx  Admin bookings oversight with filters
    AdminFleet.jsx   Full fleet CRUD (add, edit, retire, reactivate)
    AdminIssues.jsx  Issue triage (list, escalate, resolve)
    Income.jsx       Weekly income bar chart (recharts)
  hooks/             Custom hooks for data fetching (useBookings, etc.)
  utils/
    api.js           requestJson() fetch wrapper that throws on non-2xx
```

- **Route splitting**: `App.jsx` checks `isAdminSession(session)` and renders completely different `<Route>` trees for admin vs customer. Unauthenticated users see only the `AuthManager`. Admin landing path is `/admin/bookings`; customer landing is `/map`.
- **API calls**: All API calls go through `requestJson()` in `utils/api.js`. The frontend dev server proxies `/api` requests to the backend (via Vite's default proxy behavior — no explicit proxy config exists, so the backend and frontend must communicate directly via CORS in development).

### Database

```
database/
  schema.sql         Full DDL (users, scooters, scooter_pricing, bookings, issues)
  seed.sql           Sample rider data (no admin/staff accounts)
  migrations/        001_add_retired_scooter_status.sql
```

- Foreign keys are enforced (`PRAGMA foreign_keys = ON`).
- `data/escooter.db` is the default database path. Tests override via `DB_PATH=:memory:`.

### Testing

```
tests/
  _list-test-files.cjs       Discovers test files for npm test
  auth-rbac.test.js           Unit tests for roles, auth-service
  email-service.test.js       Unit tests for email-service (mocked SMTP)
  scooter-service.test.js     Unit tests for validateScooterPayload
  integration/
    _setup.js                 createTestApp, seedUser, mintToken, authHeader
    auth-flow.test.js
    scooters-rbac.test.js
    bookings-rbac.test.js
    issues-rbac.test.js
```

- **Integration tests** use `createTestApp()` which sets `DB_PATH=:memory:`, loads the Express app without `listen()`, and runs schema/seed. Then `seedUser()` + `mintToken()` create authenticated sessions for specific roles.
- **Unit tests** import pure functions directly (no HTTP, no DB).
- Critical ordering invariant: `DB_PATH` must be set before requiring `src/backend/app` or `src/backend/db/connection`. The integration setup sets it at module load time.

## Conventions

- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Enforced by `CONTRIBUTING.md`.
- **Formatting**: Prettier. Run `npm run format` before committing.
- **API response shape**: `{ success: boolean, data?: ..., error?: ... }` (error routes) or `{ success: boolean, message?: ... }` (auth routes).
- **Row-to-camelCase mapping**: Database columns use `snake_case`; API responses and frontend use `camelCase`. Each route file has its own `mapXxxRow()` function.
- **Session token format**: base64url-encoded JSON, stored in `localStorage` under key `escooter.session`. Passed as `Authorization: Bearer <token>`.
- **Role enforcement is server-authoritative**: The frontend `roles.js` exists only for UI gating. Every protected endpoint independently authenticates and authorizes.
- **Self-registration is restricted**: `POST /api/auth/register` only allows `standard`, `student`, `senior` roles. Staff/admin accounts are created via `npm run db:init` or direct DB insertion.
