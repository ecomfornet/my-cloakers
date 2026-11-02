# BRIEFING — 2026-11-01T12:10:45Z

## Mission
Investigate `server.js` in `c:\Users\mouni\Desktop\my-cloaker` to comprehensively catalog all routes/endpoints, cloaking & detection logic, runtime crash vectors, and health check behavior.

## 🔒 My Identity
- Archetype: explorer
- Roles: teamwork_explorer
- Working directory: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_survey_2_gen2
- Original parent: 99771219-9d06-49a7-a16f-250903dc2536
- Milestone: Survey Phase - server.js Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify `server.js` or `package.json`
- Grounded findings only: quote exact line numbers and code excerpts
- Write handoff.md before sending message to parent

## Current Parent
- Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536
- Updated: 2026-11-01T12:07:12Z

## Investigation State
- **Explored paths**: `server.js` (lines 1–1288), `package.json`, `dashboard-campaigns.json`, `start-dashboard.bat`, `src/index.js`, `public/index.html`
- **Key findings**:
  1. 12 endpoints (and 2 middlewares) enumerated with exact line citations.
  2. Cloaking logic spans Method 1 (Human verification trigger) and Method 2 (D1 24h rolling unique visitor threshold).
  3. Edge bot detection via `isBot(ua)` (7 tiers) + client-side `scanAutomation()` (5 tiers) + `e.isTrusted` checks.
  4. NO `/health` or `/api/health` endpoint exists (returns 404).
  5. Critical crash/hang vectors identified: `EADDRINUSE` handler does not call `process.exit()`, unhandled exceptions in `POST /api/config` and `GET /api/campaigns`, unhandled promise rejection risk in `POST /api/verify-cf`, raw SQL string interpolation in `POST /api/analytics/simulate`, synchronous file I/O, missing `SIGINT`/`SIGTERM` handlers, missing global JSON error middleware.
- **Unexplored areas**: None within the scope of `server.js` survey.

## Key Decisions Made
- Fully documented all 4 investigation categories with exact line numbers and code excerpts into `handoff.md`.

## Artifact Index
- DISPATCH.md — Log of dispatch messages
- progress.md — Liveness & step updates
- BRIEFING.md — Persistent context & memory
- handoff.md — Final structured report
