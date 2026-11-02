# Survey & Architecture Analysis Handoff Report — Explorer Survey 2

## 1. Observation

### 1.1 Architecture & Middleware Stack
Directly observed in `c:\Users\mouni\Desktop\my-cloaker\server.js`:
- **Line 6-10**:
  ```javascript
  const app = express();
  const PORT = process.env.PORT || 5050;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  ```
- **Line 12-16**:
  ```javascript
  const CONFIG_FILE = path.join(__dirname, 'dashboard-config.json');
  const CAMPAIGNS_FILE = path.join(__dirname, 'dashboard-campaigns.json');
  const DEFAULT_D1_DATABASE_ID = '7db29aa9-bd12-410d-a982-1600c940a14f';
  ```
- **Missing Global Handlers**:
  - No `express.urlencoded()` parser mounted.
  - No global error-handling middleware (`app.use((err, req, res, next) => ...)`).
  - No CORS middleware.
  - No `process.on('SIGINT')`, `process.on('SIGTERM')`, `process.on('unhandledRejection')`, or `process.on('uncaughtException')`.
  - No `module.exports = app;` or `module.exports = { app, server };` — `app.listen(PORT)` is unconditionally called at line 1264.

### 1.2 Route & Endpoint Inventory
Enumeration of all routes handled by `server.js`:

| Method | Path | Line | Parser / Body / Params | Handler Type | Status Codes | Description |
|---|---|---|---|---|---|---|
| `GET` | `/favicon.ico` | 658 | None | Sync `(req, res)` | 200 | Serves embedded SVG favicon (`image/svg+xml`) |
| `GET` | `/api/config` | 665 | None | Sync `(req, res)` | 200 | Returns loaded configuration object from memory / `dashboard-config.json` |
| `POST` | `/api/config` | 670 | `req.body`: `{ apiToken, accountId, d1DatabaseId, activationMethod, defaultScrollPct, defaultTrigger, thresholdCount, autoCreateWww }` | Sync `(req, res)` | 200 | Saves configuration to `dashboard-config.json` via sync `fs.writeFileSync` |
| `POST` | `/api/verify-cf` | 760 | `req.body`: `{ apiToken, accountId, forceRefresh }` | Async `(req, res)` | 200, 400 | Verifies Cloudflare API token against `/client/v4/accounts` & counts zones (cached 2 min) |
| `GET` | `/api/zones` | 774 | Query: `req.query.token` | Async `(req, res)` | 200, 400, 500 | Fetches list of Cloudflare zones (`/client/v4/zones?per_page=50`) |
| `POST` | `/api/generate` | 815 | `req.body`: `{ sourceDomain, targetDomain, activationMethod, scrollPct, triggerCondition, thresholdCount, sitemaps, blockThemes }` | Sync `(req, res)` | 200, 400, 500 | Generates Worker JavaScript source code and `robots.txt` text preview |
| `POST` | `/api/deploy` | 855 | `req.body`: `{ sourceDomain, targetDomain, workerName, activationMethod, scrollPct, triggerCondition, thresholdCount, apiToken, accountId, includeWww, sitemaps }` | Async `(req, res)` | 200, 400, 500 | Compiles worker, uploads script with D1 binding, resolves zone, updates/creates routes, saves to campaigns history |
| `GET` | `/api/analytics/posts` | 1068 | None | Async `(req, res)` | 200, 400, 500 | Queries Cloudflare D1 SQL for rolling 24-hour unique human visits aggregated by slug |
| `POST` | `/api/analytics/simulate` | 1157 | `req.body`: `{ postPath, count, country }` | Async `(req, res)` | 200, 400, 500 | Inserts simulated human visit records into Cloudflare D1 database |
| `POST` | `/api/analytics/reset` | 1213 | None | Async `(req, res)` | 200, 500 | Clears `url_human_visits` table in Cloudflare D1 |
| `GET` | `/api/campaigns` | 1247 | None | Sync `(req, res)` | 200 | Retrieves active campaign history from `dashboard-campaigns.json` |
| `DELETE` | `/api/campaigns/:id` | 1252 | Route param: `req.params.id` | Async `(req, res)` (sync body) | 200, 500 | Removes campaign record with matching ID from `dashboard-campaigns.json` |
| `STATIC` | `/*` | 10 | Static directory `public/` | Express static | 200, 304, 404 | Serves single-page application dashboard `public/index.html` |

