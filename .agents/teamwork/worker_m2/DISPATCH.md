## 2026-11-01T12:18:08Z
You are Worker M2 (teamwork_worker).
Your working directory is: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\worker_m2
Your parent is the Project Orchestrator (Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536).

CRITICAL REQUIREMENT:
Read the authoritative user request at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\ORIGINAL_REQUEST.md
Read the project specifications at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
`package.json` and `test/` directory exclusively. Do NOT edit `server.js`.

CRITICAL INSTRUCTION ON TOOL USAGE AND TURN ORDER:
DO NOT CALL `send_message` IN YOUR FIRST TURN!
You MUST perform file updates and test execution first.

IN YOUR FIRST TURN:
1. Update `c:\Users\mouni\Desktop\my-cloaker\package.json` using `replace_file_content` to add `"test": "node --test test/**/*.test.js"` to `"scripts"`.
2. Use `write_to_file` to create `c:\Users\mouni\Desktop\my-cloaker\test\server.test.js`.
   Implement tests using native `node:test` and `node:assert/strict` and global `fetch`:
   - Startup & Modular Export tests:
     - Verify requiring `../server.js` exports `{ app, startServer, stopServer }` without auto-listening.
     - Verify `startServer(0)` binds dynamic port, returns listening server.
     - Verify `stopServer()` closes server cleanly.
     - Verify port collision: `startServer(occupiedPort)` rejects with `EADDRINUSE`.
   - Health Endpoints tests:
     - Verify `GET /health` returns 200 OK with `{ status: "ok" }`, numeric `uptime`, ISO `timestamp`.
     - Verify `GET /api/health` returns 200 OK with same structure.
   - Core API Endpoints tests:
     - Verify `GET /favicon.ico` returns 200 with SVG `Content-Type: image/svg+xml`.
     - Verify `GET /api/config` returns 200 with configuration object.
     - Verify `POST /api/config` updates configuration.
     - Verify `GET /api/campaigns` returns 200 with campaigns array.
     - Verify `DELETE /api/campaigns/:id` returns 200 with success status.
     - Verify `POST /api/generate` returns 200 with workerCode and robotsTxt.
     - Verify `GET /api/zones` returns 200 or handles unauthenticated token gracefully.
     - Verify `POST /api/verify-cf` returns verification response.
     - Verify `GET /api/analytics/posts`, `POST /api/analytics/simulate`, `POST /api/analytics/reset` return 200 or handle DB operations safely.
   - Error Resilience & Middleware tests:
     - Verify malformed JSON POST returns 400 Bad Request with `{ error: ... }` JSON (no HTML leak).
     - Verify unknown route returns 404.
   - Graceful Lifecycle test:
     - Verify clean teardown with `stopServer()` and zero socket leaks.
