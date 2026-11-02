# Handoff Report: Project Setup, Dependencies, Testing Infrastructure & Server Stability

**Date**: 2026-11-01T12:11:00Z  
**Author**: Survey Explorer 3 (`explorer_survey_3`)  
**Target Recipient**: Project Orchestrator (`99771219-9d06-49a7-a16f-250903dc2536`) and Implementer Agents  
**Scope**: Investigation of project environment, dependencies, testing infrastructure, configuration, and server stability at `c:\Users\mouni\Desktop\my-cloaker`.

---

## 1. Observation

### 1.1 Package & Runtime Environment
- **Node.js & NPM Versions**:
  - Command: `node -v; npm -v`
  - Result: `v24.11.1` and `11.6.2`.
- **`package.json` (`c:\Users\mouni\Desktop\my-cloaker\package.json`)**:
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
  - **No `test` script exists in `package.json`**: Running `npm test` yields:
    `npm error Missing script: "test"`.
  - Installed top-level packages (`npm list --depth=0`): `express@5.3.0` and `wrangler@3.114.17`.
  - No external test framework (Jest, Mocha, Vitest, Supertest, Chai) is installed.

### 1.2 Existing Test Infrastructure & `scratch/` Hazard
- No formal test directory (`test/` or `tests/`) exists.
- The repository contains 8 manual/ad-hoc scripts in `c:\Users\mouni\Desktop\my-cloaker\scratch\`:
  - `scratch/hard-test.js`
  - `scratch/test-cloaker.js`
  - `scratch/test-compile.js`
  - `scratch/test-fresh-slug.js`
  - `scratch/test-slug-activate.js`
  - `scratch/test-slug-live-verify.js`
  - `scratch/test-slug.js`
  - `scratch/test-vm.js`
- **Critical Hazard**: Running Node's native test runner without path arguments (`node --test`) automatically traverses into `scratch/`, matching files with names containing `*test*`.
  - In our test execution of `node --test`, it immediately executed `scratch/hard-test.js` and `scratch/test-cloaker.js`, which performed live HTTP requests against `https://homeandrecipe.com/` and wrote mutation queries to the production Cloudflare D1 database (`7db29aa9-bd12-410d-a982-1600c940a14f`).
  - None of those scratch scripts test `server.js`.
  - In contrast, running `node --test "test/**/*.test.js"` runs cleanly in ~4.6ms without discovering or triggering the scratch scripts.

### 1.3 Configuration & Environment
- **Configuration Files**:
  - `dashboard-config.json` (`c:\Users\mouni\Desktop\my-cloaker\dashboard-config.json`): Checked via `Test-Path`; currently does NOT exist on disk.
  - `server.js` lines 81–99 (`loadConfig()`): When `dashboard-config.json` is missing, it falls back to:
    - `accountId`: `'7dc0e6c5b46881fec4f36bad5ac438a4'`
    - `d1DatabaseId`: `'7db29aa9-bd12-410d-a982-1600c940a14f'`
    - `activationMethod`: `'visitor_threshold'`
    - `defaultScrollPct`: `15`
    - `defaultTrigger`: `'both'`
    - `thresholdCount`: `50`
    - `autoCreateWww`: `true`
    - `apiToken`: reads from `$env:APPDATA\xdg.config\.wrangler\config\default.toml` via `getWranglerDefaults()`.
  - `dashboard-campaigns.json` (`c:\Users\mouni\Desktop\my-cloaker\dashboard-campaigns.json`): Exists and contains 1 active campaign entry (`homeandrecipe-com-cloaker`).
  - `.env` files: None exist in the workspace.
- **Environment Variables**:
  - `PORT`: `process.env.PORT || 5050` (`server.js:7`).
  - `APPDATA`: `process.env.APPDATA` used to locate `.wrangler\config\default.toml` (`server.js:30, 46`).
  - `NODE_ENV`: Not currently referenced or handled in `server.js`.

