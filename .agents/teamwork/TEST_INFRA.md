# E2E Test Infra: my-cloaker

## Test Philosophy
- Opaque-box, requirement-driven. Derived from ORIGINAL_REQUEST.md.
- Built-in Node.js native test runner (`node:test`) + assertions (`node:assert/strict`). Zero external test dependencies required.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Non-blocking Startup & Port Binding | R1, Acceptance Criteria | 5 | 5 | ✓ |
| 2 | Clean Process Lifecycle (SIGINT/SIGTERM) | R1, Acceptance Criteria | 5 | 5 | ✓ |
| 3 | Core Cloaker Routing (Safe vs Offer) | R2, Survey | 5 | 5 | ✓ |
| 4 | Health & Status Endpoints | R2, Acceptance Criteria | 5 | 5 | ✓ |
| 5 | Campaign Management API | R2, Survey | 5 | 5 | ✓ |
| 6 | Traffic Stats API | R2, Survey | 5 | 5 | ✓ |

## Test Architecture
- Test runner command: `npm test` -> `node --test test/**/*.test.js`
- Test files location: `c:\Users\mouni\Desktop\my-cloaker\test\`
  - `test/startup.test.js`: Server startup, non-blocking behavior, dynamic port binding, process exit.
  - `test/health.test.js`: Health status (`/health`, `/api/health`, `/api/stats`).
  - `test/cloaker.test.js`: Bot vs human User-Agent filtering, IP headers, redirection targets.
  - `test/campaigns.test.js`: Campaign API CRUD, input validation, missing field handling (400 responses).
  - `test/lifecycle.test.js`: Graceful termination, signal handling, socket release.

## Coverage Thresholds
- Tier 1: >=5 test cases per feature (happy path isolation).
- Tier 2: >=5 test cases per feature (boundaries, invalid inputs, edge cases).
- Tier 3: pairwise combinations of bot/human headers and route combinations.
- Tier 4: realistic full-stack workload scenario (multi-client simultaneous requests, campaign updates during traffic).
