# Comprehensive Investigation and Diagnostic Report: `server.js` Startup Sequence, Blocking, Hanging, and Stability

**Agent**: Survey Explorer 1 (`teamwork_explorer`)  
**Target File**: `c:\Users\mouni\Desktop\my-cloaker\server.js`  
**Timestamp**: 2026-11-01T12:11:00Z  

---

## 1. Observation

Direct observations from codebase inspection, runtime process investigation, and local network verification:

### 1.1 Unconditional Top-Level Listen and Empty Module Exports
- **File**: `server.js`, Lines 1264–1288
- **Code**:
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
  1279: 
  1280: server.on('error', (err) => {
  1281:   if (err.code === 'EADDRINUSE') {
  1282:     console.error(`\n[!] Error: Port ${PORT} is already in use.`);
  1283:     console.error(`[!] Please run start-dashboard.bat which automatically frees port ${PORT}\n`);
  1284:   } else {
  1285:     console.error('[!] Server error:', err);
  1286:   }
  1287: });
  ```
- **Observations**:
  1. `server.js` executes `app.listen(PORT)` immediately upon module load with no `require.main === module` conditional check.
  2. `module.exports` is never defined. Running `node -e "const s = require('./server'); console.log(s);"` yields `Exported: {}`.
  3. When imported by a test framework, `server.js` unconditionally attempts to bind to `PORT` (5050), triggering port collisions and preventing programmatic test harness control.

### 1.2 `EADDRINUSE` Handling Fails to Exit With Non-Zero Exit Code
- **File**: `server.js`, Lines 1280–1287
- **Verification Command & Output**:
  Running `node -e "const s = require('./server');"` while port 5050 is in use produced:
  ```
  Exported: {}

  ======================================================
  🚀 Cloaker Dashboard is running!
  👉 Open: http://localhost:5050
  ======================================================

  [!] Error: Port 5050 is already in use.
  [!] Please run start-dashboard.bat which automatically frees port 5050

  [Cloudflare] Pre-verified: Laurainsley01@gmail.com's Account (6 zones)
  ```
  - Exit code was **0**.
  - The process printed both the success startup message and the `EADDRINUSE` error message.
  - The server failed to start, yet neither `process.exit(1)` nor `throw err` was invoked. In CI/CD pipelines or process managers, this produces a false-success status while leaving the service down.

### 1.3 Active Port 5050 Occupation and Lingering Zombie Process
- **Tool Output (`netstat -ano | findstr :5050`)**:
  ```
  TCP    0.0.0.0:5050           0.0.0.0:0              LISTENING       7804
  TCP    [::]:5050              [::]:0                 LISTENING       7804
  TCP    [::1]:5050             [::1]:55059            ESTABLISHED     7804
  TCP    [::1]:5050             [::1]:57097            FIN_WAIT_2      7804
  TCP    [::1]:55059            [::1]:5050             ESTABLISHED     18868
  TCP    [::1]:57097            [::1]:5050             CLOSE_WAIT      18868
  ```
- **Tool Output (`Get-Process -Id 7804`)**:
  - PID 7804 is an existing `node.exe` process running in the background.
  - Sockets connected to Chrome (PID 18868) were in `CLOSE_WAIT` and `FIN_WAIT_2`.
- **Existing Workaround in `start-dashboard.bat`**:
  ```bat
  8: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050 " 2^>nul') do taskkill /F /PID %%a 2>nul
  9: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do taskkill /F /PID %%a 2>nul
  10: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3847 " 2^>nul') do taskkill /F /PID %%a 2>nul
  ```
  - The presence of brute-force `taskkill /F` confirms recurring socket hangs and failure of previous instances to terminate cleanly.

### 1.4 Complete Absence of Signal Handling (SIGINT, SIGTERM, SIGHUP) and Socket Draining
- **Observation**:
  - `grep_search` for `SIGINT`, `SIGTERM`, `beforeExit`, or `graceful` in `server.js` returned zero occurrences.
  - There are no signal listeners to intercept Ctrl+C, process termination from container orchestrators, or shutdown commands.
  - When closed, open HTTP Keep-Alive connections are not closed via `server.closeAllConnections()` or connection tracking, leaving sockets hung in `FIN_WAIT_2` / `CLOSE_WAIT`.

### 1.5 Missing Health Check Route Required by Acceptance Criteria
- **Observation**:
  - Inspection of all routes in `server.js` shows: `/favicon.ico`, `/api/config`, `/api/verify-cf`, `/api/zones`, `/api/generate`, `/api/deploy`, `/api/analytics/posts`, `/api/analytics/simulate`, `/api/analytics/reset`, `/api/campaigns`, `/api/campaigns/:id`.
  - Testing `GET /api/health` and `GET /health` returned HTTP 404: `Cannot GET /api/health`.
  - Requirement R2 & Acceptance Criteria state: *"Automated tests verify server startup and health response."* Currently, no health endpoint exists.

### 1.6 Child Process Spawning (`npx wrangler whoami`) With 25-Second Timeout and Concurrency Hazards
- **File**: `server.js`, Lines 23–41, 73–79
- **Code**:
  ```javascript
  26: exec('npx wrangler whoami', { timeout: 25000 }, (err) => { ... });
  ...
  75: exec('npx wrangler whoami', { timeout: 25000 }, () => {
  76:   resolve(getWranglerDefaults());
  77: });
  ```
- **Observations**:
  1. `getWranglerDefaultsFresh()` (lines 73–79) has no concurrency debounce or lock. Simultaneous incoming requests to `/api/verify-cf`, `/api/zones`, or `/api/deploy` trigger concurrent `npx wrangler whoami` executions.
  2. `npx wrangler whoami` takes 5+ seconds on Windows. If offline or unauthenticated, it can hang up to 25 seconds waiting for interactive prompt or network timeout.
  3. `exec` options lack `windowsHide: true` and `stdio: ['ignore', 'pipe', 'pipe']`.

### 1.7 Platform-Specific Hardcoded Path Failure
- **File**: `server.js`, Lines 30 and 46
- **Code**:
  ```javascript
  const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
  ```
- **Observations**:
  On non-Windows systems (Linux, Docker, macOS, CI environments), `process.env.APPDATA` is `undefined`, resolving to relative path `xdg.config/.wrangler/config/default.toml` instead of `$XDG_CONFIG_HOME/.wrangler/...` or `~/.config/.wrangler/...`.

### 1.8 Indefinite Request Hanging in Outbound Cloudflare API Calls
- **File**: `server.js`
- **Observations**:
  While `verifyCloudflare()` includes `signal: AbortSignal.timeout(10000)` on lines 703 and 734, the following `fetch` calls have **NO timeout**:
  - `GET /api/zones`: Lines 782, 792
  - `POST /api/deploy`: Lines 930, 944, 961, 976, 994, 1011
  - `GET /api/analytics/posts`: Lines 1091, 1106
  - `POST /api/analytics/simulate`: Lines 1176, 1190
  - `POST /api/analytics/reset`: Lines 1220, 1231
  If Cloudflare API endpoints or intermediate network gateways stall, these HTTP requests hang indefinitely, blocking client connections and leaking socket handles.

### 1.9 Unhandled Exceptions and Missing Express Error Middleware
- **File**: `server.js`
- **Observations**:
  1. No `process.on('uncaughtException')` or `process.on('unhandledRejection')` handlers.
  2. In `app.post('/api/config')` (lines 670–684), `const { ... } = req.body;` is destructured directly without verifying that `req.body` is defined.
  3. `saveConfig(cfg)` (line 102) calls `fs.writeFileSync` synchronously without a `try/catch` block.
  4. There is no Express error-handling middleware (`app.use((err, req, res, next) => ...)`) at the end of the chain. If `express.json()` receives malformed JSON, Express returns an unformatted HTML error page with stack traces instead of JSON `{ success: false, error: ... }`.
  5. In `/api/analytics/simulate` (lines 1173), user-supplied `postPath` and `country` are concatenated directly into raw SQL strings (`'${postPath}'`), presenting a SQL syntax crash and injection vulnerability.

---

## 2. Logic Chain

1. **Premise**: Production readiness requires clean process lifecycle management, deterministic startup/shutdown, resilient error boundaries, and comprehensive testability.
2. **From Observation 1.1 & 1.2**: Because `app.listen(PORT)` runs at root scope and does not export `app` or `server`, any test suite attempting to require `server.js` immediately tries to bind port 5050. When port 5050 is in use, `server.on('error')` catches `EADDRINUSE` but does not exit with code 1. Consequently, test runners cannot import the app, cannot isolate test ports, cannot close the server after execution, and receive false-positive exit 0 status on failed startups.
3. **From Observation 1.3 & 1.4**: Without `SIGINT`/`SIGTERM` handlers and without explicit connection draining (`server.closeAllConnections()`), terminated Node processes leave socket handles in `CLOSE_WAIT` and `FIN_WAIT_2`, causing orphan node processes to remain alive in the background (as demonstrated by lingering PID 7804). This explains why the author wrote `start-dashboard.bat` with `taskkill /F`.
4. **From Observation 1.5**: Requirement R2 mandates automated test verification of server startup and health response. Without an explicit `/api/health` (or `/health`) route returning `{ status: 'ok', uptime, timestamp }`, health checks fail with 404.
5. **From Observation 1.6 & 1.8**: Lack of request timeouts on multiple `fetch` calls, combined with un-debounced 25s `exec('npx wrangler whoami')` subprocess calls, creates severe hang vectors during startup and runtime whenever network calls stall or authentication fails.
6. **From Observation 1.9**: Absence of process-level error handlers and centralized Express error middleware means unhandled exceptions or malformed JSON payloads either crash the Node process (Node 24 throws on unhandled rejections) or expose internal HTML stack traces.

---

## 3. Caveats

- **Active Process in Background**: Node process PID 7804 is currently running on the machine, listening on port 5050. Any implementation agent testing `node server.js` will need to stop this lingering process or use a configurable port (e.g. `PORT=5051` or port 0 for tests).
- **Wrangler Credentials**: Local Wrangler OAuth token in `default.toml` expires at `2026-11-01T13:08:30Z`. While live verification against Cloudflare accounts succeeded during testing, the token refresh logic must be resilient when tokens expire or when Wrangler is unauthenticated.
- **Node Version**: Node environment is v24.11.1 on Windows. Node 24 natively supports `node:test`, `node:assert`, `fetch`, `FormData`, `Blob`, and `server.closeAllConnections()`. Zero external test framework dependencies are needed.

---

## 4. Conclusion & Actionable Recommendations

To satisfy requirements R1, R2, and R3, the following concrete modifications are needed:

### Architectural / Code Recommendations for `server.js`

1. **Modularize Startup and Exports**:
   - Wrap `app.listen` in a `startServer(port = PORT)` function returning `{ app, server }`.
   - Protect invocation with `if (require.main === module) { startServer(); }`.
   - Export `{ app, server, startServer, verifyCloudflare, buildWorkerCode, buildRobotsTxt, loadConfig, saveConfig, loadCampaigns, saveCampaigns }`.

2. **Deterministic Port Binding & Error Exit**:
   - In `server.on('error', (err) => { ... })`: If `err.code === 'EADDRINUSE'`, log clear diagnostic message and call `process.exit(1)`. For other server errors, call `process.exit(1)`.

3. **Graceful Shutdown & Signal Handlers**:
   - Register handlers for `SIGINT` and `SIGTERM`.
   - On signal:
     ```javascript
     function gracefulShutdown(signal) {
       console.log(`[Server] Received ${signal}, shutting down gracefully...`);
       server.close((err) => {
         if (err) {
           console.error('[Server] Error during close:', err);
           process.exit(1);
         }
         console.log('[Server] Closed all HTTP connections cleanly.');
         process.exit(0);
       });
       // Force close lingering keep-alive sockets after timeout
       setTimeout(() => {
         console.warn('[Server] Forcing closure of lingering connections...');
         if (typeof server.closeAllConnections === 'function') {
           server.closeAllConnections();
         }
         process.exit(1);
       }, 5000).unref();
     }
     ```

4. **Add Dedicated Health Check Endpoint**:
   - Add `GET /api/health` and `GET /health`:
     ```javascript
     app.get(['/api/health', '/health'], (req, res) => {
       res.json({
         status: 'ok',
         uptime: process.uptime(),
         timestamp: new Date().toISOString(),
         port: PORT
       });
     });
     ```

5. **Outbound Request Timeouts and Concurrency Guards**:
   - Add `signal: AbortSignal.timeout(10000)` (or 15000) to all `fetch` calls in `/api/zones`, `/api/deploy`, and `/api/analytics/*`.
   - Debounce `getWranglerDefaultsFresh()` so that multiple concurrent requests share a single in-flight promise rather than spawning multiple `wrangler whoami` subprocesses.
   - Add cross-platform path resolution for Wrangler config: check both `process.env.APPDATA` (Windows) and `process.env.HOME` / `process.env.XDG_CONFIG_HOME` (Linux/macOS).

6. **Global Error Boundaries and Express Error Middleware**:
   - Add `process.on('uncaughtException', (err) => { console.error('[UncaughtException]:', err); });`
   - Add `process.on('unhandledRejection', (reason) => { console.error('[UnhandledRejection]:', reason); });`
   - Add Express JSON and 404 error handler middleware:
     ```javascript
     app.use((err, req, res, next) => {
       const status = err.status || 500;
       res.status(status).json({
         success: false,
         error: err.message || 'Internal Server Error'
       });
     });
     ```
   - Parameterize or escape SQL statements in `/api/analytics/simulate`.

7. **Automated Test Suite Setup (`package.json`)**:
   - Configure `"test": "node --test test/*.test.js"` in `package.json`.
   - Implement comprehensive automated tests verifying:
     - Server startup on ephemeral port (port 0) and graceful shutdown
     - Health check endpoint `/api/health`
     - Config GET and POST `/api/config`
     - Code generation `/api/generate`
     - Static assets and favicon `/favicon.ico`
     - Campaigns GET `/api/campaigns` and DELETE `/api/campaigns/:id`
     - Error handling middleware and malformed JSON recovery

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Empty Export & Unconditional Listen**:
   ```bash
   node -e "const s = require('./server'); console.log('Exports:', Object.keys(s));"
   ```
   *Expected Current Output*: `Exports: []` (empty object).

2. **Verify Port Binding Failure Exit Code**:
   ```bash
   # Run with port 5050 already occupied:
   node server.js; echo "Exit code: $LASTEXITCODE"
   ```
   *Expected Current Output*: `Port 5050 is already in use`, followed by `Exit code: 0` (defect: should be 1).

3. **Verify Absence of Health Check Endpoint**:
   ```bash
   powershell -Command "Invoke-RestMethod -Uri 'http://localhost:5050/api/health' -Method Get"
   ```
   *Expected Current Output*: HTTP 404 `Cannot GET /api/health`.

4. **Post-Fix Verification Plan**:
   - `npm test` runs with exit code 0 and passes 100% of test cases.
   - `node server.js` exits with code 1 if port is blocked, or starts cleanly and responds to `GET /api/health` with HTTP 200 `{ status: 'ok' }`.
   - Sending `SIGINT` (Ctrl+C) shuts down the server in under 500ms without leaving hung sockets or orphan processes.