### 1.4 Server Lifecycle & Stability Defects in `server.js`
- **Port Collision & Infinite Hang on `EADDRINUSE`**:
  - `server.js` lines 1280–1287:
    ```javascript
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[!] Error: Port ${PORT} is already in use.`);
        console.error(`[!] Please run start-dashboard.bat which automatically frees port ${PORT}\n`);
      } else {
        console.error('[!] Server error:', err);
      }
    });
    ```
  - **Defect**: When port 5050 is occupied, the `'error'` event handler prints a warning to console, but **never calls `process.exit(1)`**.
  - **Direct Verification**: Running `node server.js` while port 5050 was occupied resulted in the process hanging indefinitely (`WasRunning: True`).
- **Active Orphan Process on Port 5050**:
  - `netstat -ano | findstr ":5050"` revealed:
    `TCP 0.0.0.0:5050 LISTENING PID 7804`
  - `tasklist /FI "PID eq 7804"` confirmed `node.exe` (PID 7804) is currently running in the background holding port 5050.
  - This explains why `start-dashboard.bat` (lines 7–10) contains aggressive `taskkill /F /PID` loops targeting port 5050, 3000, and 3847 before launching.
- **Missing Signal Handlers (`SIGINT`, `SIGTERM`)**:
  - `server.js` contains zero listeners for `SIGINT` or `SIGTERM`. Sockets are not closed gracefully, leading directly to orphaned node processes when console windows or batch wrappers terminate.
- **Missing Global Uncaught Handlers**:
  - No `process.on('uncaughtException')` or `process.on('unhandledRejection')` handlers exist.
- **Top-Level Root Execution & Zero Exports**:
  - Line 1264: `const server = app.listen(PORT, ...)` executes unconditionally upon loading `server.js`.
  - There is no `if (require.main === module)` guard.
  - There is no `module.exports = { app, ... }`.
  - Importing `server.js` in a test immediately attempts to bind port 5050, causing port collision or hanging.
- **Startup Background Cloudflare Pre-verification**:
  - Lines 1270–1277: `verifyCloudflare().then(...)` executes immediately inside the `listen` callback.
  - If the token is invalid/expired, it invokes `getWranglerDefaultsFresh()` which spawns `exec('npx wrangler whoami', { timeout: 25000 })`. In offline or test environments, this introduces 25-second delays and unwanted child process spawns.
- **Missing Health Check Endpoint**:
  - Grep search for `health` in `server.js` returned zero matches. There is no `/health` or `/api/health` endpoint.

### 1.5 Exhaustive Route Inventory in `server.js`
The following 14 routes are defined in `server.js`:
1. `GET /` — Serves `public/index.html` via `app.use(express.static(...))` (line 10).
2. `GET /favicon.ico` — Returns inline SVG icon with `Content-Type: image/svg+xml` (lines 658–662).
3. `GET /api/config` — Returns configuration object from `loadConfig()` (lines 665–667).
4. `POST /api/config` — Saves config to `dashboard-config.json` via `saveConfig()` (lines 670–684).
5. `POST /api/verify-cf` — Calls `verifyCloudflare(apiToken, accountId)` with 60s memory cache (lines 760–771).
6. `GET /api/zones` — Fetches Cloudflare zones list; returns error if token missing (lines 774–813).
7. `POST /api/generate` — Pure compilation endpoint: generates worker code and robots.txt; returns 400 if `sourceDomain` or `targetDomain` missing (lines 815–853).
8. `POST /api/deploy` — Compiles and deploys worker to Cloudflare D1/Worker; validates required fields (lines 855–1065).
9. `GET /api/analytics/posts` — Queries D1 `url_human_visits`; returns 400 if credentials missing (lines 1068–1154).
10. `POST /api/analytics/simulate` — Simulates human visits into D1; returns 400 if credentials missing (lines 1157–1210).
11. `POST /api/analytics/reset` — Clears visits from D1; returns reset status (lines 1213–1244).
12. `GET /api/campaigns` — Returns list of campaigns from `dashboard-campaigns.json` (lines 1247–1249).
13. `DELETE /api/campaigns/:id` — Removes campaign by ID and writes file (lines 1252–1261).
14. `app.listen(PORT)` — Server listener on port 5050 (lines 1264–1278).

---

## 2. Logic Chain

1. **Test Runner Selection (Node:test vs Third-Party)**:
   - Node.js v24.11.1 includes a fully stable native test runner (`node:test`), native assertions (`node:assert/strict`), and native HTTP client (`globalThis.fetch`).
   - Third-party test frameworks (such as Jest or Mocha + Supertest) require installing tens of megabytes of external dependencies, creating installation overhead, version drift, and potential Windows worker-thread hanging issues.
   - Therefore, native `node:test` + `node:assert/strict` + `fetch` is the optimal, zero-dependency, ultra-fast solution.

2. **Isolation of Tests from Scratch Scripts**:
   - `node --test` recursively searches for any file matching `*test*.js`.
   - The `scratch/` directory contains live production scripts with `test` in their filenames (`scratch/hard-test.js`, `scratch/test-cloaker.js`, etc.) which mutate live Cloudflare D1 tables and query production domains.
   - Therefore, the test script in `package.json` must NOT be bare `"node --test"`. It must strictly target `"test": "node --test test/**/*.test.js"`.

3. **Server Stability & Anti-Hang Remediations**:
   - Because `server.on('error')` lacks `process.exit(1)`, port collisions (`EADDRINUSE`) result in infinite process hangs. Adding `process.exit(1)` upon `EADDRINUSE` guarantees the process fails fast with non-zero exit status.
   - Because `server.js` lacks `SIGINT` and `SIGTERM` listeners, closing terminals leaves orphan processes (such as PID 7804). Registering signal handlers that call `server.close(() => process.exit(0))` with a 3-second timeout fallback eliminates orphan processes.
   - Because `server.js` calls `app.listen(PORT)` unconditionally on load, tests cannot import `app` without initiating a live server on port 5050. Guarding startup with `if (require.main === module)` and exporting `{ app, startServer, stopServer, ... }` allows both standalone execution (`node server.js`) and isolated in-process test execution.

4. **Health Check Requirement**:
   - Requirement R2 and Acceptance Criteria explicitly mandate automated tests verifying server startup and health response.
   - `server.js` currently lacks a `/health` endpoint. Adding `GET /health` and `GET /api/health` returning `{ status: 'ok', uptime: process.uptime(), timestamp: ... }` provides a standardized health check.

5. **Test Port Isolation & Ephemeral Port**:
   - In test runs, binding to `PORT=0` allows the OS kernel to assign an available ephemeral port, guaranteeing tests never collide with port 5050 (which currently has lingering PID 7804).

---

## 3. Caveats

- **Active PID 7804**: A previous instance of `node.exe` is currently running on port 5050. Tests binding to `PORT=0` will run cleanly regardless, but testing `node server.js` on default port 5050 will trigger `EADDRINUSE` until PID 7804 is terminated or freed via `start-dashboard.bat`.
- **Cloudflare API Mocking in Tests**: Endpoints interacting with Cloudflare (`/api/verify-cf`, `/api/zones`, `/api/deploy`, `/api/analytics/*`) require valid Cloudflare credentials or should be tested for proper error handling (e.g. 400 Bad Request when credentials are missing or mocked). Real Cloudflare mutation should NOT occur during automated testing.
- **Windows File Locks**: On Windows, rapidly opening and closing JSON files (`dashboard-config.json`, `dashboard-campaigns.json`) across parallel test workers can encounter `EBUSY`. Tests should either run sequentially or operate with temporary/mocked state.

---

## 4. Conclusion & Actionable Blueprint

### 4.1 Server Refactoring Plan (`server.js`)
1. **Modular Export & Startup Guard**:
   Wrap `app.listen` in a `startServer(port = PORT)` function.
   Only auto-start if `require.main === module`:
   ```javascript
   if (require.main === module) {
     startServer(PORT);
   }
   module.exports = { app, startServer, loadConfig, saveConfig, loadCampaigns, saveCampaigns, buildWorkerCode, buildRobotsTxt, verifyCloudflare };
   ```
2. **Deterministic `EADDRINUSE` Exit**:
   In `server.on('error')`, when `err.code === 'EADDRINUSE'`, log the error and call `process.exit(1)`.
3. **Graceful Signal Handling**:
   Add `SIGINT` and `SIGTERM` handlers to call `server.close(() => process.exit(0))` with a 3000ms unref'd forced-kill timer.
4. **Global Exception Protection**:
   Register `process.on('uncaughtException')` and `process.on('unhandledRejection')` to log and prevent silent lockups.
5. **Add Health Check Endpoint**:
   ```javascript
   app.get(['/health', '/api/health'], (req, res) => {
     res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
   });
   ```
6. **Skip Background Network in Test Mode**:
   Check `if (process.env.NODE_ENV !== 'test')` before executing `verifyCloudflare()` on startup.

### 4.2 Test Infrastructure Blueprint
1. **Configure `package.json`**:
   Add `"test": "node --test test/**/*.test.js"` to `"scripts"`.