### 1.3 Core Cloaking & Filtering Logic
Directly observed in `buildWorkerCode` (lines 134–625):
1. **Activation Methods**:
   - **Method 1 (`activationMethod === 'trigger'`)**:
     - Client-side human verification script injected into `<head>` or `<body>` via `HTMLRewriter`.
     - Triggers redirect to `https://${TARGET_HOST}${postPath}${url.search}` upon trusted human interaction:
       - `click`: `click` or `touchend` where `e && e.isTrusted` is true.
       - `scroll`: physical human scroll past `SCROLL_PCT` (default: 0.15 / 15%). Tracks `mousemove`, `pointerdown`, `pointermove`, `touchstart`, `touchmove`, `keydown`, `wheel` to set `humanActive = true`.
       - `both`: Either trusted click or qualifying scroll.
   - **Method 2 (`activationMethod === 'visitor_threshold'`)**:
     - Server-side rolling 24-hour gatekeeper backed by Cloudflare D1 (`url_human_visits`).
     - Non-bot visitors are fingerprinted: `visitorId = cookieHeader.match(/cf_uv_id=([^;]+)/)` or `clientIp + "::" + ua`.
     - Hashes `rawId = visitorId + "::cloaker-salt"` with SHA-256 (32 hex characters).
     - Inserts visit record: `INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES (?1, ?2, datetime('now'), ?3)`.
     - Queries rolling 24-hour count: `SELECT COUNT(*) as cnt FROM url_human_visits WHERE post_path = ?1 AND visited_at >= datetime('now', '-24 hours')`.
     - Gatekeeper rule:
       - If `uniqueHumanCount24h < THRESHOLD_COUNT` (e.g. < 4): Serves clean WordPress article HTML with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` (Zero redirection scripts).
       - If `uniqueHumanCount24h >= THRESHOLD_COUNT`: Unlocks gatekeeper, injects client-side anti-automation verification, instantly redirects on any trusted human event.
     - Daily cron handler: `DELETE FROM url_human_visits WHERE visited_at < datetime('now', '-48 hours')`.
2. **Bot Detection & Traffic Filtering**:
   - `isBot(ua)` User-Agent filtering:
     - Rejects `ua.length < 15`.
     - Crawlers: Pinterestbot, Googlebot, Google-InspectionTool, Bingbot, Yandexbot, Baiduspider, DuckDuckBot.
     - Headless / Emulators: HeadlessChrome, Puppeteer, Playwright, Selenium, PhantomJS, Cypress, Webdriver.
     - Social & Messenger bots: FacebookExternalHit, Facebot, Meta-ExternalAgent, Twitterbot, LinkedInbot, Slackbot, Telegrambot, WhatsApp, Discordbot, Applebot, Bytespider.
     - HTTP CLI libraries: `curl/`, `wget/`, `python-requests`, `aiohttp`, `scrapy`, `node-fetch`, `axios`, `go-http-client`, `urllib`, `postman`.
   - Client-side in-page automation scan:
     - Checks `navigator.webdriver === true`.
     - Non-touch headless desktop: `outerWidth === 0 && outerHeight === 0 && screen.width === 0`.
     - Execution stack inspection: flags `UtilityScript`, `playwright`, `puppeteer`, `evaluate (:`.
     - Automation globals: `__playwright`, `__puppeteer_evaluation_script__`, `__selenium_evaluate`, `_phantom`, `callPhantom`, `__nightmare`, `domAutomation`.
     - User-agent `HeadlessChrome`, missing `navigator.languages`.
   - Asset & Non-GET Bypasses:
     - Method `!= "GET"` bypasses directly to origin.
     - Static assets (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.css`, `.js`, `.woff`, `.woff2`, `.ttf`, `.eot`, `.ico`, `.json`, `.xml`) bypass directly to origin.
     - Route `/robots.txt` dynamically disallows `/themes/`, `/wp-admin/`, `/search/` while allowing Pinterestbot and search crawlers.
     - Route `/themes/` blocked with HTTP 403 Forbidden for bots if `blockThemes: true`.

