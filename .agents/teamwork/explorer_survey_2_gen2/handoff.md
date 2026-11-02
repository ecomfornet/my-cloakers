# Server.js Comprehensive Codebase Survey & Crash Vector Investigation

## 1. Observation

Inspection of `c:\Users\mouni\Desktop\my-cloaker\server.js` (1288 lines) and related project files (`package.json`, `start-dashboard.bat`, `dashboard-campaigns.json`) reveals the following concrete architecture, endpoints, business logic, and stability vectors.

### 1.1 Middleware & Static Asset Handlers
- **Line 9**: JSON body parsing middleware:
  ```javascript
  app.use(express.json());
  ```
- **Line 10**: Static asset middleware serving `./public`:
  ```javascript
  app.use(express.static(path.join(__dirname, 'public')));
  ```
- **Lines 658–662**: Static favicon handler:
  ```javascript
  app.get('/favicon.ico', (req, res) => {
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#10b981"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="white" font-family="sans-serif">C</text></svg>');
  });
  ```

---

### 1.2 Enumeration of All Routes & Endpoints

| # | HTTP Method | Path | Line Numbers | Handler Signature | Has Try/Catch | Summary |
|---|-------------|------|--------------|-------------------|---------------|---------|
| 1 | `GET` | `/favicon.ico` | 658–662 | `(req, res) =>` | No | Serves inline SVG icon with 24h cache |
| 2 | `GET` | `/api/config` | 665–667 | `(req, res) =>` | No | Returns dashboard config and defaults |
| 3 | `POST` | `/api/config` | 670–684 | `(req, res) =>` | No | Updates and writes config to disk |
| 4 | `POST` | `/api/verify-cf` | 760–771 | `async (req, res) =>` | Partial (internal in helper) | Verifies Cloudflare API token/account |
| 5 | `GET` | `/api/zones` | 774–812 | `async (req, res) =>` | Yes | Fetches zones from Cloudflare API |
| 6 | `POST` | `/api/generate` | 815–852 | `(req, res) =>` | Yes | Generates Worker code & robots.txt preview |
| 7 | `POST` | `/api/deploy` | 855–1065 | `async (req, res) =>` | Yes | Deploys Worker script & routes to CF |
| 8 | `GET` | `/api/analytics/posts` | 1068–1154 | `async (req, res) =>` | Yes | Queries 24h visit stats from CF D1 DB |
| 9 | `POST` | `/api/analytics/simulate`| 1157–1210 | `async (req, res) =>` | Yes | Simulates visits into D1 DB |
| 10 | `POST` | `/api/analytics/reset` | 1213–1244 | `async (req, res) =>` | Yes | Truncates D1 analytics table |
| 11 | `GET` | `/api/campaigns` | 1247–1249 | `(req, res) =>` | No | Lists campaigns from disk |
| 12 | `DELETE`| `/api/campaigns/:id` | 1252–1262 | `async (req, res) =>` | Yes | Deletes campaign from campaign array |

---

### 1.3 Core Business Logic

#### A. Cloaking Rules & Activation Modes
The server generates Cloudflare Worker scripts (`buildWorkerCode`, lines 134–624) operating under two selectable activation methods:
1. **Method 1: Human Verification Trigger Condition (`trigger`)** (lines 139, 163, 528–585):
   - Redirection is triggered by client-side human interaction: either `scroll` (exceeding `scrollPct`, default 15%), `click` (trusted click/tap), or `both`.
   - Bypasses bots completely; only executes in browser when trusted human input is detected.
2. **Method 2: 24-Hour Unique Human Visitor Threshold Engine (`visitor_threshold`)** (lines 137, 160, 269–326):
   - Edge gatekeeper powered by Cloudflare D1 database (`url_human_visits` table).
   - Counts unique human visitors per URL slug over a rolling 24-hour window (`COUNT(*) as cnt ... WHERE post_path = ?1 AND visited_at >= datetime('now', '-24 hours')`, lines 303–305).
   - If 24h human visits are below `thresholdCount` (default 4), the worker serves clean origin HTML with no redirection scripts and `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` (lines 316–325).
   - Once threshold is met, the worker fetches origin HTML and injects client redirection script via `HTMLRewriter` (lines 591–609).

