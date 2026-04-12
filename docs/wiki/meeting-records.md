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
