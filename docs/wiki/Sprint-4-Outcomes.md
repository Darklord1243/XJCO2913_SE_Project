# Sprint 4 Outcomes: Admin Mode, UX Hardening, and Test Integration

## Sprint Goal
Consolidate and harden the system for submission readiness by finalising the admin experience, completing the staff-facing issue triage pipeline, strengthening accessibility and responsive UI behaviour, and integrating a comprehensive automated testing layer (unit + integration) to support a “code-freeze” transition.

## Achievements (High-Level)
- Delivered a role-split application experience (Admin vs Customer) with a complete admin dashboard suite.
- Finalised the issue/feedback workflow for staff/admin triage (escalation and resolution).
- Implemented graphical weekly income visualisation and improved non-functional quality (responsive design + accessibility).
- Introduced a robust integration test harness with RBAC coverage across protected endpoints.
- Consolidated documentation for assessment traceability and operational guidance (including migration instructions and admin bootstrap).

## Finalised Features (Implementation Summary)

1. **Admin Mode and Route Splitting (UX hardening)**  
   The frontend now renders **two distinct route trees** based on the current session role (admin vs customer). Admin users land at `/admin/bookings`, while customer users land at `/map`. This separation reduces accidental exposure of privileged UI affordances and supports clearer workflow-focused navigation.

2. **Admin Dashboard Suite (Bookings, Fleet, Issues, Income)**  
   Implemented a dedicated admin interface comprising:
   - Bookings oversight with filtering and summary metrics.
   - Fleet management with full CRUD and soft-retire/reactivation flows.
   - Issue triage with escalation/de-escalation (priority) and resolve/reopen (status).
   - Weekly income reporting with per-plan summaries.

3. **Issue / Feedback Pipeline (Staff/Admin)**  
   Finalised staff/admin operational controls over user-reported issues:
   - Staff/admin can list issues and apply controlled state transitions for `priority` (low/high) and `status` (open/resolved).
   - Role gates are server-authoritative (UI gating is purely presentational).

4. **Graphical Weekly Income Plotting (Non-Functional Requirement)**  
   Added a graphical income visualisation on the admin income page (bar chart), improving interpretability of the weekly income endpoint without changing the underlying financial aggregation contract.

5. **Responsive UI and Accessibility Hardening (Non-Functional Requirements)**  
   Finalised responsive layout behaviour via multiple breakpoints and strengthened accessibility using ARIA labels, `aria-live` regions, semantic landmarks, and dialog semantics. These measures improve usability under screen readers and on mobile/tablet breakpoints.

6. **SQLite Concurrency Hardening**  
   Introduced an application-level write-serialization strategy for SQLite using a promise-based mutex for multi-table write paths, preventing `SQLITE_BUSY` under concurrent request patterns.

## Testing Integration (Unit + Integration)

### Integration Test Harness (Supertest + In-Memory SQLite)
Sprint 4 introduced a structured integration test layer that:
- Boots the Express app **without `listen()`** (test-only app factory pattern).
- Uses `DB_PATH=:memory:` to run schema and seed data deterministically.
- Provisions admin/rider/staff test users and mints session tokens.
- Exercises RBAC boundaries systematically (401 → 403 → 200) across protected endpoints.

### Coverage Highlights
- **Authentication flows**: self-registration role downgrading and token role validation through subsequent authorisation failures.
- **Scooter lifecycle**: admin CRUD, retire/reactivate, and conflict cases (e.g., retire while in use).
- **Bookings lifecycle**: booking creation guards (e.g., against retired scooters), and admin weekly income endpoint access controls.
- **Issues triage RBAC**: rider denial vs staff/admin permissions on escalation and resolution endpoints.

## Evidence from Sprint 4 Git History (Feature Branch)
The following commits (unique to the Sprint 4 feature branch) provide an evidence-based implementation trail for the changes above:
- `8067980` — `feat: finalize sprint 3 integration including cancellations and feedback`  
  Cancellation wiring + issues table and routes; introduction of SQLite write serialisation.
- `61e69ad` — `feat: implement staff feedback pipeline and enable strict SQLite foreign keys`  
  `PRAGMA foreign_keys = ON` enforcement and staff RBAC routes for issue triage.
- `84bc341` — `feat: add graphical income plotting, responsive CSS, and ARIA accessibility (IDs 21, 24, 25)`  
  Recharts bar chart + responsive CSS breakpoints + ARIA pass.
- `f48e239` — `feat: introduce admin dashboard, require password confirmation, clean up UI markers, and reorder navigation`  
  Route splitting, admin screens, confirm-password validation, and navigation hardening.
- `04b2fdd` — `Add Phase A integration test scaffolding and RBAC HTTP coverage`  
  Full integration test suite and DB-in-memory harness.
- `676f9b9` — `Finalize Phase B scooter lifecycle admin UX and docs`  
  Reactivation UX + README documentation + retire lifecycle test.
- `670e3ab` — `chore(docs): move school specs to requirements and add project log`  
  Coursework specs organisation and project log consolidation.

## Progress Summary

| Focus Area | Outcome |
|---|---|
| Admin capabilities | ✅ Admin dashboard suite completed (bookings, fleet, issues, income) |
| Issue triage pipeline | ✅ Staff/admin escalation + resolution finalised with RBAC enforcement |
| Quality attributes | ✅ Responsive UI and accessibility hardening delivered |
| Analytics UX | ✅ Weekly income visualisation implemented |
| Testing | ✅ Integration harness added; RBAC coverage across protected endpoints |
| Operational hardening | ✅ SQLite foreign keys enforced; write concurrency serialised |