#### B. Bot & Crawler Detection Hierarchy
1. **Worker-Level User-Agent Regex Filter (`isBot(ua)`, lines 166–194)**:
   - Line 167: Blocks UA shorter than 15 characters (`!ua || ua.length < 15`).
   - Lines 169–171: Pinterest crawlers (`/Pinterestbot/i` or `Pinterest/` + `bot.html`).
   - Lines 173–175: Headless browsers (`/headlesschrome|puppeteer|playwright|selenium|phantomjs|cypress|webdriver/i`).
   - Lines 177–179: Major search bots (`googlebot|google-inspectiontool|mediapartners-google|storebot-google|bingbot|bingpreview|msnbot|yandexbot|baiduspider|duckduckbot`).
   - Lines 181–183: Social/messaging bots (`facebookexternalhit|facebot|meta-externalagent|twitterbot|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|bytespider`).
   - Lines 185–187: HTTP client libraries (`curl|wget|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|postman`).
   - Lines 189–191: Generic crawler terms (`bot\b|crawler|spider|scraper|preview|archiver`).
2. **Dynamic Robots.txt & Path Filtering** (lines 214–250):
   - Intercepts `/robots.txt` (lines 214–243) explicitly directing crawlers to sitemaps and disallowing `/themes/`, `/wp-admin/`, `/search/`.
   - Hard 403 block on `/themes/` for any bot (lines 246–250).
   - Static assets bypass regex (lines 255–257): passes `.(jpg|jpeg|png|gif|webp|svg|css|js|woff|woff2|ttf|eot|ico|json|xml)$` directly to origin.
3. **In-Browser Automation Detection (`scanAutomation()`, lines 350–411)**:
   - Checks `navigator.webdriver === true`.
   - Checks headless desktop zero-dimension screen (`outerWidth === 0 && outerHeight === 0 && screen.width === 0`).
   - Examines call stack for test harnesses (`(new Error()).stack` containing `UtilityScript`, `playwright`, `puppeteer`, `evaluate (`).
   - Global automation variables: `window.__playwright`, `window.playwright`, `window.__puppeteer_evaluation_script__`, `window.__selenium_evaluate`, `window._phantom`, `window.__nightmare`, `window.domAutomation`.
   - DOM flags: `documentElement.getAttribute("webdriver")` or `"selenium"`.
   - Zero languages: `!navigator.languages || navigator.languages.length === 0`.
   - Trusted Event Verification: All event listeners check `e.isTrusted` (lines 425, 438, 472, 479, 485, 491, 503, 519, 534). Programmatic/synthetic clicks are ignored.

#### C. Safe vs. Money Redirection Logic
- **Safe Experience (Origin HTML)**:
  - If request is a bot (`isBot(ua)`), worker proxies directly to origin (line 261).
  - Under `visitor_threshold`, if visit count < `thresholdCount`, origin HTML is returned directly without any script injected (lines 316–325).
  - If browser automation is detected, `scanAutomation()` flags `botDetected = true` and `triggerRedirect` aborts (lines 446–450).
- **Money Experience (Target Domain Redirection)**:
  - Non-HTML responses redirect via HTTP 302: `Response.redirect(dest, 302)` (line 336).
  - HTML responses: `HTMLRewriter` prepends client script to `<head>` or `<body>` (lines 591–609).
  - Target URL format: `https://${TARGET_HOST}${postPath}${url.search}` (line 333).
  - Redirect triggers via `window.location.replace(target)` with fallback to `window.location.href = target` (lines 454–457).

#### D. Campaign Management Logic
- Storage file: `CAMPAIGNS_FILE = path.join(__dirname, 'dashboard-campaigns.json')` (line 13).
- Seeded with default record if file does not exist (lines 111–125).
- CRUD operations:
  - Read: `GET /api/campaigns` (lines 1247–1249) calls `loadCampaigns()`.
  - Delete: `DELETE /api/campaigns/:id` (lines 1252–1262) filters by `id` and calls `saveCampaigns()`.
  - Create/Update: `POST /api/deploy` (lines 855–1065) creates Cloudflare worker, attaches routes, and updates `dashboard-campaigns.json`.

---

### 1.4 Health Check Endpoint Status
- **Direct Observation**:
  - `server.js` contains **NO health check endpoint**.
  - Grep and manual audit of lines 1–1288 show zero occurrences of `app.get('/health')`, `app.get('/api/health')`, `app.get('/status')`, or `app.get('/ping')`.
  - An HTTP `GET /health` or `GET /api/health` request results in `404 Not Found`.
