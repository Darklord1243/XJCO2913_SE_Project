# Meeting Records

## 1. Sprint Planning Meeting
- **Date:** 2026-03-15
- **Time:** 14:00
- **Duration:** 60 mins
- **Scrum Master:** Siyuan Jiang
- **Attendance:** Siyuan (Chair), Jiahui (Plant), Yuhao (Monitor/Evaluator), Haozhe (Company Worker)

### Agenda & Outcomes
- **Stack Decision (Conflict Resolution):** Discussed initial proposal for Python/Flask. Decided to officially ban Python/Flask for this project to ensure a unified full-stack JavaScript environment (React/Node) that better aligns with the module's client-server expectations and prevents context-switching.
- **Backlog Selection:** Agreed to implement IDs 1, 4, 16, and 17.
- **Task Allocation:** Haozhe (Backend Auth/Scooter Logic), Yuhao (Architecture, Database, Frontend Integration), Jiahui (UI/UX Design), Siyuan (Project Management).

## 2. Status Meeting 1
- **Date:** 2026-03-20
- **Attendance:** All present.

### Agenda & Outcomes
- **What was done:** Database schema drafted. Backend validation logic written.
- **What is next:** Connect frontend UI to backend APIs.
- **Blockers/Issues:** Discovered siloed working. Haozhe developed the frontend using Vanilla JS/HTML locally instead of the agreed-upon React stack in the shared repository.

## 3. Status Meeting 2
- **Date:** 2026-03-25
- **Attendance:** All present.

### Agenda & Outcomes
- **What was done:** Extracted backend logic into modular Express routes.
- **What is next:** Complete React translation.
- **Blockers/Issues:** Resolving CORS errors between Vite (Port 5173) and Express (Port 3000). Successfully mapped Vanilla JS DOM logic into React useState hooks.

## 4. Sprint Review & Retrospective
- **Date:** 2026-03-30
- **Time:** 15:00
- **Attendance:** All present.

### Review (Product)
- Successfully demoed user registration, dynamic scooter pricing (ID 4), and fleet availability (ID 17) to the team.

### Retrospective (Process)
- **What went well:** Excellent backend validation logic; API contract was strictly followed.
- **Conflict/Challenges:** The 'ZIP file' workflow caused severe integration delays and violated our architectural plan.
- **Action Items:** Enforced strict Git rules: No offline ZIP sharing. All code must be pushed to feature branches and merged via Pull Requests. Mandatory formatting checks (`npm run format`) before committing.

---

## Sprint 2: Booking Mechanism

### 5. Sprint 2 Planning Meeting
- **Date:** 2026-03-31
- **Time:** 14:00
- **Duration:** 45 mins
- **Scrum Master:** Siyuan Jiang
- **Attendance:** Siyuan (Chair), Jiahui (Plant), Yuhao (Monitor/Evaluator), Haozhe (Company Worker)

#### Agenda & Outcomes
- **Sprint 2 Objective:** Agreed to implement the core end-to-end booking mechanism targeting IDs 5, 6, 8, and 10.
- **Architecture Decision:** Discussed whether payment simulation should be a standalone module or embedded in the booking route. Decided on a dedicated `booking-service.js` layer to keep payment logic testable and separable from route handlers.
- **Database Design:** Reviewed proposed `bookings` table schema (user_id, scooter_id, duration_code, total_price, status). Agreed to use SQLite transactions for atomic booking creation + scooter status update.
- **Task Allocation:** Haozhe (backend booking route + payment simulation), Yuhao (bookings table + database migration), Jiahui (React booking modal + My Bookings dashboard UI), Siyuan (integration coordination + API contract testing).

### 6. Sprint 2 Status Meeting 1
- **Date:** 2026-04-03
- **Attendance:** All present.

#### Agenda & Outcomes
- **What was done:** `bookings` table deployed via migration. `POST /api/bookings` route scaffolded with authentication and scooter availability checks. Payment simulation function drafted in `booking-service.js`.
- **What is next:** Wire up the atomic transaction (booking INSERT + scooter status UPDATE). Begin frontend booking modal component.
- **Blockers/Issues:** React modal state management proved more complex than anticipated — coordinating scooter selection, duration picker, and payment form fields within a single controlled component. Jiahui to pair with Yuhao on state design.

### 7. Sprint 2 Status Meeting 2
- **Date:** 2026-04-07
- **Attendance:** All present.

#### Agenda & Outcomes
- **What was done:** Atomic transaction working in `POST /api/bookings` — booking creation and scooter `available → in_use` transition succeed or rollback together. React booking modal functional with duration selector and simulated card-payment form. `GET /api/bookings/me` endpoint serving user-specific booking history.
- **What is next:** Complete My Bookings dashboard page. Add edge-case handling (booking a retired scooter, double-booking prevention).
- **Blockers/Issues:** Minor — formatting inconsistencies between team members. Resolved by enforcing `npm run format` as a pre-commit gate as agreed in Sprint 1 retrospective.