2. **Create Test Suite in `test/`**:
   - `test/server.test.js`:
     - **Suite 1: Server Startup & Lifecycle**: Starts server on ephemeral port (`PORT=0`), asserts HTTP 200 on `/health`, `/api/health`, `/`, and `/favicon.ico`, verifies clean teardown via `server.close()`.
     - **Suite 2: Process & Signal Handling**: Spawns `node server.js` child process with custom port, checks health, sends `SIGINT` / `SIGTERM`, verifies clean exit code 0.
     - **Suite 3: EADDRINUSE Error Handling**: Verifies server exits cleanly with code 1 when attempting to bind an occupied port without hanging.
     - **Suite 4: Core API Routes & Validation**:
       - `GET /api/config` & `POST /api/config`
       - `POST /api/generate` (success with valid payload, 400 with missing domains)
       - `GET /api/campaigns` & `DELETE /api/campaigns/:id`
       - `POST /api/verify-cf` (cached response or missing token validation)
       - `GET /api/zones` (missing token error handling)
       - `POST /api/deploy` (missing parameters 400 error handling)
       - `GET /api/analytics/posts` & `POST /api/analytics/simulate` (credentials validation)
       - 404 handler for nonexistent endpoints.

---

## 5. Verification Method

### 5.1 Independent Verification Commands
1. **Verify Native Test Runner Execution**:
   ```powershell
   node --test "test/**/*.test.js"
   ```
   *Expected*: Discovers and executes all tests in `test/`, exits with code 0, 0 failures, 0 hangs, completes in < 2 seconds, does NOT execute scratch scripts.

