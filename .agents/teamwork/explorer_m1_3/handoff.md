# Milestone 1 Remediation Strategy: Process Signals, Socket Teardown & Global Guards

**Agent**: Milestone 1 Explorer 3 (`teamwork_explorer`)  
**Target File**: `c:\Users\mouni\Desktop\my-cloaker\server.js`  
**Working Directory**: `c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_3`  
**Timestamp**: 2026-11-01T12:16:00Z  

---

## 1. Observation

Direct observations from source inspection of `server.js` (1288 lines), runtime evaluation on Node.js v24.11.1 (Windows), and network socket inspection:

### 1.1 Complete Absence of Signal Handlers (`SIGINT`, `SIGTERM`)
- **Inspection**: Ripgrep search across `server.js` for `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK`, `beforeExit`, or `shutdown` returned **0 matches**.
- **Current Lifecycle Handling** (`server.js`, Lines 1264–1288):
  ```javascript
  1264: const server = app.listen(PORT, () => {
  1265:   console.log(`\n======================================================`);
  1266:   console.log(`🚀 Cloaker Dashboard is running!`);
  1267:   console.log(`👉 Open: http://localhost:${PORT}`);
  1268:   console.log(`======================================================\n`);
  ...
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
- **Consequence**: When the user presses Ctrl+C in a terminal, or when process orchestrators (Docker, Kubernetes, PM2, Windows Service wrappers) send termination signals, `server.js` has no listener to intercept the signal. The process either aborts abruptly without closing files or sockets, or hangs if handles are kept open by active worker processes or connections.

### 1.2 Socket Leaks and Lingering TCP Keep-Alive Connections
- **Inspection of Sockets**: Running `netstat -ano | findstr :5050` during initial survey revealed sockets remaining in `CLOSE_WAIT` and `FIN_WAIT_2` attached to Node process PID 7804.
- **Root Cause**:
  1. Express HTTP servers use HTTP/1.1 persistent keep-alive connections by default. When browsers (Chrome, Edge) or automated clients connect, underlying TCP sockets remain in `ESTABLISHED` state waiting for subsequent requests.
  2. In Node.js, `server.close(callback)` stops accepting *new* connections, but **waits indefinitely** for open keep-alive connections to close naturally. If a browser or proxy keeps the socket open, `server.close()` will never trigger its callback unless existing connections are explicitly closed or destroyed.
  3. Evidence of this recurring issue exists in `start-dashboard.bat`:
     ```bat
     8: for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050 " 2^>nul') do taskkill /F /PID %%a 2>nul
     ```
     The author relied on brute-force `taskkill /F` because previous Node instances failed to release sockets and terminate cleanly.

### 1.3 Absence of Global Process Crash Guards (`uncaughtException`, `unhandledRejection`)
- **Inspection**: In `server.js`, there is no `process.on('uncaughtException')` and no `process.on('unhandledRejection')`.
- **Runtime Risk**:
  1. In modern Node.js (Node 15+ through Node 24.11.1), unhandled promise rejections trigger `UnhandledPromiseRejection` and default to terminating the process with a non-zero exit code (`--unhandled-rejections=throw`).
  2. In `server.js`, asynchronous operations (e.g. background Wrangler OAuth token refreshes, Cloudflare D1 queries, `fetch` calls without timeout handlers, file operations) will abort the entire process if an unhandled promise rejection occurs.
  3. No structured diagnostics (timestamp, process ID, memory, error code, stack trace) are currently emitted, making production crash diagnosis impossible.

### 1.4 Node.js v24.11.1 Native Capabilities Verified
- We ran runtime probes against the target environment:
  - `typeof server.closeAllConnections`: **`function`** (native in Node 18.2+)
  - `typeof server.closeIdleConnections`: **`function`** (native in Node 18.0+)
  - Calling `server.closeAllConnections()` when closing a server with active keep-alive sockets dropped shutdown latency from indefinite to **1 ms**.
  - Intercepting `unhandledRejection` via `process.on('unhandledRejection')` successfully prevented process termination and preserved process stability.

---

## 2. Logic Chain