### 8. Sprint 2 Review & Retrospective
- **Date:** 2026-04-10
- **Time:** 15:00
- **Attendance:** All present.

#### Review (Product)
- Successfully demoed end-to-end booking flow: customer selects scooter, picks duration, enters simulated card details, and receives booking confirmation. My Bookings dashboard displays active and completed bookings with scooter reference, duration, and total price.

#### Retrospective (Process)
- **What went well:** Atomic transaction design was robust from day one — zero data inconsistency issues. The decision to extract `booking-service.js` kept route handlers clean and made payment logic independently reviewable.
- **Conflict/Challenges:** Bookings with edge-case scooter states (e.g., a scooter retired mid-session) needed additional guard conditions that were not in the original plan.
- **Action Items:** Frontload edge-case analysis in planning phase for Sprint 3. Continue the feature-branch + PR workflow — it eliminated the integration delays experienced in Sprint 1.

---

## Sprint 3: Booking Lifecycle & Analytics

### 9. Sprint 3 Planning Meeting
- **Date:** 2026-04-13
- **Time:** 14:00
- **Duration:** 50 mins
- **Scrum Master:** Siyuan Jiang
- **Attendance:** Siyuan (Chair), Jiahui (Plant), Yuhao (Monitor/Evaluator), Haozhe (Company Worker)

#### Agenda & Outcomes
- **Sprint 3 Objective:** Complete the booking lifecycle (cancel + extend), introduce weekly revenue analytics, and deliver an interactive scooter map. Targeting IDs 12, 19, 11, and 18.
- **Design Decisions:**
  - Cancellation (ID 12): `PATCH /api/bookings/:id/cancel` — atomically sets booking to `completed` and scooter to `available`. No row deletion.
  - Extension (ID 11): `PATCH /api/bookings/:id/extend` — server-side duration-rank validation ensuring only longer plans are permitted, with authoritative price recalculation from `scooter_pricing`.
  - Income (ID 19): `GET /api/bookings/income/weekly` — aggregate `total_price` by `duration_code` over a configurable 7-day window. No schema change needed.
  - Map (ID 18): Leaflet.js with OpenStreetMap tiles, colour-coded markers per scooter status.
- **Task Allocation:** Haozhe (cancel + extend endpoints + AsyncMutex concurrency hardening), Yuhao (income endpoint + Leaflet map component), Jiahui (My Bookings enhancements + Income dashboard UI), Siyuan (API contract testing + documentation).

### 10. Sprint 3 Status Meeting 1
- **Date:** 2026-04-17
- **Attendance:** All present.

#### Agenda & Outcomes
- **What was done:** Cancel endpoint implemented with atomic transaction. Extend endpoint scaffolded. Income query designed and returning correct aggregations by `duration_code`. Leaflet map rendering with OpenStreetMap tiles centred on Leeds.
- **What is next:** Complete extend endpoint with duration-rank validation. Add colour-coded scooter markers to map. Begin frontend income dashboard with week navigator.
- **Blockers/Issues:** Duration-rank validation for the extend endpoint required careful ordering logic — the team debated whether to enforce a strict total ordering (1hr < 4hr < 1day < 1week) server-side or trust client input. Decided on server-authoritative enforcement.

### 11. Sprint 3 Status Meeting 2
- **Date:** 2026-04-21
- **Attendance:** All present.

#### Agenda & Outcomes
- **What was done:** Extend endpoint complete with server-side duration-rank enforcement and price recalculation. Income dashboard rendering four per-plan cards with week navigation. Scooter map displaying colour-coded markers with popup details.
- **What is next:** Final integration pass — connect frontend cancel/extend buttons to live API. Polish map legend and marker styling. Begin Sprint 3 integration testing.
- **Blockers/Issues:** Discovered that simultaneous booking cancellations could trigger `SQLITE_BUSY` under concurrent requests. Haozhe proposed an application-level mutex (AsyncMutex) to serialize SQLite writes. Team agreed to implement in `database.js` as a shared utility.

### 12. Sprint 3 Review & Retrospective
- **Date:** 2026-04-25
- **Time:** 15:00
- **Attendance:** All present.

#### Review (Product)
- Successfully demoed full booking lifecycle: cancellation restores scooter availability atomically, extension upgrades duration with correct price recalculation. Weekly income dashboard shows per-plan revenue aggregation with working Previous/Next week navigation. Interactive map renders all five Leeds scooter locations with colour-coded status markers and informative popups.

#### Retrospective (Process)
- **What went well:** Server-authoritative validation on extend endpoint prevented any client-side pricing manipulation. The AsyncMutex pattern for write serialization resolved the concurrency concern cleanly without a database migration. Leaflet map exceeded expectations — the colour-coded markers made fleet status immediately visible.
- **Conflict/Challenges:** The income aggregation query initially returned misleading results when bookings spanned week boundaries. Resolved by anchoring the 7-day window to `created_at` rather than mixing `created_at` and `updated_at`.
- **Action Items:** For Sprint 4, prioritize non-functional hardening (accessibility, responsive design, integration tests) alongside the admin feature set. The system is functionally complete but needs polishing for submission readiness.

