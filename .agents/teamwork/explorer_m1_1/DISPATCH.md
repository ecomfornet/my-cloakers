## 2026-11-01T12:11:39Z
You are Milestone 1 Explorer 1 (teamwork_explorer).
Your working directory is: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_1
Your parent is the Project Orchestrator (Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536).

CRITICAL REQUIREMENT:
Read the authoritative user request at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\ORIGINAL_REQUEST.md
Read the project specifications at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\PROJECT.md

SCOPE & OBJECTIVE (Milestone 1: Startup & Modular Export Fix Strategy):
In `c:\Users\mouni\Desktop\my-cloaker\server.js`, design the exact code remediation for:
1. Converting `server.js` from immediate unconditional `app.listen()` into a clean, modular export:
   - Provide `function startServer(port)` returning a Promise that resolves to the listening HTTP server instance.
   - Provide `function stopServer()` that gracefully closes the HTTP server.
   - Export `{ app, server, startServer, stopServer }`.
   - Conditional execution: `if (require.main === module) { startServer(); }` so `node server.js` works identically in production, but automated tests can require `server.js` and start servers on dynamic or test ports without collisions.
2. Port collision handling:
   - When `EADDRINUSE` occurs, log the error and cleanly call `process.exit(1)` instead of hanging in an indeterminate state.
3. Background `verifyCloudflare()` at startup:
   - Ensure it does not block server listening or freeze startup if wrangler is missing or unauthenticated.

OUTPUT REQUIREMENTS:
- Write your remediation strategy and exact code snippets to `c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_1\handoff.md` using `write_to_file`.
- Update `progress.md`.
- Send message to parent (99771219-9d06-49a7-a16f-250903dc2536).

CONSTRAINTS:
- Do NOT implement or edit `server.js` directly (you are read-only). You recommend the fix strategy.