2. **Verify NPM Test Command**:
   ```powershell
   npm test
   ```
   *Expected*: Runs the configured test script, passes all suites with exit code 0.

3. **Verify Clean Startup on Port**:
   ```powershell
   $env:PORT="5099"; $env:NODE_ENV="test"; $p = Start-Process node -ArgumentList "server.js" -PassThru -NoNewWindow; Start-Sleep -Seconds 1; $res = Invoke-RestMethod http://localhost:5099/health; Stop-Process -Id $p.Id; $res
   ```
   *Expected*: Returns `{ status: "ok" }` and process exits immediately upon termination without hanging.

4. **Verify Port Conflict Exit (No Hang)**:
   ```powershell
   # If port 5050 is occupied (by PID 7804):
   $p = Start-Process node -ArgumentList "server.js" -PassThru -NoNewWindow; Wait-Process -Id $p.Id -Timeout 3; $p.ExitCode
   ```
   *Expected*: Process exits within 1 second with exit code 1 (no infinite hang).

### 5.2 Invalidation Conditions
- Any test file placed in `scratch/` being executed by `npm test`.
- Any external network calls made to `api.cloudflare.com` or `homeandrecipe.com` during `npm test`.
- `npm test` hanging beyond 10 seconds.
- `server.js` failing to exit when encountering `EADDRINUSE`.
