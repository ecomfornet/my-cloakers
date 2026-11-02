## 2026-11-01T12:12:34Z
You are Worker M1 (teamwork_worker).
Your working directory is: c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\worker_m1
Your parent is the Project Orchestrator (Conversation ID: 99771219-9d06-49a7-a16f-250903dc2536).

CRITICAL REQUIREMENT:
Read the authoritative user request at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\ORIGINAL_REQUEST.md
Read the project specifications at:
c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own `c:\Users\mouni\Desktop\my-cloaker\server.js` exclusively. Do not edit `package.json` or other files in this milestone.

OBJECTIVE (Milestone 1: Server Startup, Runtime Stability, Health Endpoint & Graceful Shutdown):
In `c:\Users\mouni\Desktop\my-cloaker\server.js`, implement the following stability fixes:
1. Modular Export & Controllable Lifecycle:
   - Encapsulate server startup into `function startServer(port = PORT)` returning a Promise that resolves to the listening HTTP server instance (`server = srv; resolve(srv)`).
   - Encapsulate server teardown into `function stopServer()` returning a Promise that resolves when closed:
     ```javascript
     function stopServer() {
       return new Promise((resolve) => {
         if (!server) return resolve();
         if (typeof server.closeAllConnections === 'function') {
           server.closeAllConnections();
         }
         server.close(() => resolve());
       });
     }
     ```
   - Only start listening automatically if running directly:
     ```javascript
     if (require.main === module) {
       startServer().catch((err) => {
         console.error('Failed to start server:', err);
         process.exit(1);
       });
     }
     ```
   - Export `{ app, server: () => server, startServer, stopServer }` and `module.exports = { app, server, startServer, stopServer }`.
2. Clean `EADDRINUSE` Port Collision Handling:
   - When `server.on('error', (err) => { ... })` encounters `EADDRINUSE`:
     Log error clearly and, if `require.main === module`, call `process.exit(1)`. If inside `startServer()`, reject the promise.
3. Health Check Routes:
   - Add dedicated endpoints for both `GET /health` and `GET /api/health`:
     ```javascript
     app.get(['/health', '/api/health'], (req, res) => {
       res.status(200).json({
         status: 'ok',
         uptime: process.uptime(),
         timestamp: new Date().toISOString()
       });
     });
     ```
4. Graceful Shutdown & Process Signals:
   - Add handlers for `SIGINT` and `SIGTERM`:
     ```javascript
     let isShuttingDown = false;
     function handleGracefulShutdown(signal) {
       if (isShuttingDown) return;
       isShuttingDown = true;
       console.log(`\n[Shutdown] Received ${signal}. Closing server and draining connections...`);
       const forceTimer = setTimeout(() => {
         console.error('[Shutdown] Forceful shutdown timeout exceeded. Exiting.');
         process.exit(1);
       }, 5000);
       forceTimer.unref();

       stopServer().then(() => {
         console.log('[Shutdown] Server closed cleanly.');
         process.exit(0);
       }).catch((err) => {
         console.error('[Shutdown] Error during close:', err);
         process.exit(1);
       });
     }
     process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
     process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
     ```
5. Process Crash Guards:
   - Add global error traps:
     ```javascript
     process.on('uncaughtException', (err) => {
       console.error('[Process] Uncaught Exception:', err);
     });
     process.on('unhandledRejection', (reason, promise) => {
       console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
     });
     ```
6. Centralized Express Error Handling & Safety:
   - Add centralized error middleware at the end of `server.js`:
     ```javascript
     app.use((err, req, res, next) => {
       const status = err.status || err.statusCode || 500;
       res.status(status).json({ error: err.message || 'Internal Server Error' });
     });
     ```
   - In `POST /api/config` and other routes, ensure `req.body = req.body || {};` to prevent TypeError when destructuring.
7. Background Network Safety:
   - In `startServer()`, do not run background `verifyCloudflare()` if `process.env.NODE_ENV === 'test'`.

VERIFICATION:
Run `node -c server.js` to ensure zero syntax errors.
Verify that requiring `server.js` does not immediately block or bind port 5050.
Document your changes and verification command results in `handoff.md`.
Send message to parent when complete.
