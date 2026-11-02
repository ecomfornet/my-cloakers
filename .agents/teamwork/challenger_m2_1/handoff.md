# Milestone 2 Challenger 1 Empirical Challenge Report

## 1. Observation

### Test Command Execution
- Command executed: `npm test`
- Working Directory: `c:\Users\mouni\Desktop\my-cloaker`
- Exit Code: `1` (Failure)
- Duration: `248.2179ms`

### Verbatim Output from `npm test`
```
> homeandrecipe-cloaker@1.0.0 test
> node --test test/**/*.test.js


======================================================
🚀 Cloaker Dashboard is running!
👉 Open: http://localhost:62591
======================================================


======================================================
🚀 Cloaker Dashboard is running!
👉 Open: http://localhost:62592
======================================================


======================================================

[!] Error: Port 62593 is already in use.
[!] Please run start-dashboard.bat which automatically frees port 62593

🚀 Cloaker Dashboard is running!
👉 Open: http://localhost:62593
======================================================


======================================================
🚀 Cloaker Dashboard is running!
👉 Open: http://localhost:62594
======================================================


======================================================
🚀 Cloaker Dashboard is running!
👉 Open: http://localhost:62595
======================================================

▶ Server Startup & Modular Export
  ✔ requiring server.js exports { app, server, startServer, stopServer } without auto-binding port (129.7686ms)
  ✔ calling startServer(0) binds an ephemeral port cleanly and returns listening HTTP server (3.3517ms)
  ✔ calling stopServer() shuts down cleanly without hanging (2.6454ms)
  ✖ calling startServer(occupiedPort) rejects with EADDRINUSE (4.0591ms)
  ✔ server can be restarted on a new ephemeral port after stopServer() (3.1663ms)
✖ Server Startup & Modular Export (144.3028ms)
ℹ tests 5
ℹ suites 1
ℹ pass 4
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 248.2179

✖ failing tests:

test at test\startup.test.js:83:3
✖ calling startServer(occupiedPort) rejects with EADDRINUSE (4.0591ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection: startServer should reject with EADDRINUSE when port is occupied
      at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
      at async TestContext.<anonymous> (C:\Users\mouni\Desktop\my-cloaker\test\startup.test.js:95:7)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Suite.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }
```

### Metrics Summary
- **Exit Code**: `1`
- **Total Test Suites**: 1 (`Server Startup & Modular Export`)
- **Total Tests Executed**: 5
- **Passed**: 4
- **Failed**: 1 (`test/startup.test.js:83:3` - `calling startServer(occupiedPort) rejects with EADDRINUSE`)
- **Cancelled / Skipped / Todo**: 0
- **Hangs / Timeouts during test execution**: None (completed in 248ms)

### Code Inspection Observations
1. In `server.js` lines 1400–1443:
   ```javascript
   function startServer(port = PORT) {
     return new Promise((resolve, reject) => {
       let resolved = false;
       const srv = app.listen(port, () => {
         server = srv;
         resolved = true;
         ...
         resolve(srv);
       });

       srv.on('error', (err) => {
         if (err.code === 'EADDRINUSE') {
           console.error(`\n[!] Error: Port ${port} is already in use.`);
           console.error(`\n[!] Please run start-dashboard.bat which automatically frees port ${port}\n`);
         } else {
           console.error('[!] Server error:', err);
         }
         if (!resolved) {
           reject(err);
         }
         if (require.main === module) {
           process.exit(1);
         }
       });

       server = srv;
     });
   }
   ```
2. In Express 5 (`node_modules/express/lib/application.js`):
   ```javascript
   app.listen = function listen() {
     var server = http.createServer(this);
     var args = slice.call(arguments);
     if (typeof args[args.length - 1] === 'function') {
       var done = args[args.length - 1] = once(args[args.length - 1]);
       server.once('error', done);
     }
     return server.listen.apply(server, args);
   };
   ```
   Express's `app.listen` passes the callback `done` to `server.once('error', done)`. When an error such as `EADDRINUSE` occurs, Express immediately invokes the callback provided to `app.listen()`. In `server.js`, that callback resolves the Promise (`resolve(srv)`) and sets `resolved = true`. Therefore, `srv.on('error')` runs after the Promise has already been resolved with `srv`, and `startServer()` resolves successfully instead of rejecting.

3. Test coverage in `test/`:
   Only `test/startup.test.js` exists in the `test/` directory. No test suites currently exist for:
   - Health check endpoints (`/health`, `/api/health`)
   - API endpoints (`POST /api/campaigns`, `GET /api/campaigns`, `GET /api/stats`)
   - Cloaker redirection & bot detection logic (`/safe`, `/offer`, `isBot`, UA parsing)
   - Express 404 & 500 error middleware

## 2. Logic Chain

1. Step 1: The test suite was executed via `npm test`.
2. Step 2: Observation shows that `npm test` exited with non-zero exit code `1`.
3. Step 3: Observation shows 1 test failed: `calling startServer(occupiedPort) rejects with EADDRINUSE` at `test/startup.test.js:83:3`.
4. Step 4: Step-by-step trace of `startServer()` in `server.js` reveals that Express's `app.listen` attaches the passed callback as an `error` listener via `server.once('error', done)`.
5. Step 5: When an occupied port is supplied, Express invokes the callback on error, which triggers `resolve(srv)` instead of `reject(err)`.
6. Step 6: `test/startup.test.js` asserts `assert.rejects(async () => { await mod.startServer(occupiedPort); })`, which fails with `Missing expected rejection`.
7. Step 7: Acceptance criteria in `ORIGINAL_REQUEST.md` (R3, Acceptance Criteria: "All tests in the test suite pass with exit code 0 and zero failures or unhandled errors") and `PROJECT.md` (M2: "verify 100% test pass") are not satisfied.

## 3. Caveats

- Port 5050 was previously occupied by an older orphaned `node.exe server.js` background process (PID 7804 started earlier at 11:55:18). This did not affect `npm test` directly because the test suite uses ephemeral ports (`startServer(0)`), but it indicates that previous manual or ungraceful terminations left background processes running.
- Implementation of remaining M2 tests (`server.test.js` covering routes, health, cloaking, error middleware) is still pending worker completion.

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

The test suite fails verification for two critical reasons:
1. `npm test` exits with code 1 due to a failing test in `test/startup.test.js` (`calling startServer(occupiedPort) rejects with EADDRINUSE`).
   - Fix required: In `server.js`, avoid passing the success callback directly to `app.listen(port, cb)` because Express invokes it on `'error'` as well. Instead, attach the success handler to `srv.once('listening', ...)` and the error handler to `srv.once('error', ...)`.
2. Missing test suite coverage for M2 requirements (health check, campaigns API, cloaking routes, error handling).

## 5. Verification Method

To verify:
1. Run `npm test` in the project root:
   ```powershell
   npm test
   ```
2. Expected behavior for approval: Exit code 0, 0 failed tests, all suites passing.
3. Invalidation condition: Exit code is non-zero, or any test fails / hangs.