---

## Sprint 4: Admin Mode, UX Hardening & Test Integration

### 13. Sprint 4 Planning Meeting
- **Date:** 2026-04-28
- **Time:** 14:00
- **Duration:** 55 mins
- **Scrum Master:** Siyuan Jiang
- **Attendance:** Siyuan (Chair), Jiahui (Plant), Yuhao (Monitor/Evaluator), Haozhe (Company Worker)

#### Agenda & Outcomes
- **Sprint 4 Objective:** Consolidate and harden the system for assessment submission. Deliver admin dashboard suite, finalize the staff issue triage pipeline, strengthen accessibility and responsive UI, and integrate a comprehensive automated testing layer. This is the final sprint before code freeze.
- **Design Decisions:**
  - **Admin Route Split:** Frontend `App.jsx` will conditionally render completely separate route trees based on `isAdminSession(session)` — admin users land at `/admin/bookings`, customers at `/map`. No shared UI affordances between roles.
  - **Issue Pipeline:** Staff/admin triage workflow with `PATCH /issues/:id/priority` (escalate/de-escalate) and `PATCH /issues/:id/status` (resolve/reopen). All operations gated behind `requireStaff()`.
  - **Integration Testing:** Introduce Supertest-based harness with in-memory SQLite (`DB_PATH=:memory:`) for deterministic RBAC testing across all protected endpoints.
  - **Accessibility (ID 25):** WCAG ARIA labels, `aria-live` regions, skip-to-content link, dialog semantics, `prefers-reduced-motion` support, and contrast token hardening.
- **Task Allocation:** Haozhe (issue pipeline backend + AsyncMutex extension), Yuhao (integration test harness + CI script), Jiahui (admin dashboard UI + responsive CSS + accessibility pass), Siyuan (Recharts income chart + documentation consolidation + backlog checklist).

### 14. Sprint 4 Status Meeting 1
- **Date:** 2026-05-01
- **Attendance:** All present.

#### Agenda & Outcomes
- **What was done:** Admin route split implemented — `App.jsx` now renders separate `<Route>` trees for admin vs customer. Issue pipeline endpoints live with full RBAC gating. Admin dashboard pages scaffolded (Bookings, Fleet, Issues, Income). AsyncMutex extended to cancellation flow.
- **What is next:** Complete integration test scaffolding with in-memory DB. Implement responsive CSS breakpoints. Begin accessibility hardening pass.
- **Blockers/Issues:** Enabling `PRAGMA foreign_keys = ON` broke several existing seed data inserts due to referential integrity violations. Yuhao to fix seed script ordering and add explicit foreign key validation.

### 15. Sprint 4 Status Meeting 2
- **Date:** 2026-05-05
- **Attendance:** All present.

#### Agenda & Outcomes
- **What was done:** Integration test harness operational — 4 test files covering auth, scooters, bookings, and issues RBAC with 401/403/200 assertions. Responsive breakpoints deployed (1100px, 900px, 768px, 600px). ARIA pass complete: skip-to-content link, `aria-label`/`aria-haspopup`/`aria-expanded` on interactive elements, `aria-live` regions, `role="dialog"` on booking modal, `role="alert"` on error states, `prefers-reduced-motion` media query. Recharts bar chart rendering weekly income data on admin income page.
- **What is next:** Final documentation pass (Sprint 4 outcomes, user manual updates, backlog checklist). Admin fleet management CRUD finalization (soft-retire/reactivate). Pre-submission integration smoke test.
- **Blockers/Issues:** None — on track for code freeze and submission.

### 16. Sprint 4 Review & Retrospective
- **Date:** 2026-05-08
- **Time:** 15:00
- **Attendance:** All present.

#### Review (Product)
- Successfully demoed the complete admin experience: role-split route trees, admin dashboard (Bookings, Fleet, Issues, Income), issue triage pipeline with escalation and resolution, Recharts weekly income bar chart, and admin fleet CRUD with soft-retire/reactivate. Customer-facing UI verified to be fully separated with no admin affordances leaking through. Integration test suite passing all 7 test files with systematic RBAC coverage. Accessibility features verified: skip-to-content link, ARIA labels throughout, responsive layout across all breakpoints, and reduced-motion support.

#### Retrospective (Process)
- **What went well:** The admin/customer route split was a clean architectural decision that eliminated entire categories of potential UI bugs. Integration test harness gave the team confidence to refactor without regressions during the final hardening phase. AsyncMutex pattern proved effective in preventing concurrency issues. Team velocity was strong and consistent across all four sprints.
- **Conflict/Challenges:** The `PRAGMA foreign_keys = ON` enforcement surfaced pre-existing seed data issues that required careful resolution. Accessibility auditing was a learning curve for the team — future projects should integrate a11y checks earlier in the development cycle.
- **Action Items:** Submit the system for assessment. Archive all sprint documentation. The project log should be updated with final cumulative progress. All future work should consider a database migration to PostgreSQL for production deployment if the system moves beyond assessment stage.

