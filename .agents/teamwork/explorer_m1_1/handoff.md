# Milestone 1 Remediation Strategy: Startup, Modular Export & Port Collision Handling

**Agent**: Milestone 1 Explorer 1 (`teamwork_explorer`)  
**Target File**: `c:\Users\mouni\Desktop\my-cloaker\server.js`  
**Working Directory**: `c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_1`  
**Timestamp**: 2026-11-01T12:16:00Z  

---

## 1. Observation

Direct code observations and runtime verification from inspecting `c:\Users\mouni\Desktop\my-cloaker\server.js` and project configuration:

### 1.1 Unconditional Top-Level `app.listen()` and Zero Module Exports
- **File & Lines**: `server.js`, Lines 1264–1288
- **Verbatim Code**:
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
  1. `app.listen(PORT)` is executed immediately upon module evaluation at root scope.
  2. There is no `require.main === module` check anywhere in `server.js`.
  3. `server.js` contains **zero** `module.exports` statements (`grep_search` and manual inspection confirm no export exists).
  4. Any test runner attempting `const { app } = require('./server')` immediately triggers port binding to `PORT` (5050), causing port collision errors and preventing programmatic test isolation on dynamic ports (e.g. port 0).

### 1.2 `EADDRINUSE` Handling Leaves Process in Indeterminate State With Exit Code 0
- **File & Lines**: `server.js`, Lines 1280–1287
- **Observations**:
  1. When port 5050 is occupied, `server.on('error')` logs an error message but never calls `process.exit(1)`.
  2. Running `node server.js` while port 5050 is in use prints the collision error and exits with code 0 (or hangs if other event loop resources remain active).
  3. Continuous integration pipelines, process managers (e.g. systemd/PM2), and batch scripts (`start-dashboard.bat`) cannot distinguish a successful start from an address collision.

### 1.3 Subprocess Wrangling and Startup Background Verification Hazards
- **File & Lines**: `server.js`, Lines 23–41, 73–79, 1271–1277
- **Verbatim Code**:
  ```javascript
  26: exec('npx wrangler whoami', { timeout: 25000 }, (err) => { ... });
  ...
  75: exec('npx wrangler whoami', { timeout: 25000 }, () => {
  76:   resolve(getWranglerDefaults());
  77: });
  ...
  1271: verifyCloudflare().then(res => { ... }).catch(() => {});
  ```
- **Observations**:
  1. `npx wrangler whoami` is spawned with a 25-second timeout and without `windowsHide: true` or `CI: 'true'` environment variables.
  2. In offline environments or test runners where Wrangler is unauthenticated or missing, `exec` can hang for up to 25 seconds, keeping the Node.js event loop active and preventing test runners from completing cleanly.
  3. `getWranglerDefaultsFresh()` lacks concurrency deduplication; multiple callers trigger parallel child processes.
  4. Platform path `path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml')` fails on non-Windows platforms (Linux/Docker/macOS).

---

## 2. Logic Chain

1. **Premise**: Automated test execution and modular service design require that importing `server.js` (`require('./server')`) does NOT automatically bind ports or start side-effects. The test suite must be able to import `app`, call `startServer(0)` to bind an ephemeral OS-assigned port, run tests against `http://localhost:${server.address().port}`, and call `stopServer()` to cleanly release all sockets.
2. **From Observation 1.1**: Because `app.listen()` is called at the top level of `server.js` without exports, any test framework importing `server.js` collides on port 5050 and cannot stop or re-start the server.
3. **From Observation 1.2**: Because `server.on('error')` does not call `process.exit(1)` when `EADDRINUSE` occurs, a failed server startup in CLI mode appears to succeed or hangs indefinitely. Distinguishing between CLI execution (`require.main === module`) and programmatic test usage allows `process.exit(1)` to fire in CLI mode while rejecting the `startServer` promise in test mode.
4. **From Observation 1.3**: When `verifyCloudflare()` runs at startup, if Wrangler is unauthenticated, expired, or offline, child processes and network timeouts can delay startup or hang the test process. Wrapping the startup verification in an unawaited, isolated `setImmediate` block with environment bypass (`NODE_ENV === 'test'` or `process.env.SKIP_CF_VERIFY`) and lowering subprocess timeouts ensures startup is instantaneous and never blocks server listening.

---

## 3. Caveats