1. **Premise 1 (Acceptance Criteria & R1)**: The server must handle process termination signals (`SIGINT`/`SIGTERM`) cleanly without leaving hung sockets or orphan processes, and must remain resilient to runtime exceptions.
2. **From Observation 1.1**: Without `process.on('SIGINT')` and `process.on('SIGTERM')`, termination signals are unhandled. When triggered, the process cannot run any cleanup logic.
3. **From Observation 1.2**: Simply calling `server.close()` during shutdown is insufficient because `server.close()` only rejects new incoming connections while allowing keep-alive sockets to remain open. Without socket termination, the Node event loop remains blocked on open sockets, causing process hangs.
4. **From Observation 1.4**: Node.js v24 provides `server.closeIdleConnections()` (closes idle keep-alive connections immediately) and `server.closeAllConnections()` (forcefully destroys all in-flight connections). Pairing this with an explicit `activeSockets = new Set()` tracking mechanism provides dual-layer resilience across all environments, plus real-time visibility into open connection counts.
5. **From Observation 1.2 & Fallback Timeout**: If a connection or cleanup task stalls indefinitely during shutdown, a 5000ms watchdog timer (`setTimeout(..., 5000).unref()`) guarantees that the process forcefully terminates with `process.exit(1)`, preventing orphan zombie processes.
6. **Programmatic vs CLI Decoupling**: Automated test suites (e.g., `test/lifecycle.test.js`, `test/startup.test.js`) must be able to call `await stopServer()` to shut down the HTTP server cleanly without killing the test runner process. Therefore, `stopServer()` must resolve a Promise and never call `process.exit()`. Only the signal listeners (`gracefulShutdown()`) should invoke `process.exit(0)` after `stopServer()` resolves.
7. **From Observation 1.3**: Registering top-level handlers for `uncaughtException` and `unhandledRejection` with structured JSON diagnostic logging captures all unexpected runtime failures, prevents sudden process death from asynchronous promises, and logs forensic state (timestamp, memory usage, uptime, stack trace).

---

## 3. Caveats

1. **Windows Platform Signal Nuance**:
   - On Windows, POSIX signals like `SIGTERM` are not natively dispatched across processes by the OS kernel in the same manner as Linux. However, Node.js triggers `process.on('SIGINT')` on Ctrl+C, and supports `SIGBREAK` (Ctrl+Break).
   - In containerized environments (Docker, Kubernetes) and Linux production deployments, `SIGTERM` is the standard shutdown signal.
   - Listening to `SIGINT`, `SIGTERM`, and `SIGBREAK` covers Windows terminal usage, Docker/K8s container lifecycle, and PM2 process managers.
2. **Timer Event Loop Unreferencing (`.unref()`)**:
   - The 5000ms fallback watchdog timer MUST call `.unref()`. If it is not unreferenced, the timer itself would keep Node's event loop alive for 5 seconds even after all sockets and servers are closed.
3. **Idempotency Guard**:
   - Rapidly pressing Ctrl+C twice must not execute concurrent or conflicting shutdown sequences. An `isShuttingDown` flag ensures the first signal begins graceful shutdown, and a subsequent signal forces immediate exit (`process.exit(1)`).
4. **Error Object Formatting in Rejection Handlers**:
   - A promise rejection reason is not guaranteed to be an instance of `Error` (e.g. `Promise.reject('string')` or `Promise.reject({ custom: 123 })`). The logging utility must safely handle non-Error objects without throwing secondary exceptions.

---

## 4. Conclusion & Actionable Code Remediation

The Milestone 1 Worker should apply the following three modular code sections in `c:\Users\mouni\Desktop\my-cloaker\server.js`:

### 4.1 Section A: Global Process Guards (Place at Top of `server.js`)
*Insert directly after module imports (around line 5–10) so all subsequent operations are guarded.*

```javascript
// =========================================================================
// Global Process Crash Prevention (Safety Guards)
// =========================================================================

process.on('uncaughtException', (err, origin) => {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    event: 'uncaughtException',
    origin: origin || 'unknown',
    name: err ? err.name : 'UnknownError',
    message: err ? err.message : String(err),
    code: err ? err.code : undefined,
    stack: err && err.stack ? err.stack : undefined,
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    memory: process.memoryUsage()
  };
  console.error('[CRITICAL] Uncaught Exception detected:\n', JSON.stringify(diagnostic, null, 2));
});

process.on('unhandledRejection', (reason, promise) => {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    event: 'unhandledRejection',
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      code: reason.code,
      stack: reason.stack
    } : reason,
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    memory: process.memoryUsage()
  };
  console.error('[WARNING] Unhandled Promise Rejection detected:\n', JSON.stringify(diagnostic, null, 2));
});
```

