# Design Specifications (CW2): Client–Server Architecture, RBAC Strategy, and API Philosophy

This document provides a structured technical overview of the system design implemented for CW2. It describes the adopted **client–server architecture**, the **role-based access control (RBAC)** strategy and middleware enforcement model, and the guiding **API design philosophy** used to maintain consistency, security, and testability.

## 1. Architectural Overview (Client–Server)

### 1.1 System Topology
The application is a web-based e-scooter rental platform built using a classical client–server model:
- **Client (Frontend)**: React (Vite) single-page application (SPA) responsible for user interaction, UI state, and rendering.
- **Server (Backend)**: Node.js with Express providing a REST-style HTTP API, handling authentication, authorisation, validation, and persistence.
- **Persistence Layer**: SQLite relational database enforcing foreign-key constraints and integrity checks.

The frontend communicates with the backend over HTTP using JSON payloads. In production, the backend serves the frontend; during development, the frontend runs as a separate dev server and requests are made to the backend via standard cross-origin mechanisms.

### 1.2 Backend Composition
The backend is structured as a set of small, purpose-driven modules:
- **Entry point**: `src/backend/server.js` starts the HTTP listener and binds the Express app.
- **App factory and middleware assembly**: `src/backend/app.js` constructs the Express app, configures global middleware, and mounts feature routers.
- **Route modules**: router files under `src/backend/routes/` expose cohesive API surfaces (auth, scooters, bookings, issues).
- **Domain and validation services**: domain-specific logic (e.g., booking transaction logic; scooter payload validation) is isolated into service modules to support unit testing and reuse.
- **Database connection and access layer**: `src/backend/db/connection.js` provides a singleton SQLite connection; `src/backend/database.js` provides reusable query helpers and serialised transaction support.

### 1.3 Database Model and Integrity
The schema enforces data integrity using relational constraints and check constraints. Key properties include:
- **Foreign keys** are enabled explicitly at connection time to prevent silent integrity degradation.
- Domain constraints are encoded at the database level (e.g., closed sets for scooter status, booking duration, issue priority/status; non-negative pricing and totals).
- Soft-retire is implemented for scooters (status set to `retired` rather than row deletion), preserving historical booking/issue relationships.

## 2. Authentication and Session Model

### 2.1 Password Security
Passwords are stored using salted, computationally expensive hashing:
- Salted hashes are generated using `scrypt` (with a unique random salt per user).
- Verification uses timing-safe comparison to reduce side-channel leakage.

### 2.2 Session Tokens (Stateless)
Authentication uses a stateless session-token model:
- Tokens are **base64url-encoded JSON payloads** containing user identity and role fields (not JWT).
- The client stores the session token in local storage and sends it on every protected request using the `Authorization: Bearer <token>` header.

This design deliberately avoids a server-side session store, reducing operational complexity for a coursework-scale deployment while maintaining predictable behaviour under testing.

## 3. RBAC Middleware Strategy (Server-Authoritative)

### 3.1 Core Principle
The system enforces RBAC **on the server** as the single source of truth. Frontend role checks are used only for **UI gating** (e.g., which navigation options to show), not for security.

### 3.2 Middleware Flow
Protected route handlers follow a consistent two-phase authorisation pattern:
1. **Authentication**: extract and parse the Bearer token; map it to a concrete database user identity.
2. **Authorisation**: apply a role predicate (admin-only, staff-or-admin, or ownership checks) before processing domain logic.

This is implemented via the backend middleware and helper functions:
- `src/backend/auth-middleware.js` provides:
  - `authenticateRequest(req, res)`: validates and parses token, then loads the user record; on failure returns 401.
  - `requireAdmin(res, user)`: enforces admin-only access; on denial returns 403.
  - `requireStaff(res, user)`: enforces staff-or-admin access; on denial returns 403.

### 3.3 Role Normalisation as a Security Primitive
The role model includes a defensive normalisation step:
- `src/backend/roles.js` normalises `userType` values embedded in tokens; unknown or malformed values are downgraded to `standard`.

This prevents privilege escalation via crafted tokens because possession of a token claiming an unrecognised role cannot elevate access; the server will treat such roles as unprivileged.

### 3.4 Ownership Checks (Resource-Level Authorisation)
Beyond role gates, the system applies ownership checks for user-scoped resources:
- Booking cancellation and extension require both authentication and verification that the booking belongs to the current user (in addition to status validation such as “active”).

This ensures that authenticated users cannot manipulate other users’ bookings even if they know a booking identifier.

## 4. API Design Philosophy

### 4.1 Consistent Resource-Oriented Endpoints
The API is organised around cohesive resource categories:
- **Auth**: registration and login.
- **Scooters**: public fleet listing; admin CRUD and soft-retire.
- **Bookings**: create/list-own/cancel/extend; admin income analytics.
- **Issues**: authenticated submission; staff/admin triage with filterable listing and state transitions.

Endpoints are designed to be predictable and narrow in responsibility, improving maintainability and testability.

### 4.2 Validation Strategy (Defensive by Default)
Validation is applied at multiple layers:
- **Request validation**: payload structure and business constraints are validated in service-level helpers where possible (e.g., scooter payload validation shared between create and update; payment payload validation and simulation logic).
- **Database-level constraints**: check constraints and foreign-key constraints defend against invalid persisted states.

This multi-layer validation ensures failures are detected early and consistently, and it supports meaningful HTTP error responses rather than database exceptions leaking to clients.

### 4.3 Response Consistency and Mapping
The API maintains consistent conventions:
- **Database columns** use `snake_case`; the API responds using `camelCase`. Each route layer maps rows to a stable API shape using dedicated mapping functions.
- Error reporting follows a predictable JSON pattern to support straightforward frontend error rendering and automated testing.

#### 4.3.1 API Response Envelope (Success/Error Contract)
To support predictable client logic and test assertions, the API adopts a stable response envelope:
- **Success responses** return an explicit success flag and, where applicable, a `data` payload.
- **Error responses** return an explicit success flag and a structured `error` message.

On the client side, requests are funneled through a single fetch wrapper (`src/frontend/utils/api.js`), which centralises:
- JSON parsing and non-2xx handling (errors surface as user-visible messages rather than silent failures).
- Attachment of the `Authorization: Bearer <token>` header when a session is present.

### 4.4 Transactional Correctness and Concurrency Controls
SQLite has limited write concurrency, therefore multi-step writes are designed for correctness under concurrent requests:
- Multi-table write operations (e.g., booking creation which both reserves a scooter and inserts a booking) are performed atomically.
- Write paths that span multiple statements are serialised via a promise-based mutex to avoid `SQLITE_BUSY` failures and to preserve a consistent system state under load.

## 5. Testability as a Design Constraint

The design explicitly supports automated testing:
- The backend exposes a test-friendly app-construction path (factory pattern) allowing integration tests to mount the app without opening a network port.
- Integration tests run with an in-memory SQLite database and deterministically apply schema and seed scripts.
- RBAC behaviour is tested systematically using role-specific tokens, validating 401/403/200 boundaries.

This testability-first design supports evidence-based verification in the coursework context and reduces regression risk during late-stage integration.