1. **Existing Background Process on Port 5050**: PID 7804 is currently listening on port 5050 on this development machine. In implementation, tests should bind to dynamic port 0 (`startServer(0)`) to avoid collisions with any existing service.
2. **Backward Compatibility**: `start-dashboard.bat` and `npm start` execute `node server.js`. The conditional `if (require.main === module) { startServer(); }` preserves 100% backward compatibility for all production scripts.
3. **Scope Division**: Process signal handlers (`SIGINT`/`SIGTERM`) and global crash guards (`uncaughtException`) are designed by Explorer M1 3; Health routes and Express error middleware are designed by Explorer M1 2. This report provides clean integration hooks (`stopServer`) for both.

---

## 4. Conclusion & Exact Remediation Strategy

The implementation worker (`worker_m1`) should apply the following concrete code changes to `server.js`:

### Change 1: Global Server Reference Initialization
At line 7 of `server.js`, declare `let server = null;`:

```javascript
// Top of server.js (Lines 6-8)
const app = express();
const PORT = process.env.PORT || 5050;
let server = null; // Global server instance reference for lifecycle & exports
```

### Change 2: Cross-Platform Path & Debounced Wrangler Defaults
At lines 30, 46, and 73, replace hardcoded APPDATA paths and add concurrency debouncing with reduced timeout (8000ms):

```javascript
// Helper: Resolve Wrangler config path cross-platform (Windows, Linux, macOS)
function getWranglerConfigPath() {
  const os = require('os');
  const candidates = [
    path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), '.wrangler', 'config', 'default.toml'),
    path.join(os.homedir(), '.wrangler', 'config', 'default.toml')
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return candidates[0];
}

let _freshWranglerPromise = null;
async function getWranglerDefaultsFresh() {
  if (_freshWranglerPromise) return _freshWranglerPromise;
  _freshWranglerPromise = new Promise((resolve) => {
    exec('npx wrangler whoami', {
      timeout: 8000,
      windowsHide: true,
      env: { ...process.env, CI: 'true' }
    }, () => {
      _freshWranglerPromise = null;
      resolve(getWranglerDefaults());
    });
  });
  return _freshWranglerPromise;
}
```

### Change 3: Implementation of `startServer()`, `stopServer()`, `require.main`, and Modular Exports
Replace lines 1264–1288 in `server.js` with the following comprehensive implementation:

```javascript
/**
 * Starts the Cloaker Dashboard HTTP Server.
 * @param {number|string} [port] - Port to listen on (defaults to process.env.PORT || 5050).
 * @param {object} [options] - Optional start configuration.
 * @param {boolean} [options.skipVerifyCloudflare] - If true, skips background Cloudflare pre-verification.
 * @returns {Promise<import('http').Server>} Resolves to listening HTTP Server instance.
 */
function startServer(port = (process.env.PORT || 5050), options = {}) {
  if (server && server.listening) {
    return Promise.resolve(server);
  }

  return new Promise((resolve, reject) => {
    const targetPort = port !== undefined && port !== null ? port : (process.env.PORT || 5050);
    let hasStarted = false;

    const srv = app.listen(targetPort, () => {
      hasStarted = true;
      server = srv;
      module.exports.server = srv;

      const address = srv.address();
      const actualPort = typeof address === 'object' && address ? address.port : targetPort;

      console.log(`\n======================================================`);
      console.log(`🚀 Cloaker Dashboard is running!`);
      console.log(`👉 Open: http://localhost:${actualPort}`);
      console.log(`======================================================\n`);

      // Pre-verify Cloudflare credentials in background on startup
      // Asynchronous, detached, and never blocks listening or rejects the startup promise
      const shouldSkipVerify = options.skipVerifyCloudflare ||
        process.env.NODE_ENV === 'test' ||
        process.env.SKIP_CF_VERIFY === 'true';

      if (!shouldSkipVerify) {
        setImmediate(() => {
          try {
            verifyCloudflare().then(res => {
              if (res && res.success) {
                console.log(`[Cloudflare] Pre-verified: ${res.account?.name} (${res.zonesCount} zones)`);
              } else {
                console.log(`[Cloudflare] Pre-verify notice: ${res?.message || 'Verification skipped'}`);
              }
            }).catch(err => {
              console.log(`[Cloudflare] Pre-verify notice: ${err?.message || 'Verification failed'}`);
            });
          } catch (err) {
            console.log(`[Cloudflare] Pre-verify startup notice: ${err?.message || 'Verification skipped'}`);
          }
        });
      }

      resolve(srv);
    });

    srv.on('error', (err) => {
      if (!hasStarted) {
        server = null;
        module.exports.server = null;
        reject(err);
      }

      if (err.code === 'EADDRINUSE') {
        console.error(`\n[!] Error: Port ${targetPort} is already in use.`);
        console.error(`[!] Please run start-dashboard.bat which automatically frees port ${targetPort}\n`);
        if (require.main === module) {
          process.exit(1);
        }
      } else {
        console.error('[!] Server error:', err);
        if (require.main === module && !hasStarted) {
          process.exit(1);
        }
      }
    });

    server = srv;
    module.exports.server = srv;
  });
}