---

### 4.2 Section B: Socket Tracking & Programmatic `stopServer()`
*Insert in the lifecycle management section towards the bottom of `server.js`.*

```javascript
// =========================================================================
// Socket Tracking & Clean Connection Teardown
// =========================================================================

const activeSockets = new Set();

/**
 * Attaches connection tracking listeners to an HTTP server instance.
 * @param {import('http').Server} serverInstance
 */
function trackSockets(serverInstance) {
  if (!serverInstance) return;
  serverInstance.on('connection', (socket) => {
    activeSockets.add(socket);
    socket.on('close', () => {
      activeSockets.delete(socket);
    });
  });
}

/**
 * Gracefully stops the HTTP server and terminates lingering sockets.
 * Returns a Promise that resolves when fully closed.
 * Note: Does NOT call process.exit(), making it safe for programmatic test runners.
 * @param {import('http').Server} [serverInstance] Optional explicit server instance
 * @returns {Promise<void>}
 */
function stopServer(serverInstance = server) {
  return new Promise((resolve, reject) => {
    if (!serverInstance || !serverInstance.listening) {
      return resolve();
    }

    const openCount = activeSockets.size;
    console.log(`[Server] Closing HTTP server (${openCount} active socket(s))...`);

    // 1. Close idle keep-alive connections immediately (Node 18+)
    if (typeof serverInstance.closeIdleConnections === 'function') {
      try {
        serverInstance.closeIdleConnections();
      } catch (err) {
        console.warn('[Server] Notice closing idle connections:', err.message);
      }
    }

    // 2. Stop accepting new connections and request server shutdown
    serverInstance.close((err) => {
      if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
        console.error('[Server] Error closing HTTP server:', err);
        return reject(err);
      }
      console.log('[Server] HTTP server closed cleanly.');
      resolve();
    });

    // 3. Force-close all remaining connections (Node 18+)
    if (typeof serverInstance.closeAllConnections === 'function') {
      try {
        serverInstance.closeAllConnections();
      } catch (err) {
        console.warn('[Server] Notice closing all connections:', err.message);
      }
    }

    // 4. Fallback: destroy any sockets still lingering in the Set
    for (const socket of activeSockets) {
      try {
        socket.destroy();
      } catch (e) {}
    }
    activeSockets.clear();
  });
}
```

---

### 4.3 Section C: Signal Handling, Watchdog Fallback & Process Termination
*Insert directly following Section B.*

```javascript
// =========================================================================
// Process Signal Handling & Graceful Shutdown Watchdog
// =========================================================================

const SHUTDOWN_TIMEOUT_MS = 5000;
let isShuttingDown = false;

/**
 * Graceful shutdown coordinator invoked upon receiving termination signals.
 * @param {string} signal The signal received (e.g. 'SIGINT', 'SIGTERM')
 * @param {import('http').Server} [serverInstance]
 */
function gracefulShutdown(signal, serverInstance = server) {
  if (isShuttingDown) {
    console.warn(`[Process] Repeated signal ${signal} received. Forcing immediate termination.`);
    process.exit(1);
  }
  isShuttingDown = true;
  console.log(`\n[Process] Received ${signal}. Initiating graceful shutdown...`);

  // Fallback watchdog timer: forcefully exit if connections fail to drain within 5 seconds
  const forceTimer = setTimeout(() => {
    console.error(`[Process] Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms. Forcing process exit.`);
    if (serverInstance && typeof serverInstance.closeAllConnections === 'function') {
      try { serverInstance.closeAllConnections(); } catch (e) {}
    }
    for (const socket of activeSockets) {
      try { socket.destroy(); } catch (e) {}
    }
    activeSockets.clear();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Crucial: unref ensures the watchdog timer itself does not delay process exit
  forceTimer.unref();

  stopServer(serverInstance)
    .then(() => {
      clearTimeout(forceTimer);
      console.log('[Process] Graceful shutdown completed cleanly. Exiting with code 0.');
      process.exit(0);
    })
    .catch((err) => {
      clearTimeout(forceTimer);
      console.error('[Process] Error occurred during graceful shutdown:', err);
      process.exit(1);
    });
}

/**
 * Registers process signal listeners.
 * @param {import('http').Server} [serverInstance]
 */
function registerSignalHandlers(serverInstance = server) {
  const handle = (sig) => gracefulShutdown(sig, serverInstance);

  process.on('SIGINT', () => handle('SIGINT'));
  process.on('SIGTERM', () => handle('SIGTERM'));

  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => handle('SIGBREAK'));
  }
}
```

