# Handoff Report: Survey Explorer 3 (Package Configuration, Testing Infrastructure, and Environment Survey)

## 1. Observation

### 1.1 `package.json` Exact Content
File path: `c:\Users\mouni\Desktop\my-cloaker\package.json` (lines 1–17)
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
Direct findings:
- Dependencies: Only `"express": "^5.3.0"`.
- DevDependencies: Only `"wrangler": "^3.0.0"`.
- Scripts: `"start"`, `"dashboard"`, `"deploy"`.
- Missing: No `"test"` script is defined.

### 1.2 Runtime Environment & Installed Test Tools
Command executed: `node -v; npm -v`
Output:
```
v24.11.1
11.6.2
```
- Ripgrep / package inspection of `package-lock.json` and `node_modules`: Zero test frameworks (such as Jest, Mocha, Vitest, Ava, Supertest, Tap, Jasmine) are installed or declared.
- Built-in capabilities in Node.js v24.11.1:
  - `node:test` is built-in and stable (supports `describe`, `it`, `test`, `before`, `after`, `beforeEach`, `afterEach`, `--test-timeout`, `--test-force-exit`, mock timers).
  - `node:assert` and `node:assert/strict` are built-in.
  - Global `fetch` is natively built-in (allowing HTTP requests against local Express endpoints without external packages like `supertest` or `axios`).

### 1.3 Test Discovery Pitfall with `scratch/` Scripts
Tool command: `node --test --test-timeout=2000`
Observation:
When `node --test` is run without path arguments, Node searches the repository and automatically matches and executes all 8 scripts in `c:\Users\mouni\Desktop\my-cloaker\scratch`:
1. `scratch/hard-test.js` (5,528 bytes)
2. `scratch/test-cloaker.js` (4,418 bytes)
3. `scratch/test-compile.js` (514 bytes)
4. `scratch/test-fresh-slug.js` (1,703 bytes)
5. `scratch/test-slug-activate.js` (3,201 bytes)
6. `scratch/test-slug-live-verify.js` (1,461 bytes)
7. `scratch/test-slug.js` (1,870 bytes)
8. `scratch/test-vm.js` (1,808 bytes)
These scripts took 5.7+ seconds to execute because they make live network calls against production domains (`https://homeandrecipe.com/`) and remote Cloudflare D1 databases.

### 1.4 Test Directory Status
Inspection of workspace directories:
- `c:\Users\mouni\Desktop\my-cloaker\test`: Directory does NOT exist.
- `c:\Users\mouni\Desktop\my-cloaker\tests`: Directory does NOT exist.
- There are currently NO automated unit or integration tests for `server.js`.

### 1.5 Environment Variables in `server.js`
Search command: `Select-String -Path server.js -Pattern "process\.env"`
Matches:
- `server.js:7`: `const PORT = process.env.PORT || 5050;`
  - Defines the HTTP server port; defaults to 5050 if unset.
- `server.js:30`: `const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');`
  - Used in `_asyncRefreshWranglerToken()` to locate Wrangler config on Windows.
- `server.js:46`: `const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');`
  - Used in `getWranglerDefaults()` to locate Wrangler config on Windows.
- `process.env.NODE_ENV` is NOT used anywhere in `server.js`.
- No other `process.env.*` variables are referenced in `server.js`.

### 1.6 Server Startup, Hanging, and Export Characteristics in `server.js`
Direct code inspection:
- Lines 1264–1278:
  ```javascript
  const server = app.listen(PORT, () => {
    ...
    // Pre-verify Cloudflare credentials in background on startup so UI connects instantly
    verifyCloudflare().then(res => { ... }).catch(() => {});
  });
  ```
- Lines 1280–1287:
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
- No export statement exists: `module.exports` is undefined. Requiring `server.js` unconditionally triggers `app.listen(PORT)`.
- On `EADDRINUSE`, the server logs an error message but never exits (`process.exit(1)` is not called), leaving the process hanging in an idle state.
- No `SIGINT` or `SIGTERM` handlers are registered on `process`.
- On line 1271, `verifyCloudflare()` runs in the background on startup, initiating external HTTP requests (`fetch('https://api.cloudflare.com/client/v4/accounts')`) and child processes (`exec('npx wrangler whoami', { timeout: 25000 })`). In test environments or offline environments, this creates dangling asynchronous tasks and delays termination.
- No dedicated `/health` or `/api/health` endpoint exists (only `/` serving static files from `public/index.html`).

---

## 2. Logic Chain

1. **Test Runner Selection**:
   - Observation 1.1 shows only `express` and `wrangler` installed; zero test libraries exist.
   - Observation 1.2 shows Node.js version is v24.11.1, which natively provides `node:test` and `node:assert/strict`.
   - Native `fetch` is available globally in Node v24.
   - Incurring additional npm packages (e.g. `npm install jest` or `supertest`) would add installation time, dependencies, and lockfile modifications.
   - Therefore, `node:test` + `node:assert` + native `fetch` is the optimal, dependency-free testing framework.

