## 2026-11-01T12:11:54Z
You are Milestone 1 Explorer 3 (teamwork_explorer).
Your working directory is: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_3
Your parent is the Project Orchestrator (Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536).

CRITICAL REQUIREMENT:
Read the authoritative user request at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\ORIGINAL_REQUEST.md
Read the project specifications at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\PROJECT.md

SCOPE & OBJECTIVE (Milestone 1: Process Signals, Socket Teardown & Global Guards Fix Strategy):
In `c:\Users\mouni\Desktop\my-cloaker\server.js`, design the exact code remediation for:
1. Signal handling:
   - Implement `process.on('SIGINT')` and `process.on('SIGTERM')`.
   - On signal receipt, log graceful shutdown initiation, call `server.close()` (and `server.closeAllConnections()` in Node 18+), and ensure `process.exit(0)` is invoked cleanly.
   - Include a fallback timeout (e.g. 5 seconds) to forcefully terminate if connections do not drain.
2. Global process crash prevention:
   - Add `process.on('uncaughtException', (err) => { ... })` and `process.on('unhandledRejection', (reason, promise) => { ... })` to log structured diagnostics and prevent silent or abrupt crashing.
3. Socket tracking & clean connection termination.

OUTPUT REQUIREMENTS:
- Write your remediation strategy and exact code snippets to `c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_3\handoff.md` using `write_to_file`.
- Update `progress.md`.
- Send message to parent (99771219-9d06-49a7-a16f-250903dc2536).

CONSTRAINTS:
- Do NOT implement or edit `server.js` directly (you are read-only). You recommend the fix strategy.
