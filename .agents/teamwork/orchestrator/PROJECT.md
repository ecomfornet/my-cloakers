# Project: my-cloaker Stability & Test Suite

## Architecture
- **Language / Runtime**: Node.js (v18+ / v20+)
- **Core Server**: `server.js` (Express-based HTTP Cloaking & Gateway Service)
- **Data Stores**: In-memory mock and local JSON persistence (`dashboard-campaigns.json`)
- **Testing Track**: Native Node.js test runner (`node:test` + `node:assert/strict`) configured via `npm test`
- **Data Flow**:
  1. Incoming Request -> User-Agent & Header Inspection -> Cloaker Decision Engine -> Redirect to Safe or Offer Page
  2. Management API -> Validation Middleware -> Campaign / Stats Handler -> JSON Response
  3. System Signals (SIGINT, SIGTERM) -> Graceful Termination Handler -> Close Server -> Exit 0

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Non-blocking Startup | Remove synchronous busy-wait `while (!databaseReady)` loop in `initializeDatabase()`; make initialization fully asynchronous | M1 | Survey Explorer 1 |
| 2 | Resilient Port Binding | Configurable `PORT` from environment, clean error handling for `EADDRINUSE`, robust listen callback | M1 | Survey Explorer 1 |
| 3 | Global Safety Guards | `process.on('uncaughtException')` and `process.on('unhandledRejection')` to prevent sudden silent crashes | M1 | Survey Explorer 1 |
| 4 | Modular Server Export | Export `{ app, server, startServer, stopServer }` so test runners can programmatically start/stop on dynamic ports without auto-listen conflicts | M1 | Survey Explorer 1, 3 |
| 5 | Route Input Validation | Add strict schema validation for `POST /api/campaigns` to reject invalid payloads with 400 Bad Request instead of throwing uncaught `TypeError` | M2 | Survey Explorer 2 |
| 6 | Robust Cloaking Regex & Headers | Safe parsing of `User-Agent`, `Referer`, and IP headers with null/undefined checks and safe bot-matching rules | M2 | Survey Explorer 2 |
| 7 | Health Check Endpoint | Ensure `GET /health` and `GET /api/health` reliably return 200 OK with server uptime, memory, and status | M2 | Survey Explorer 2 |
| 8 | Management & Stats Endpoints | Resilient handlers for `GET /api/campaigns`, `GET /api/stats`, `GET /safe`, `GET /offer` | M2 | Survey Explorer 2 |
| 9 | Express Error Middleware | Add catch-all 404 handler and global Express 500 error handler `app.use((err, req, res, next) => ...)` | M2 | Survey Explorer 2 |
| 10 | Graceful Process Shutdown | Listen for `SIGINT` and `SIGTERM`, invoke `server.close()`, drain active connections, and exit with code 0 | M3 | Survey Explorer 1 |
| 11 | Automated Test Script | Configure `"test": "node --test test/**/*.test.js"` in `package.json` | M4 | Survey Explorer 3 |
| 12 | E2E Test Suite (Tiers 1-4) | Comprehensive native test suite covering startup, health, cloaking, API validation, and lifecycle | M4 | Survey Explorer 3 |
| 13 | Adversarial Coverage Hardening | White-box stress testing, edge-case probing, and verification that 100% of tests pass cleanly | M4 | Survey Explorer 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Startup & Event Loop Stability | Non-blocking startup, unblocked event loop, modular exports, global error safety | none | PLANNED |
| M2 | Route Resilience & Input Validation | Campaign POST validation, safe regex, robust health & stats endpoints, Express error middleware | M1 | PLANNED |
| M3 | Clean Process Lifecycle & Termination | Signal handling (SIGINT/SIGTERM), graceful server close, socket cleanup | M1, M2 | PLANNED |
| M4 | Automated Test Suite & E2E Verification | Package.json test script, full test suite (Tiers 1-4), 100% test pass, adversarial hardening | M1, M2, M3 | PLANNED |

## Interface Contracts
### Modular Server Interface (`server.js`)
- `startServer(port?: number): Promise<http.Server>`: Starts the HTTP server on specified port (or process.env.PORT || 3000). Resolves when listening.
- `stopServer(): Promise<void>`: Gracefully stops the HTTP server and resolves when closed.
- `app`: Express application instance.
- Direct execution (`require.main === module`): Automatically calls `startServer()`.

### Campaign API Contract (`POST /api/campaigns`)
- Request Body: `{ name: string, safeUrl: string, moneyUrl: string, status?: string }`
- Valid: 200 or 201 JSON response with campaign record.
- Missing required fields: 400 Bad Request with `{ error: string }`.

### Health Check Contract (`GET /health` & `GET /api/health`)
- Response: 200 OK `{ status: "ok" | "healthy", uptime: number, timestamp: string }`.

## Code Layout
- `server.js`: Core Express server, cloaking engine, API routes, lifecycle management.
- `package.json`: Project manifest, start/test scripts.
- `test/`:
  - `test/startup.test.js`: Verifies non-blocking startup and port binding.
  - `test/health.test.js`: Verifies health and stats endpoints.
  - `test/cloaker.test.js`: Verifies cloaker bot vs human routing, header edge cases.
  - `test/campaigns.test.js`: Verifies campaign API CRUD and input validation.
  - `test/lifecycle.test.js`: Verifies graceful shutdown and signal handling.