2. **Test Command Configuration in `package.json`**:
   - Observation 1.3 shows that running bare `node --test` discovers and runs `scratch/*.js`, which make live network calls against production hosts (`homeandrecipe.com`) and remote D1 databases.
   - Therefore, `npm test` MUST NOT be configured as bare `node --test`.
   - Instead, the script must explicitly isolate tests to a dedicated test folder:
     `"test": "node --test test/*.test.js"` (or `"node --test \"test/**/*.test.js\""`).

3. **Preventing Test Suites from Hanging or Port Collisions**:
   - Observation 1.6 shows `server.js` calls `app.listen(PORT)` unconditionally on load, has no `module.exports`, and triggers `verifyCloudflare()` in the background.
   - If tests `require('../server.js')`, the server binds to port 5050 immediately. If port 5050 is in use, it logs `EADDRINUSE` and hangs without exiting.
   - To make tests deterministic and non-blocking:
     a. `server.js` should check `if (require.main === module)` before calling `app.listen(PORT)`.
     b. `server.js` should export `{ app, server }` (or an `initServer(port)` helper).
     c. In tests, the test runner can bind `app` to an ephemeral port (`app.listen(0)`), get `const port = server.address().port`, run assertions using native `fetch(http://127.0.0.1:${port}/...)`, and close the server in an `after()` hook (`server.close()`).
     d. In test mode (`process.env.NODE_ENV === 'test'`), `server.js` should skip the startup `verifyCloudflare()` network call.
     e. Sockets should be closed cleanly and `SIGINT`/`SIGTERM` handlers added to ensure zero hanging processes.

4. **Health Check Endpoint**:
   - `ORIGINAL_REQUEST.md` (Acceptance criteria) states: "Automated tests verify server startup and health response."
   - Currently, `server.js` lacks an explicit `/health` route. Adding `app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }))` provides an instant, non-blocking health check endpoint.

---

## 3. Caveats

- **Existing scratch scripts**: The 8 scripts in `scratch/` (`scratch/hard-test.js`, etc.) contain useful verification logic for Cloudflare Worker behavior, but they are live integration tests against remote Cloudflare APIs and production URLs. They should NOT be removed, but they must be excluded from `npm test`.
- **Operating System paths**: Windows PowerShell and CMD handle double quotes differently. Using `"test": "node --test test/*.test.js"` in `package.json` is cross-platform safe across Windows, Linux, and macOS without shell escaping issues.
- **Wrangler OAuth Token**: `process.env.APPDATA` is Windows-specific (`%APPDATA%/xdg.config/...`). On non-Windows platforms, fallback paths (`process.env.HOME` or `process.env.XDG_CONFIG_HOME`) are not present in `server.js`, but current execution is strictly on Windows.

---

## 4. Conclusion

1. **`package.json`**:
   - Contains 1 dependency (`express` ^5.3.0) and 1 devDependency (`wrangler` ^3.0.0).
   - Has no `"test"` script.
2. **Testing Framework**:
   - Use Node.js built-in `node:test` and `node:assert/strict` with native `fetch`. No new packages needed.
3. **`npm test` Configuration**:
   - Configure as: `"test": "node --test test/*.test.js"`.
   - Never use bare `"node --test"` because it triggers network calls in `scratch/test-*.js`.
4. **Test Files**:
   - No `test/` or `tests/` directory currently exists.
   - A new test suite should be created at `test/server.test.js` covering startup, health checks, route validation, and error resilience.
5. **Environment Variables**:
   - Only `process.env.PORT` (defaults to 5050) and `process.env.APPDATA` are used.
   - Recommended addition: honor `process.env.NODE_ENV === 'test'` to bypass background Cloudflare API queries on startup during test runs.
6. **Required `server.js` Refactorings**:
   - Wrap `app.listen(PORT)` inside `if (require.main === module)`.
   - Export `module.exports = { app, server };` (or `app`).
   - Add graceful shutdown (`process.on('SIGINT')`, `process.on('SIGTERM')`).
   - Add dedicated `app.get('/health')` endpoint.
   - Exit with code 1 on unrecoverable `EADDRINUSE` errors instead of hanging.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect `package.json`**:
   ```powershell
   Get-Content package.json
   ```
2. **Verify Node.js version and built-in test runner**:
   ```powershell
   node -v
   node --help | Select-String "test"
   ```
3. **Confirm `scratch/` discovery behavior of bare `node --test`**:
   ```powershell
   # Running bare discovery matches scratch files:
   # Note: Do not run for long as it hits live production URLs
   node --test --test-timeout=2000
   ```
4. **Verify absence of `test/` or `tests/` directories**:
   ```powershell
   Test-Path test
   Test-Path tests
   ```
5. **Confirm environment variable usages in `server.js`**:
   ```powershell
   Select-String -Path server.js -Pattern "process\.env"
   ```
6. **Confirm absence of export in `server.js`**:
   ```powershell
   Select-String -Path server.js -Pattern "module\.exports"
   ```