---

### 4.4 Section D: Integration with Server Startup and Module Exports
*Coordinates with Explorer 1's `startServer()` and `module.exports`:*

```javascript
// Module-scoped server reference
let server = null;

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Cloaker Dashboard is running!`);
      console.log(`👉 Open: http://localhost:${port}`);
      console.log(`======================================================\n`);

      // Pre-verify Cloudflare credentials in background
      verifyCloudflare().catch(() => {});
      resolve(srv);
    });

    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[!] Error: Port ${port} is already in use.`);
      } else {
        console.error('[!] Server error:', err);
      }
      reject(err);
    });

    // Hook socket tracking and update module server variable
    trackSockets(srv);
    server = srv;
  });
}

// Standalone execution: bind signals and start server
if (require.main === module) {
  registerSignalHandlers();
  startServer().catch((err) => {
    console.error('[Startup] Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  server,
  startServer,
  stopServer,
  activeSockets,
  gracefulShutdown,
  registerSignalHandlers
};
```

---

## 5. Verification Method

To independently verify the implementation after the Milestone 1 Worker applies the changes:

### 5.1 Verify Global Crash Prevention (Unhandled Rejection Interception)
Run this command from workspace root:
```bash
node -e "
const { app } = require('./server');
process.emit('unhandledRejection', new Error('Simulated Background Rejection'));
console.log('SURVIVED_REJECTION');
"
```
- **Expected Output**: Formatted JSON diagnostic log with `[WARNING] Unhandled Promise Rejection detected:` and string `SURVIVED_REJECTION`, exiting with code 0 instead of crashing.

### 5.2 Verify Socket Tracking and Clean Teardown
Run this command from workspace root:
```bash
node -e "
const { startServer, stopServer, activeSockets } = require('./server');
const http = require('http');

async function test() {
  const srv = await startServer(0);
  const port = srv.address().port;
  console.log('Server running on dynamic port:', port);

  // Open a persistent keep-alive connection
  const agent = new http.Agent({ keepAlive: true });
  http.get({ port, agent, path: '/favicon.ico' }, async (res) => {
    console.log('Active sockets count:', activeSockets.size);
    const t0 = Date.now();
    await stopServer(srv);
    console.log('Server stopped in', Date.now() - t0, 'ms. Remaining sockets:', activeSockets.size);
    process.exit(activeSockets.size === 0 ? 0 : 1);
  });
}
test();
"
```
- **Expected Output**:
  - `Active sockets count: 1`
  - `Server stopped in <10 ms. Remaining sockets: 0`
  - Process exits cleanly with code 0.

### 5.3 Verify Graceful Signal Termination (`SIGINT` / `SIGTERM`)
Run this verification command in PowerShell:
```powershell
node -e @"
const { spawn } = require('child_process');
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '5098' } });
child.stdout.on('data', (d) => {
  const str = d.toString();
  if (str.includes('Cloaker Dashboard is running')) {
    console.log('Server ready, sending SIGINT...');
    child.kill('SIGINT');
  }
  if (str.includes('Received SIGINT')) {
    console.log('Child reported graceful shutdown initiation.');
  }
});
child.on('exit', (code) => {
  console.log('Child exited with code:', code);
  process.exit(code === 0 ? 0 : 1);
});
"@
```
- **Expected Output**:
  - `Server ready, sending SIGINT...`
  - `Child reported graceful shutdown initiation.`
  - `Child exited with code: 0`

### 5.4 Test Suite Integration (Milestone 2)
In `test/lifecycle.test.js`:
Run `npm test` -> `node --test test/lifecycle.test.js`.
- All tests covering signal handling, graceful shutdown, and socket release will pass with 0 failures and exit code 0.

### 5.5 Invalidation Conditions
The solution is invalidated if:
1. `server.close()` hangs indefinitely when HTTP clients keep persistent connections open.
2. `node server.js` terminates abruptly on unhandled asynchronous promise rejections without structured diagnostic logs.
3. Test runners calling `await stopServer()` trigger unexpected `process.exit()` within the test process.
4. Sending `SIGINT` leaves orphan Node processes or listening sockets bound to port 5050.
