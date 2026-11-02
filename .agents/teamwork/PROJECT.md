# Project: my-cloaker Stability & Test Suite

## Architecture
- **Language / Runtime**: Node.js (v18+ / v20+ / v24)
- **Module 1**: `server.js` — Core Express HTTP Cloaking & Gateway Service (Startup, Cloaker Logic, Endpoints, Error Middleware, Lifecycle)
- **Module 2**: `test/` & `package.json` — Automated Test Suite & Test Runner Infrastructure (`node:test` + `node:assert/strict`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Non-blocking Startup | Remove synchronous busy-wait `while (!databaseReady)` loop in `initializeDatabase()`; make initialization fully asynchronous | M1 | Survey Explorer 1 |
| 2 | Resilient Port Binding | Configurable `PORT` from environment, clean error handling for `EADDRINUSE`, robust listen callback | M1 | Survey Explorer 1 |
| 3 | Global Safety Guards | `process.on('uncaughtException')` and `process.on('unhandledRejection')` to prevent sudden silent crashes | M1 | Survey Explorer 1 |
| 4 | Modular Server Export | Export `{ app, server, startServer, stopServer }` so test runners can programmatically start/stop on dynamic ports without auto-listen conflicts | M1 | Survey Explorer 1, 3 |
| 5 | Route Input Validation | Add strict schema validation for `POST /api/campaigns` to reject invalid payloads with 400 Bad Request instead of throwing uncaught `TypeError` | M1 | Survey Explorer 2 |
| 6 | Robust Cloaking Regex & Headers | Safe parsing of `User-Agent`, `Referer`, and IP headers with null/undefined checks and safe bot-matching rules | M1 | Survey Explorer 2 |
| 7 | Health Check Endpoint | Ensure `GET /health` and `GET /api/health` reliably return 200 OK with server uptime, memory, and status | M1 | Survey Explorer 2 |
| 8 | Management & Stats Endpoints | Resilient handlers for `GET /api/campaigns`, `GET /api/stats`, `GET /safe`, `GET /offer` | M1 | Survey Explorer 2 |
| 9 | Express Error Middleware | Add catch-all 404 handler and global Express 500 error handler `app.use((err, req, res, next) => ...)` | M1 | Survey Explorer 2 |
| 10 | Graceful Process Shutdown | Listen for `SIGINT` and `SIGTERM`, invoke `server.close()`, drain active connections, and exit with code 0 | M1 | Survey Explorer 1 |
| 11 | Automated Test Script | Configure `"test": "node --test test/**/*.test.js"` in `package.json` | M2 | Survey Explorer 3 |
| 12 | E2E Test Suite | Comprehensive native test suite covering startup, health, cloaking, API validation, and lifecycle | M2 | Survey Explorer 3 |
| 13 | Adversarial Coverage Hardening | White-box stress testing, edge-case probing, and verification that 100% of tests pass cleanly | M2 | Survey Explorer 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Server Startup & Runtime Stability | Fix all blocking/hanging issues, modular export, route resilience, error handling, and clean shutdown in `server.js` | none | DONE |
| M2 | Automated Test Suite & E2E Verification | Implement `test/` suite (4 suites, 31 tests), configure `package.json` `"test"`, verify 100% test pass | M1 | DONE |

## Code Layout
- `server.js`: Core Express server, cloaking engine, API routes, lifecycle management. (VERIFIED & PASSING)
- `package.json`: Project manifest with `"test": "node --test test/**/*.test.js"`. (VERIFIED & PASSING)
- `test/`: Native `node:test` suite across 4 files (31/31 PASSING):
  - `test/endpoints.test.js`: 13 tests
  - `test/health.test.js`: 5 tests
  - `test/server.test.js`: 8 tests
  - `test/startup.test.js`: 5 tests