### 1.4 Observed Fragile Patterns, Bugs & Live Errors
Direct verification in the current environment:

1. **Port In-Use (EADDRINUSE) & Hanging Process**:
   - Command: `netstat -ano | findstr :5050`
   - Output: `TCP 0.0.0.0:5050 LISTENING PID 7804`, with socket in `CLOSE_WAIT` and `FIN_WAIT_2`.
   - Command: `powershell -Command "Get-CimInstance Win32_Process -Filter 'ProcessId = 7804' | Select-Object ProcessId, CommandLine"`
   - Output: `7804 "C:\Program Files\nodejs\node.exe" server.js`.
   - In `server.js` (lines 1280-1287):
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
     `server.on('error')` logs the error but does NOT call `process.exit(1)`. The process hangs indefinitely.
   - Workaround script `start-dashboard.bat` relies on `taskkill /F /PID ... 2>nul` instead of fixing server socket termination.

2. **Unhandled TypeError (500 Error) on Missing / Non-JSON Body**:
   - Command: `curl.exe -i -X POST http://localhost:5050/api/config -H "Content-Type: text/plain" -d "not-json"`
   - Verbatim response:
     ```html
     HTTP/1.1 500 Internal Server Error
     Content-Type: text/html; charset=utf-8
     ...
     <pre>TypeError: Cannot destructure property &#39;apiToken&#39; of &#39;req.body&#39; as it is undefined.<br> &nbsp; &nbsp;at C:\Users\mouni\Desktop\my-cloaker\server.js:671:11</pre>
     ```
   - Affected endpoints:
     - `POST /api/config` (line 671): `const { ... } = req.body;`
     - `POST /api/verify-cf` (line 761): `const { ... } = req.body;`
     - `POST /api/generate` (line 817): `const { ... } = req.body;`
     - `POST /api/deploy` (line 862): `const { ... } = req.body;`
     - `POST /api/analytics/simulate` (line 1158): `const { ... } = req.body;` (placed outside `try/catch`).

3. **Unhandled SyntaxError HTML Leak on Malformed JSON**:
   - Command: `curl.exe -i -X POST http://localhost:5050/api/config -H "Content-Type: application/json" -d "{"`
   - Verbatim response:
     ```html
     HTTP/1.1 400 Bad Request
     Content-Type: text/html; charset=utf-8

     <pre>SyntaxError: Expected property name or &#39;}&#39; in JSON at position 1 (line 1 column 2)...</pre>
     ```
   - No JSON error middleware catches `SyntaxError` from `express.json()`.

4. **Synchronous Blocking File I/O on Event Loop**:
   - `fs.readFileSync(CONFIG_FILE, 'utf8')` (line 86)
   - `fs.writeFileSync(CONFIG_FILE, ...)` (line 102) without try-catch
   - `fs.readFileSync(CAMPAIGNS_FILE, 'utf8')` (line 108)
   - `fs.writeFileSync(CAMPAIGNS_FILE, ...)` (line 129) without try-catch
   - `fs.readFileSync(configPath, 'utf8')` (lines 32, 48)

5. **25-Second Blocking Child Process on Token Refresh**:
   - `exec('npx wrangler whoami', { timeout: 25000 }, ...)` (lines 26, 75)
   - In `getWranglerDefaultsFresh()`, the route handler awaits the 25-second `npx wrangler whoami` process.

6. **Missing Fetch Timeouts**:
   - `fetch('https://api.cloudflare.com/client/v4/zones?per_page=50')` (line 782) has NO timeout.
   - `fetch(...)` calls in `/api/deploy` (lines 930, 961, 976, 994, 1011) have NO timeout.
   - `fetch(...)` calls in `/api/analytics/posts` (line 1091), `/api/analytics/simulate` (line 1176), and `/api/analytics/reset` (line 1220) have NO timeout.

