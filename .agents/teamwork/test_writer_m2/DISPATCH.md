## 2026-11-01T12:15:35Z
You are Milestone 2 Test Writer (teamwork_test_writer).
Your working directory is: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\test_writer_m2
Your parent is the Project Orchestrator (Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536).

CRITICAL REQUIREMENT:
Read the authoritative user request at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\ORIGINAL_REQUEST.md
Read the project specifications at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\PROJECT.md
Read the test infrastructure design at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\TEST_INFRA.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own `c:\Users\mouni\Desktop\my-cloaker\package.json` and the `c:\Users\mouni\Desktop\my-cloaker\test\` directory exclusively. Do NOT modify `server.js` (it has already been refactored and approved).

OBJECTIVE (Milestone 2: Automated Test Suite Implementation & Verification):
1. Configure `package.json`:
   - Set `"scripts": { ..., "test": "node --test test/**/*.test.js" }`.
   - WARNING: Do NOT use bare `node --test` because `scratch/` contains ad-hoc scripts that call live external URLs. Strictly scope tests to `test/**/*.test.js`.
2. Implement Comprehensive Automated Tests in `test/` using Node.js built-in `node:test` and `node:assert/strict`:
   - `test/startup.test.js`:
     - Test requiring `server.js` exports `{ app, server, startServer, stopServer }` without auto-binding port 5050.
     - Test calling `startServer(0)` binds an ephemeral port cleanly and returns listening HTTP server.
     - Test calling `stopServer()` shuts down cleanly without hanging.
     - Test that `startServer(occupiedPort)` rejects with `EADDRINUSE`.
   - `test/health.test.js`:
     - Test `GET /health` returns 200 OK with `{ status: "ok", uptime: <number>, timestamp: <string> }`.
     - Test `GET /api/health` returns 200 OK with same structure.
   - `test/endpoints.test.js`:
     - Test `GET /favicon.ico` returns 200 with SVG content-type.
     - Test `GET /api/config` returns 200 with JSON configuration.
     - Test `POST /api/config` saves config updates.
     - Test `GET /api/campaigns` returns 200 with campaign list.
     - Test `DELETE /api/campaigns/:id` handles existing and nonexistent IDs.
     - Test `POST /api/generate` returns 200 with worker code and preview.
     - Test `GET /api/zones` returns 200 or handles unauthenticated CF token gracefully.
     - Test `POST /api/verify-cf` handles verification.
     - Test `GET /api/analytics/posts`, `POST /api/analytics/simulate`, `POST /api/analytics/reset` return 200 / handle queries safely.
   - `test/cloaker.test.js`:
     - Test bot detection rules in worker generation (`isBot` UA patterns for Googlebot, Pinterest, curl, headless browsers).
     - Test dynamic robots.txt generation.
     - Test Method 1 (trigger condition) vs Method 2 (visitor threshold) code generation.
   - `test/lifecycle.test.js`:
     - Test graceful shutdown simulation via `stopServer()`.
     - Test malformed JSON POST returns 400 Bad Request via Express error middleware with `{ error: ... }`, no HTML dump or crash.
     - Test unknown API routes return 404 JSON `{ error: ... }`.
3. Execution & Verification:
   - Run `npm test`.
   - Ensure ALL test suites and cases execute cleanly and pass with exit code 0, zero failures, zero hangs, and zero unhandled rejections.
4. Deliverables:
   - Document test execution commands, test counts, coverage, and results in `handoff.md`.
   - Send message to parent with summary and test results.