- **Startup Background Pre-Verification** (lines 1270–1277):
  ```javascript
  verifyCloudflare().then(res => {
    if (res.success) {
      console.log(`[Cloudflare] Pre-verified: ${res.account?.name} (${res.zonesCount} zones)`);
    } else {
      console.log(`[Cloudflare] Pre-verify notice: ${res.message}`);
    }
  }).catch(() => {});
  ```
  This logs verification results to console on startup, but does not expose any HTTP endpoint for health probes.

---

### 1.5 Runtime Crash Vectors & Instability Points

1. **Missing Try/Catch & Potential Unhandled Exceptions in Routes**:
   - `POST /api/config` (lines 670–684):
     - Handler is completely devoid of `try/catch`.
     - `const { apiToken, ... } = req.body;` at line 671 throws `TypeError: Cannot destructure property 'apiToken' of 'req.body' as it is undefined/null.` if `req.body` is missing or invalid.
     - Calls `saveConfig(cfg)` (line 101) which executes `fs.writeFileSync(...)` synchronously. Any file write failure (EPERM, EBUSY, ENOSPC) crashes the handler unhandled.
   - `POST /api/verify-cf` (lines 760–771):
     - Handler is `async (req, res)` without an outer `try/catch`.
     - Destructuring `const { apiToken, accountId, forceRefresh } = req.body;` at line 761 fails if `req.body` is null/undefined.
   - `GET /api/campaigns` (lines 1247–1249):
     - Synchronous handler without `try/catch`.
2. **Missing Input Validation**:
   - `POST /api/analytics/simulate` (lines 1157–1210):
     - Direct string concatenation into raw SQL queries without parameterization:
       ```javascript
       statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${postPath}', '${randHash}', datetime('now'), '${country}');`);
       ```
       (Line 1173). If `postPath` contains single quotes (`'`) or SQL meta-characters, the query breaks or triggers SQL injection in Cloudflare D1.
   - `POST /api/generate` (lines 817–830) & `POST /api/deploy` (lines 863–887):
     - `sourceDomain` and `targetDomain` are only checked for truthiness. If passed as numbers or non-strings, `.replace()` throws `TypeError: sourceDomain.replace is not a function`.
     - In `POST /api/deploy` (lines 980, 991): `existingRoutes.find(...)` throws `TypeError` if `routesData.result` is not an Array.
     - In `POST /api/deploy` (line 1031) and `DELETE /api/campaigns/:id` (line 1257): assumes `campaigns` is an Array. If `dashboard-campaigns.json` is modified to an object `{}` or primitive, `.findIndex` and `.filter` throw unhandled TypeErrors.
3. **Synchronous Blocking File I/O on Event Loop**:
   - Lines 32, 48, 86, 102, 108, 129:
     - `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync` are called synchronously on request paths (`/api/config`, `/api/campaigns`, `/api/deploy`, `/api/zones`, `/api/analytics/*`).
     - On Windows, anti-virus locks or concurrent writes can throw `EBUSY` or `EPERM`.
4. **Hanging Process on Port Conflict (`EADDRINUSE`)**:
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
     When port 5050 is in use, the error is logged, but `process.exit(1)` is **NOT called**. The process remains running as an orphaned, hung process that never listens to requests.
5. **Missing Process Termination Signals & Graceful Shutdown**:
   - No handlers for `SIGINT`, `SIGTERM`, or process cleanup.
   - When stopped by tests or process managers, open sockets and background `child_process.exec` calls are abruptly severed or orphaned.
6. **Unhandled Child Process Timeouts / Failures**:
   - `_asyncRefreshWranglerToken()` (line 26) and `getWranglerDefaultsFresh()` (line 75) run `exec('npx wrangler whoami', { timeout: 25000 })`.
   - On machines without `wrangler` or with network issues, calls block for 25 seconds before timing out.
7. **Missing Global JSON Parsing Error Middleware**:
   - If a client sends malformed JSON to any POST route, `express.json()` throws a `SyntaxError`.
   - Because no error middleware `app.use((err, req, res, next) => ...)` exists, Express sends default HTML 400 stack trace responses instead of clean JSON errors.

---

## 2. Logic Chain