/**
 * Gracefully stops the Cloaker Dashboard HTTP Server.
 * @param {boolean} [force=false] - If true, immediately terminates all active connections.
 * @returns {Promise<void>} Resolves when the server is completely closed.
 */
function stopServer(force = false) {
  return new Promise((resolve, reject) => {
    if (!server) {
      return resolve();
    }

    const currentServer = server;
    let forceTimer = null;

    if (force) {
      if (typeof currentServer.closeAllConnections === 'function') {
        currentServer.closeAllConnections();
      }
    } else {
      if (typeof currentServer.closeIdleConnections === 'function') {
        currentServer.closeIdleConnections();
      }
      // Safety fallback: if keep-alive connections do not drain within 5 seconds, force closure
      forceTimer = setTimeout(() => {
        if (typeof currentServer.closeAllConnections === 'function') {
          currentServer.closeAllConnections();
        }
      }, 5000);
      if (forceTimer.unref) forceTimer.unref();
    }

    currentServer.close((err) => {
      if (forceTimer) clearTimeout(forceTimer);
      server = null;
      module.exports.server = null;

      if (err) {
        if (err.code === 'ERR_SERVER_NOT_RUNNING') {
          return resolve();
        }
        return reject(err);
      }
      resolve();
    });
  });
}

// Conditional execution: only auto-start when executed directly from CLI (e.g. node server.js)
if (require.main === module) {
  startServer().catch((err) => {
    console.error('[!] Fatal server startup failure:', err);
    process.exit(1);
  });
}

// Modular exports for programmatic consumption and test runner integration
module.exports = {
  app,
  get server() {
    return server;
  },
  set server(val) {
    server = val;
  },
  startServer,
  stopServer,
  verifyCloudflare,
  buildWorkerCode,
  buildRobotsTxt,
  loadConfig,
  saveConfig,
  loadCampaigns,
  saveCampaigns
};
```

---

## 5. Verification Method

Once Worker M1 applies this remediation:

### 5.1 Test 1: Modular Import Isolation (No Auto-Listen)
Execute:
```bash
node -e "const { app, startServer, stopServer } = require('./server'); console.log('Export check:', typeof app === 'function', typeof startServer === 'function', typeof stopServer === 'function');"
```
**Expected Output**:
`Export check: true true true` (No listening banner, zero open sockets, exits in <100ms).

### 5.2 Test 2: Dynamic Port Programmatic Start and Stop
Execute:
```bash
node -e "const { startServer, stopServer } = require('./server'); (async () => { const s = await startServer(0); console.log('Listening port:', s.address().port); await stopServer(); console.log('Stopped successfully'); })()"
```
**Expected Output**:
`Listening port: <ephemeral_port>` followed by `Stopped successfully` with clean exit code 0.

### 5.3 Test 3: Port Collision Non-Zero Exit Code
With a mock process holding port 5059:
```bash
node -e "const net = require('net'); const s = net.createServer().listen(5059, () => { const { spawn } = require('child_process'); const p = spawn('node', ['server.js'], { env: { ...process.env, PORT: '5059' } }); p.on('exit', (code) => { console.log('Subprocess exit code:', code); s.close(); process.exit(code === 1 ? 0 : 1); }); });"
```
**Expected Output**:
`Subprocess exit code: 1` (Exits with 0 indicating verified defect resolution).

### 5.4 Test 4: Verification Bypassed Under `NODE_ENV=test`
Execute:
```bash
node -e "process.env.NODE_ENV = 'test'; const { startServer, stopServer } = require('./server'); (async () => { const s = await startServer(0); await stopServer(); console.log('Verified: no hang'); })();"
```
**Expected Output**:
`Verified: no hang` completes in <150ms without invoking Wrangler child processes.
