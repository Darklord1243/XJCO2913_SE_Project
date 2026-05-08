Sprint 1: Plan and Initial Design
1. Sprint 1 Objectives
For our first sprint, we are focusing on the core, high-priority Minimum Viable Product (MVP) features to establish our foundation.

ID 1: Support user accounts and user login (F - Priority 1)
ID 4: View hire options and cost (F - Priority 1)
ID 16/17: Configure and display e-scooter details/availability (F - Priority 1)
2. Tech Stack & Architecture
To ensure seamless integration and a unified language environment, we have adopted a full-stack JavaScript architecture:

Frontend: React.js
Backend: Node.js with Express.js
Database: SQLite (Embedded, no complex server setup required)
3. Team Workflow & Consistency Rules
To prevent integration conflicts and maintain a professional codebase, all team members must adhere to the following guardrails:

No Direct Pushes to Main: The main branch is locked. You must create a feature branch (e.g., feature/login-ui), commit your work, and open a Pull Request (PR).
Mandatory Code Review: Every PR requires at least one approval from another team member before it can be merged.
Automated Formatting: Prettier is installed. You must run npm run format in your terminal before committing your code to ensure consistent styling.
Conventional Commits: Prefix your commits to keep the history clean. Examples:
feat: added user login API
fix: resolved database connection crash
docs: updated meeting records
4. API Contract: GET /api/scooters
To allow Frontend and Backend to develop in parallel without blocking each other, we agree to the following data structure for the scooter list.

Backend: Must build the database and routes to output exactly this JSON.
Frontend: Will use this exact JSON as "mock data" to build the UI until the backend is merged.
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
        "oneHour": 5.00,
        "fourHours": 15.00,
        "oneDay": 30.00,
        "oneWeek": 120.00
      }
    }
  ]
}