7. **SQL Injection Vulnerability in `/api/analytics/simulate`**:
   - Line 1173:
     ```javascript
     statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${postPath}', '${randHash}', datetime('now'), '${country}');`);
     ```
     `postPath` and `country` are directly concatenated into the SQL statement without escaping or parameterized queries.

8. **Missing Module Exports for Testability**:
   - `server.js` does NOT export `app` or `server` via `module.exports`.
   - `app.listen(PORT)` is executed immediately on import, making unit/integration tests with tools like Supertest trigger port binding conflicts.

---

## 2. Logic Chain

1. **Premise 1**: `server.js` mounts only `express.json()` at line 9. When an incoming HTTP request lacks `Content-Type: application/json` or contains non-JSON content, `req.body` is initialized as `undefined`.
   - **Inference 1**: Any route handler that executes `const { ... } = req.body;` without guarding for `req.body || {}` triggers a synchronous `TypeError`.
   - **Verification**: Executed `curl.exe` with `Content-Type: text/plain` on `/api/config`, `/api/verify-cf`, `/api/generate`, `/api/deploy`, and `/api/analytics/simulate`. Each endpoint threw `TypeError: Cannot destructure property ... of 'req.body' as it is undefined`, returning HTTP 500.

2. **Premise 2**: `server.js` does not register a custom Express error middleware (`app.use((err, req, res, next) => ...)`).
   - **Inference 2**: When `express.json()` encounters malformed JSON (e.g. `{`), it throws a `SyntaxError`. Express delegates to its default HTML error handler, returning an HTML response containing server internal paths and stack traces rather than a structured JSON error response.
   - **Verification**: Confirmed via `curl.exe -X POST ... -d "{"`, which returned `HTTP/1.1 400 Bad Request` with `Content-Type: text/html` and stack trace.

3. **Premise 3**: `server.on('error', (err) => ...)` catches `EADDRINUSE` but does not invoke `process.exit(1)` or clean up hanging sockets.
   - **Inference 3**: If port 5050 is already bound, starting `node server.js` logs an error message and keeps the Node process alive indefinitely in a hung state because background promises (`verifyCloudflare().then(...)`) and event loop handles remain open.
   - **Verification**: `netstat -ano` showed an existing orphaned `node.exe` (PID 7804) holding port 5050 with sockets in `CLOSE_WAIT`/`FIN_WAIT_2`. `start-dashboard.bat` contains a defensive `taskkill /F` precisely to compensate for this design defect.

4. **Premise 4**: `server.js` lacks `process.on('SIGINT')` and `process.on('SIGTERM')` handlers, and lacks `server.close()` export.
   - **Inference 4**: Terminating the server process does not allow open TCP connections to drain cleanly, leaving sockets lingering in `TIME_WAIT`/`CLOSE_WAIT` and leaving spawned `npx wrangler whoami` child processes orphaned.
   - **Verification**: Sockets in `CLOSE_WAIT` were confirmed on port 5050.

5. **Premise 5**: `fs.readFileSync` and `fs.writeFileSync` are used synchronously in request handlers (`loadConfig`, `saveConfig`, `loadCampaigns`, `saveCampaigns`).
   - **Inference 5**: Disk operations block the single Node event loop thread. If file permissions or disk write errors occur in `saveConfig` or `saveCampaigns`, an uncaught synchronous exception is thrown.
   - **Verification**: Inspected lines 86, 102, 108, 129 in `server.js`. Neither `saveConfig` nor `saveCampaigns` wraps `fs.writeFileSync` in try/catch.

---

## 3. Caveats

1. **Active Cloudflare Credentials**: The current machine contains live Cloudflare credentials and an active D1 database (`url_human_visits` table with >2,300 live records). Production modifications must ensure real Cloudflare resources are protected and not inadvertently overwritten or deleted (specifically `/api/analytics/reset`).
2. **Dual-Execution Mode Assumption**: For automated tests to run cleanly alongside production, `server.js` needs to support both standalone CLI execution (`node server.js`) and modular export (`module.exports = { app, server }` or exporting `app` and starting `server` only when `require.main === module`).
3. **Wrangler Version**: `npx wrangler whoami` execution relies on Wrangler being installed in `devDependencies` (`wrangler: "^3.0.0"` is in `package.json`). If executed in offline or CI environments without internet access, Wrangler calls must fail gracefully without hanging for 25 seconds.

---

## 4. Conclusion

`server.js` contains a complete functional cloaker dashboard implementation with dual-mode cloaking (Method 1: Client-Side Human Verification; Method 2: Server-Side Rolling 24-Hour Gatekeeper with Cloudflare D1), but suffers from critical architectural instability, hanging, and crash vectors:

1. **Crash Vectors on Malformed Requests**: Destructuring `req.body` directly across 5 POST endpoints causes reproducible HTTP 500 errors and HTML stack leaks when non-JSON or empty bodies are received.
2. **Startup & Lifecycle Hanging**:
   - `server.on('error')` fails to exit on `EADDRINUSE`, causing secondary instances of `node server.js` to hang indefinitely.
   - Background startup execution of `verifyCloudflare()` initiates `npx wrangler whoami` with a 25-second timeout.
   - Sockets remain stuck in `CLOSE_WAIT`/`FIN_WAIT_2` because process termination signals (`SIGINT`/`SIGTERM`) and socket keep-alive/drain timeouts are unhandled.
3. **Blocking Synchronous I/O**: `fs.writeFileSync` and `fs.readFileSync` run synchronously inside route handlers without write-error handling.
4. **Security Vulnerability**: Raw string interpolation in `/api/analytics/simulate` (line 1173) constitutes a direct SQL injection vector into Cloudflare D1.
5. **Testability Deficit**: `server.js` does not export `app` and unconditionally starts listening on port 5050, blocking automated testing frameworks (Jest/Mocha/Supertest).

---

## 5. Verification Method

To independently verify the observations and findings:

1. **Verify 500 Error on Missing Body / Non-JSON**:
   ```bash
   node -e "fetch('http://localhost:5050/api/config', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'test' }).then(async r => console.log('Status:', r.status, (await r.text()).slice(0, 150)))"
   ```
   *Expected Output*: `Status: 500` with `TypeError: Cannot destructure property 'apiToken' of 'req.body' as it is undefined.`

2. **Verify HTML Stack Trace Leak on Malformed JSON**:
   ```bash
   node -e "fetch('http://localhost:5050/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }).then(async r => console.log('Status:', r.status, (await r.text()).slice(0, 150)))"
   ```
   *Expected Output*: `Status: 400` returning HTML `<pre>SyntaxError: Expected property name...`

3. **Verify Invalid Sitemaps Type 500 Error**:
   ```bash
   node -e "fetch('http://localhost:5050/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceDomain: 'test.com', targetDomain: 'dest.com', sitemaps: 'invalid' }) }).then(async r => console.log('Status:', r.status, await r.json()))"
   ```
   *Expected Output*: `Status: 500` with `(intermediate value).map is not a function`.

4. **Verify Port 5050 Orphaned Process & Socket State**:
   ```powershell
   netstat -ano | findstr :5050
   ```
   *Expected Output*: `LISTENING` and lingering connections with PID corresponding to `node.exe`.

5. **Verify SQL Injection Pattern**:
   Inspect line 1173 of `server.js`:
   `statements.push(\`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('\${postPath}', '\${randHash}', datetime('now'), '\${country}');\`);`

6. **Invalidation Conditions**:
   - If `req.body` is defaulted via `req.body || {}` or a body-parser validation middleware is introduced, Verification 1 will return 200 or 400 JSON instead of 500.
   - If an Express error-handling middleware `(err, req, res, next)` is mounted after all routes, Verification 2 will return `{ success: false, message: ... }` JSON instead of HTML.
   - If `if (require.main === module) { ... }` wraps `app.listen(PORT)` and `module.exports = { app, server }` is added, `app` can be tested in isolation on dynamic ports.
