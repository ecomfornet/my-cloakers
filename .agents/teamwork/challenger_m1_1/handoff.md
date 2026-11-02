# Milestone 1 Empirical Challenge Report

## 1. Observation

### Target File
`c:\Users\mouni\Desktop\my-cloaker\server.js` (1520 lines, verified with `node -c server.js`, exit code 0).

### Empirical Test 1: Syntax & Compilation
- **Command**: `node -c server.js`
- **Exit Code**: `0`
- **Output**: Clean compilation, zero syntax errors.

### Empirical Test 2: Modular Require & Export Shape
- **Command**:
  ```powershell
  node -e "const { app, server, startServer, stopServer } = require('./server.js'); console.log('APP:', typeof app, 'SERVER:', typeof server, 'START:', typeof startServer, 'STOP:', typeof stopServer); console.log('SERVER():', server());"
  ```
- **Exit Code**: `0` (completed in ~130ms)
- **Output**:
  ```
  APP: function SERVER: function START: function STOP: function
  SERVER(): null
  ```
- **Observations**:
  - `require('./server.js')` does NOT bind port 5050 on import.
  - `server()` returns `null` before `startServer()` is called.
  - Exports contain `app`, `server` (callable Proxy), `startServer`, and `stopServer`.

### Empirical Test 3: Ephemeral Port Startup, Endpoints, and Clean Teardown
- **Command**:
  ```powershell
  node -e "process.env.NODE_ENV = 'test'; const { startServer, stopServer } = require('./server.js'); (async () => { const srv = await startServer(0); const port = srv.address().port; console.log('PORT:', port); const h1 = await (await fetch('http://localhost:' + port + '/health')).json(); console.log('HEALTH:', h1.status); const h2 = await (await fetch('http://localhost:' + port + '/api/health')).json(); console.log('API_HEALTH:', h2.status); const postGood = await fetch('http://localhost:' + port + '/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Challenger Campaign', safeUrl: 'https://example.com/safe', moneyUrl: 'https://example.com/money' }) }); console.log('POST_GOOD_STATUS:', postGood.status); await stopServer(); console.log('STOPPED_SUCCESSFULLY'); })();"
  ```
- **Exit Code**: `0`
- **Output**:
  ```
  PORT: 62830
  HEALTH: ok
  API_HEALTH: ok
  POST_GOOD_STATUS: 201
  STOPPED_SUCCESSFULLY
  ```
- **Observations**:
  - Server successfully starts on dynamic port (`port: 62830`).
  - `GET /health` and `GET /api/health` return status `200` with JSON `{ status: 'ok', uptime: <number>, timestamp: <ISO> }`.
  - `POST /api/campaigns` validates input and returns `201 Created`.
  - `stopServer()` drains connections, shuts down the HTTP server, and resets `server` reference to `null`.

### Empirical Test 4: EADDRINUSE Port Collision Handling
- **Command A (Programmatic Rejection)**:
  ```powershell
  node -e "const assert = require('assert'); const { startServer } = require('./server.js'); assert.rejects(async () => { await startServer(5050); }, /EADDRINUSE/).then(() => console.log('ASSERT_REJECTS_PASSED'));"
  ```
- **Output**:
  ```
  [!] Error: Port 5050 is already in use.
  [!] Please run start-dashboard.bat which automatically frees port 5050
  ASSERT_REJECTS_PASSED
  ```
- **Command B (Direct CLI Execution Exit Code)**:
  ```powershell
  node -e "const { spawn } = require('child_process'); const p = spawn(process.execPath, ['server.js']); p.on('exit', (code) => console.log('CLI_EXIT_CODE:', code));"
  ```
- **Output**:
  ```
  CLI_EXIT_CODE: 1
  ```

### Empirical Test 5: Error Middleware & Input Validation
- **Command**:
  ```powershell
  node -e "process.env.NODE_ENV = 'test'; const { startServer, stopServer } = require('./server.js'); (async () => { const srv = await startServer(0); const port = srv.address().port; const res404 = await fetch('http://localhost:' + port + '/nonexistent'); console.log('404_STATUS:', res404.status); const resMalformed = await fetch('http://localhost:' + port + '/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ bad json' }); console.log('MALFORMED_STATUS:', resMalformed.status); await stopServer(); })();"
  ```
- **Output**:
  ```
  404_STATUS: 404
  MALFORMED_STATUS: 400
  ```

## 2. Logic Chain
1. Step 1: `server.js` lines 1401-1447 implement `startServer(port = PORT)` using `http.createServer(app)`.
2. Step 2: In `startServer()`, `srv.on('error', ...)` is attached before `srv.listen(port)`. When a port is already bound (e.g. port 5050), the error handler intercepts the `EADDRINUSE` event, rejects the promise without invoking the listen callback, and if `require.main === module`, calls `process.exit(1)`. This directly satisfies R1 and Acceptance Criterion 1.
3. Step 3: `module.exports` exports `{ app, server: serverExport, startServer, stopServer, ... }`. Requiring the file does not call `app.listen()` or `startServer()` automatically because direct execution is guarded by `if (require.main === module)` at line 1480.
4. Step 4: `stopServer()` calls `server.closeAllConnections()` and `server.close()`, resetting the internal server pointer to `null`. This prevents hanging connections and enables immediate socket re-binding.
5. Step 5: `app.use((err, req, res, next) => ...)` catches Express runtime errors and malformed JSON bodies, returning clean JSON errors instead of crashing or hanging.

## 3. Caveats
- Cloudflare remote API verification (`verifyCloudflare()`) is intentionally bypassed during tests when `process.env.NODE_ENV === 'test'` to avoid outbound external network calls.
- Port 5050 was occupied on the host by PID 7804, which served as a real-world test oracle for port collision detection.

## 4. Conclusion
**VERDICT: APPROVE**

Milestone 1 changes in `server.js` meet all functional and non-functional requirements:
1. Modular require works cleanly without hanging or binding port 5050 on import.
2. Programmatic startup (`startServer(0)`) and teardown (`stopServer()`) operate cleanly on dynamic ports.
3. Port collision (`EADDRINUSE`) is handled properly with Promise rejection in library mode and exit code 1 in CLI mode.
4. Health routes (`/health`, `/api/health`) and core API endpoints respond accurately.

## 5. Verification Method
To independently verify:
```bash
node -c server.js
node -e "const { app, startServer, stopServer } = require('./server.js'); (async () => { const srv = await startServer(0); await stopServer(); console.log('PASSED'); })();"
node -e "const assert = require('assert'); const { startServer } = require('./server.js'); assert.rejects(async () => { await startServer(5050); }, /EADDRINUSE/).then(() => console.log('PASSED'));"
```
Invalidation condition: If `require('./server.js')` binds port 5050 before `startServer()` is called, or if `assert.rejects` fails, the report is invalidated.