1. **Observation**: `server.js` starts with `app.listen(PORT, ...)` at line 1264, and the only error handler is `server.on('error', ...)` at line 1280.
   - **Reasoning**: If `PORT` (5050) is taken, `server.on('error')` logs a message but fails to call `process.exit()`. This directly explains the user's reported symptom: "server hanging, blocking, and instability issues". Any automated test or startup script that launches `node server.js` will hang indefinitely if port 5050 is occupied or if the process does not terminate cleanly.
2. **Observation**: In `package.json`, `scripts` has `"start"`, `"dashboard"`, `"deploy"`, but NO `"test"` script.
   - **Reasoning**: Automated verification is currently impossible without adding a test runner (e.g. Node built-in `node --test` or `jest`/`mocha`) and configuring `"test"` in `package.json`.
3. **Observation**: No route exists for `/health` or `/api/health`.
   - **Reasoning**: Monitoring agents and automated health checkers have no endpoint to probe for liveness and readiness without triggering 404s. Adding `GET /health` and `GET /api/health` is essential for production stability and test suites.
4. **Observation**: `app.post('/api/config')` (line 670) and `app.get('/api/campaigns')` (line 1247) have no `try/catch`, while `app.post('/api/verify-cf')` (line 760) is an `async` function without a top-level `try/catch`.
   - **Reasoning**: In Express, unhandled synchronous exceptions or unhandled async rejections that aren't trapped by custom error-handling middleware cause crashes or render raw HTML error dumps, exposing the server to denial of service from malformed payloads.
5. **Observation**: `POST /api/analytics/simulate` (lines 1157–1210) builds SQL strings by template literal interpolation: `VALUES ('${postPath}', ...)`.
   - **Reasoning**: Any unescaped single quote or malicious string in `postPath` results in SQLite syntax errors in D1 or SQL injection. Input validation and sanitization are necessary.
6. **Observation**: `dashboard-config.json` does not exist on disk, while `dashboard-campaigns.json` exists.
   - **Reasoning**: When `loadConfig()` runs, it falls back to hardcoded defaults (line 82–99). If `saveConfig()` is called, it writes synchronously. Any file lock or permission issue can break the server.

---

## 3. Caveats

1. **Cloudflare Live API & D1 Authentication**:
   - The server relies on external Cloudflare REST API endpoints (`https://api.cloudflare.com/client/v4/...`) and local Wrangler CLI oauth tokens stored in `APPDATA/xdg.config/.wrangler/config/default.toml`.
   - Without active internet access or valid Cloudflare credentials, live deployment (`/api/deploy`) and live D1 queries (`/api/analytics/posts`) will return HTTP 400 error responses from Cloudflare. Automated test suites should mock or stub external Cloudflare network calls.
2. **Read-Only Investigation Constraint**:
   - As an explorer, no modifications were made to `server.js` or `package.json`. All proposed fixes are documented for implementation by the builder/implementer agent.

---

## 4. Conclusion

`server.js` provides a functional Express-based Cloaker dashboard and Cloudflare Worker generator, but suffers from several critical operational defects:
1. **Startup Hang Vector**: When port 5050 is occupied, the server logs an error but does not exit, hanging processes in CI/CD and scripts.
2. **Missing Health Check Endpoint**: Probes to `/health` return 404, preventing container orchestrators and automated tests from verifying service vitality.
3. **Fragile Route Error Handling**: Missing `try/catch` on `POST /api/config` and `GET /api/campaigns`, missing top-level error handling on `POST /api/verify-cf`, and lack of global Express error middleware (`(err, req, res, next)`).
4. **SQL Injection / String Interpolation**: Unsanitized parameters in `POST /api/analytics/simulate`.
5. **No Test Suite**: Zero automated tests configured in `package.json`.

---

## 5. Verification Method

### How to Independently Verify:
1. **Inspect Route Definitions & Handlers**:
   - Run `grep_search` with Query `app.get` and `app.post` across `server.js` to verify every route line number cited in Section 1.2.
2. **Verify Lack of Health Check**:
   - Search for `/health` in `server.js`:
     ```powershell
     Select-String -Path "server.js" -Pattern "/health"
     ```
     Result: No matches found.
3. **Verify Port Conflict Behavior**:
   - Start an instance of `node server.js` on port 5050, then in a second terminal execute `node server.js`.
   - Observe that the second instance prints the error message but does not terminate (exit code 1 is never triggered).
4. **Test Suite Verification**:
   - Once automated tests are implemented (e.g. `node --test` or `npm test`), verify that all endpoints respond as expected and health checks return HTTP 200 with JSON payload.
