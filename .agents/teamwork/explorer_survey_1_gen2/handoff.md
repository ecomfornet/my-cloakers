# Handoff Report: Survey of server.js and package.json (Startup Flow, Blocking, Lifecycle & Signals)

**Agent**: Survey Explorer 1 (Gen 2) (`explorer_survey_1_gen2`)  
**Target Files**:  
- `c:\Users\mouni\Desktop\my-cloaker\server.js` (1288 lines)  
- `c:\Users\mouni\Desktop\my-cloaker\package.json` (17 lines)  
**Parent**: Project Orchestrator (`99771219-9d06-49a7-a16f-250903dc2536`)  
**Date**: 2026-11-01  

---

## 1. Observation

Direct examination of `c:\Users\mouni\Desktop\my-cloaker\server.js` and `package.json` via `view_file` yielded the following concrete, verifiable code observations:

### Observation 1.1: Startup Flow & Unconditional `app.listen()` at Module Scope
- **File**: `server.js`, Lines 1–10:
  ```javascript
  1: const express = require('express');
  2: const fs = require('fs');
  3: const path = require('path');
  4: const { exec } = require('child_process');
  5: 
  6: const app = express();
  7: const PORT = process.env.PORT || 5050;
  8: 
  9: app.use(express.json());
  10: app.use(express.static(path.join(__dirname, 'public')));
  ```
- **File**: `server.js`, Lines 1264–1278:
  ```javascript
  1264: const server = app.listen(PORT, () => {
  1265:   console.log(`\n======================================================`);
  1266:   console.log(`🚀 Cloaker Dashboard is running!`);
  1267:   console.log(`👉 Open: http://localhost:${PORT}`);
  1268:   console.log(`======================================================\n`);
  1269: 
  1270:   // Pre-verify Cloudflare credentials in background on startup so UI connects instantly
  1271:   verifyCloudflare().then(res => {
  1272:     if (res.success) {
  1273:       console.log(`[Cloudflare] Pre-verified: ${res.account?.name} (${res.zonesCount} zones)`);
  1274:     } else {
  1275:       console.log(`[Cloudflare] Pre-verify notice: ${res.message}`);
  1276:     }
  1277:   }).catch(() => {});
  1278: });
  ```
- **File**: `server.js`, Line 1288 (EOF):
  The file ends immediately after `server.on('error', ...)`. There is **NO** `module.exports = app;` or `module.exports = { app, server };`.
- Any external script or test runner executing `require('./server.js')` triggers an immediate network bind on port 5050 (or `process.env.PORT`), returns an empty object `{}` instead of the Express application or HTTP server instance, and prevents automated testing with programmatic servers or port virtualization.

### Observation 1.2: Background Network Activity & Shell Spawning on Startup
- **File**: `server.js`, Lines 1271–1277:
  Inside the `app.listen` listen callback, `verifyCloudflare()` is triggered asynchronously without awaiting or proper parameter initialization.
- **File**: `server.js`, Lines 690–718:
  ```javascript
  690: async function verifyCloudflare(apiToken, accountId) {
  691:   let token = apiToken;
  692:   if (!token) {
  693:     const defaults = getWranglerDefaults();
  694:     token = defaults.token;
  695:   }
  696:   if (!token) {
  697:     return { success: false, message: 'Cloudflare API Token is required' };
  698:   }
  ...
  708:     if (!accData.success && (accData.errors?.[0]?.message?.includes('Authentication') || accData.errors?.[0]?.code === 10000)) {
  709:       const fresh = await getWranglerDefaultsFresh();
  ```
- **File**: `server.js`, Lines 73–79:
  ```javascript
  73: async function getWranglerDefaultsFresh() {
  74:   return new Promise((resolve) => {
  75:     exec('npx wrangler whoami', { timeout: 25000 }, () => {
  76:       resolve(getWranglerDefaults());
  77:     });
  78:   });
  79: }
  ```
- **File**: `server.js`, Lines 23–40:
  ```javascript
  23: function _asyncRefreshWranglerToken() {
  24:   if (_refreshInProgress) return;
  25:   _refreshInProgress = true;
  26:   exec('npx wrangler whoami', { timeout: 25000 }, (err) => {
  27:     _refreshInProgress = false;
  ...
  40:   });
  41: }
  ```
- When `server.js` starts, if credentials are stale or unauthenticated, it spawns `npx wrangler whoami` with a 25,000 ms (25s) timeout and issues HTTP fetches with 10,000 ms (10s) timeouts. These background operations delay clean teardown and hold the event loop open.

### Observation 1.3: Synchronous File I/O Bottlenecks on Event Loop
- **File**: `server.js`, Lines 31–32, 47–48, 84–86, 102, 106–108, 129:
  ```javascript
  31:       if (fs.existsSync(configPath)) {
  32:         const content = fs.readFileSync(configPath, 'utf8');

  47:     if (fs.existsSync(configPath)) {
  48:       const content = fs.readFileSync(configPath, 'utf8');

  84:   if (fs.existsSync(CONFIG_FILE)) {
  85:     try {
  86:       cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

  102:   fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');

  106:   if (fs.existsSync(CAMPAIGNS_FILE)) {
  107:     try {
  108:       return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));

  129:   fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), 'utf8');
  ```
- Every call to `loadConfig()` (invoked in `loadConfig`, `app.get('/api/config')`, `app.get('/api/zones')`, `app.post('/api/deploy')`, `app.get('/api/analytics/posts')`, `app.post('/api/analytics/simulate')`, `app.post('/api/analytics/reset')`) and `loadCampaigns()` synchronously reads from disk via `fs.readFileSync` and `fs.existsSync`. Every update uses `fs.writeFileSync`.

### Observation 1.4: Defective `EADDRINUSE` Handling (No Clean Process Exit)
- **File**: `server.js`, Lines 1280–1287:
  ```javascript
  1280: server.on('error', (err) => {
  1281:   if (err.code === 'EADDRINUSE') {
  1282:     console.error(`\n[!] Error: Port ${PORT} is already in use.`);
  1283:     console.error(`[!] Please run start-dashboard.bat which automatically frees port ${PORT}\n`);
  1284:   } else {
  1285:     console.error('[!] Server error:', err);
  1286:   }
  1287: });
  ```
- When `err.code === 'EADDRINUSE'`, `server.on('error')` logs messages to `console.error` but **does not call `process.exit(1)`**. If any handle (such as the child process `exec` or open timers) is pending in the Node.js event loop, the process hangs in an indeterminate zombie state rather than terminating with an exit status code.

### Observation 1.5: Total Absence of Process Signal Handlers and Graceful Teardown
- Ripgrep pattern search across `server.js`:
  - `process.on`: 0 matches
  - `SIGINT`: 0 matches
  - `SIGTERM`: 0 matches
  - `server.close`: 0 matches
  - `server.closeAllConnections`: 0 matches
- **File**: `start-dashboard.bat`, Lines 7–10:
  ```bat
  7: :: Free port 5050 and old ports if lingering
  8: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050 " 2^>nul') do taskkill /F /PID %%a 2>nul
  9: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do taskkill /F /PID %%a 2>nul
  10: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3847 " 2^>nul') do taskkill /F /PID %%a 2>nul
  ```
- The presence of brute-force `taskkill /F` commands in `start-dashboard.bat` directly corroborates that the server regularly leaves hung sockets and orphan processes upon termination because no graceful shutdown or signal trap exists.

### Observation 1.6: Total Absence of Uncaught Exception & Unhandled Rejection Handlers
- Ripgrep pattern search across `server.js`:
  - `uncaughtException`: 0 matches
  - `unhandledRejection`: 0 matches
- Express route handlers and background asynchronous promises that throw unhandled errors will cause Node.js 16+ to trigger an unhandled rejection and immediately crash or terminate ungracefully.

### Observation 1.7: Missing Test Configuration & Missing Health Route
- **File**: `package.json`, Lines 1–17:
  ```json
  {
    "name": "homeandrecipe-cloaker",
    "version": "1.0.0",
    "main": "src/index.js",
    "scripts": {
      "start": "node server.js",
      "dashboard": "node server.js",
      "deploy": "wrangler deploy"
    },
    "devDependencies": {
      "wrangler": "^3.0.0"
    },
    "dependencies": {
      "express": "^5.3.0"
    }
  }
  ```
- `package.json` contains no `"test"` script. Running `npm test` fails immediately with `npm error Missing script: "test"`.
- `server.js` contains no `/health` or `/api/health` endpoint. A GET to `/health` falls through to static middleware or returns 404.

---

## 2. Logic Chain

1. **Premise**: In Node.js, top-level code in a module runs synchronously upon evaluation.
2. **From Observation 1.1**: Lines 1264–1278 invoke `app.listen(PORT)` unconditionally at the top level of `server.js`, and line 1288 concludes the file without `module.exports`.
3. **Inference 1 (Test & Modular Isolation Failure)**:
   - When test runners or other modules attempt to load `server.js` (e.g. `const app = require('./server.js')`), `server.js` immediately attempts to bind TCP port 5050.
   - If port 5050 is in use, or if multiple tests execute concurrently in separate threads or files, an `EADDRINUSE` error is thrown.
   - Furthermore, `require('./server.js')` yields `{}` because `app` is never exported, preventing any programmatic testing with Supertest, Node test runner, or Mocha.
4. **From Observation 1.4**: In `server.on('error', (err) => { ... })` (lines 1280–1287), `EADDRINUSE` is logged, but `process.exit(1)` is never called.
5. **Inference 2 (Indeterminate Hang on Port Collision)**:
   - If port 5050 is already occupied, the server cannot accept traffic. Because the error handler catches the event without terminating the process, if any asynchronous work or handle (e.g. `_asyncRefreshWranglerToken` or keep-alives) is active, the Node process hangs indefinitely instead of exiting cleanly with an error code.
6. **From Observations 1.2 & 1.3**:
   - `verifyCloudflare()` runs in the background at startup (line 1271).
   - If token verification fails, lines 709 and 75 spawn child processes `exec('npx wrangler whoami', { timeout: 25000 })`.
   - On Windows, child process execution via `exec` invokes shell command interpreters. If `npx` stalls or waits for credentials/network, the process takes up to 25 seconds to finish.
7. **From Observation 1.5 & `start-dashboard.bat`**:
   - There are zero listeners for `process.on('SIGINT')` and `process.on('SIGTERM')`.
   - Node HTTP servers do not terminate keep-alive connections on `server.close()` unless sockets are tracked and destroyed or `server.closeAllConnections()` is invoked.
   - Because no signal listeners exist, sending `SIGINT` (Ctrl+C) or `SIGTERM` terminates the process abruptly, leaving operating system TCP sockets in `TIME_WAIT` or `CLOSE_WAIT` states and leaving child processes spawned by `exec` running as orphans. This explains why `start-dashboard.bat` lines 8–10 had to forcefully execute `taskkill /F /PID %%a` against port 5050.
8. **From Observation 1.6**:
   - `uncaughtException` and `unhandledRejection` have zero listeners. Any unhandled Promise rejection terminates the process with no log dump or recovery, violating R1 (runtime stability).
9. **From Observation 1.7**:
   - `package.json` lacks `"scripts": { "test": ... }` and `server.js` lacks a health-check endpoint (`/api/health` or `/health`), violating R2 and R3.

---

## 3. Caveats

- **Network mode & Cloudflare API**: External Cloudflare API calls (`https://api.cloudflare.com/...`) require a valid Cloudflare API token. In offline, mocked, or test environments, network calls will fail or time out (10s) unless mocked or guarded by an environment check (e.g., `NODE_ENV === 'test'`).
- **Express 5 Behavior**: Express 5.3.0 handles rejected promises in async middleware automatically, but without a dedicated error middleware (`app.use((err, req, res, next) => ...)`), errors produce default HTML error responses rather than structured JSON error payloads.
- **Scope Restriction**: Survey Explorer 1 is strictly read-only and has made no modifications to `server.js` or `package.json`.

---

## 4. Conclusion

`server.js` and `package.json` contain six distinct architectural defects causing startup hanging, blocking, and instability:

1. **Unconditional Top-Level Listen & Missing Export**: `app.listen(PORT)` is executed immediately upon file execution (lines 1264–1278), and neither `app` nor `server` is exported (`module.exports`), making programmatic import and testing impossible without port collision.
2. **Hanging Error Handler on `EADDRINUSE`**: Lines 1280–1287 log `EADDRINUSE` but do not call `process.exit(1)`, causing the process to hang silently when port 5050 is occupied.
3. **Long Timeout Child Process Spawning on Startup**: Line 1271 initiates unawaited `verifyCloudflare()` which can trigger `exec('npx wrangler whoami', { timeout: 25000 })` (lines 26, 75), spawning heavy child processes and stalling event loop teardown for up to 25 seconds.
4. **Complete Absence of Signal Handlers & Graceful Teardown**: Zero listeners for `SIGINT` and `SIGTERM`, zero calls to `server.close()` or socket destruction, leading directly to socket leaks, orphaned ports, and requiring `taskkill /F` workarounds.
5. **No Process-Level Error Trap**: Absence of `uncaughtException` and `unhandledRejection` listeners exposes the application to abrupt crashes.
6. **Missing Health Endpoint and Test Script**: No `/api/health` route exists, and `package.json` contains no `"test"` script.

### Recommended Remediation for Subsequent Milestones:
1. Export `app` and `server` (`module.exports = { app, server }`), and guard `app.listen` so it only runs if `require.main === module` (or allow configurable port / exportable start function).
2. Fix `server.on('error')` to call `process.exit(1)` when `EADDRINUSE` occurs.
3. Implement `process.on('SIGINT')` and `process.on('SIGTERM')` graceful shutdown handlers that invoke `server.close()` and destroy tracked active sockets (`server.closeAllConnections()`).
4. Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` global guards.
5. Guard startup `verifyCloudflare()` so it does not run in test environments (`NODE_ENV === 'test'`) and handles missing tokens gracefully without spawning blocking 25s child processes.
6. Add a lightweight `/api/health` route returning `{ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }`.
7. Add `"test": "node --test"` (or test runner) to `package.json` and create comprehensive automated test suites.

---

## 5. Verification Method

To independently verify the observations and logic documented in this report:

1. **Verify Module Side-Effect and Missing Export**:
   Run in Node:
   ```powershell
   node -e "const mod = require('./server.js'); console.log('Exported keys:', Object.keys(mod)); setTimeout(() => process.exit(0), 1000);"
   ```
   *Expected output*: Shows that `server.js` binds port 5050 immediately on require and `mod` is `{}`.
2. **Verify `EADDRINUSE` Indeterminate Hang**:
   Start one instance on port 5050, then in a second shell run:
   ```powershell
   node server.js
   ```
   *Expected output*: Displays `[!] Error: Port 5050 is already in use.`, but the process does not terminate with exit code 1 immediately.
3. **Verify Signal Handlers & Process Error Absence**:
   Run ripgrep:
   ```powershell
   rg "process\.on|SIGINT|SIGTERM|uncaughtException|unhandledRejection" server.js
   ```
   *Expected output*: 0 lines returned.
4. **Verify Missing Test Script in package.json**:
   Run:
   ```powershell
   npm test
   ```
   *Expected output*: `npm error Missing script: "test"`.
5. **Verify Missing Health Route**:
   Inspect line registrations in `server.js` or start server and query `curl http://localhost:5050/api/health`:
   *Expected output*: 404 Cannot GET /api/health.
