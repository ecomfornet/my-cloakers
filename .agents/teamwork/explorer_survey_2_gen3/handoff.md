# Comprehensive Analysis Report: `server.js` Architecture, Cloaking Engine, and Vulnerability Audit

## 1. Observation

Direct examination of `c:\Users\mouni\Desktop\my-cloaker\server.js` (1288 lines total) using `view_file` revealed the following exact components, routes, cloaking mechanisms, and defect points:

### 1.1 Middleware Configuration
- **Lines 9-10**:
  ```javascript
  9: app.use(express.json());
  10: app.use(express.static(path.join(__dirname, 'public')));
  ```
- **Absence of Centralized Error Handling Middleware**:
  There is NO `app.use((err, req, res, next) => ...)` defined in the entire file.
- **Absence of 404 Route Catch-All**:
  No fallback handler exists for undefined API or web routes.

### 1.2 Registered HTTP Endpoints and Request Handling Logic
1. **`GET /favicon.ico`** (Lines 658-662):
   ```javascript
   app.get('/favicon.ico', (req, res) => {
     res.set('Content-Type', 'image/svg+xml');
     res.set('Cache-Control', 'public, max-age=86400');
     res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#10b981"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="white" font-family="sans-serif">C</text></svg>');
   });
   ```
2. **`GET /api/config`** (Lines 665-667):
   Calls `loadConfig()` (Lines 81-99), which merges wrangler CLI token cache from `~/.config/.wrangler/config/default.toml` with `dashboard-config.json`.
3. **`POST /api/config`** (Lines 670-684):
   Extracts `apiToken`, `accountId`, `d1DatabaseId`, `activationMethod`, `defaultScrollPct`, `defaultTrigger`, `thresholdCount`, `autoCreateWww` from `req.body` and writes to `dashboard-config.json` via `fs.writeFileSync`.
4. **`POST /api/verify-cf`** (Lines 760-771):
   Calls `verifyCloudflare(apiToken, accountId)` (Lines 690-757). Features 120-second in-memory caching (`_cachedVerify`) unless `forceRefresh` is specified. Auto-refreshes OAuth token via `getWranglerDefaultsFresh()` on authentication error codes (10000).
5. **`GET /api/zones`** (Lines 774-812):
   Queries Cloudflare API `/client/v4/zones?per_page=50`. Includes token auto-refresh fallback.
6. **`POST /api/generate`** (Lines 815-852):
   Generates preview strings of the Cloudflare Worker script and `robots.txt` by calling `buildWorkerCode()` and `buildRobotsTxt()`.
7. **`POST /api/deploy`** (Lines 855-1065):
   Full deployment orchestrator:
   - Validates presence of `sourceDomain`, `targetDomain`, `apiToken`, and `accountId`.
   - Generates worker code via `buildWorkerCode()`.
   - Compiles a multipart/form-data payload with D1 binding metadata (`name: 'DB'`, `id: d1DatabaseId`).
   - PUTs script to Cloudflare Workers API `/client/v4/accounts/${account}/workers/scripts/${finalWorkerName}`.
   - Discovers Zone ID via `/client/v4/zones?name=${cleanSource}`.
   - Queries and updates/creates Cloudflare Worker routes for `${cleanSource}/*` and optionally `www.${cleanSource}/*`.
   - Appends or updates campaign record in `dashboard-campaigns.json` via `saveCampaigns()`.
8. **`GET /api/analytics/posts`** (Lines 1068-1154):
   Queries Cloudflare D1 database via REST API (`/d1/database/${dbId}/query`) using SQL:
   ```sql
   SELECT post_path, COUNT(DISTINCT visitor_hash) as unique_humans, MAX(visited_at) as last_visit, GROUP_CONCAT(DISTINCT country) as countries
   FROM url_human_visits
   WHERE visited_at >= datetime('now', '-24 hours')
   GROUP BY post_path
   ORDER BY unique_humans DESC;
   ```
   Aggregates metrics (`totalHumans24h`, `activePostsCount`, `holdingPostsCount`) based on `thresholdCount`.
9. **`POST /api/analytics/simulate`** (Lines 1157-1210):
   Accepts `{ postPath, count, country }` from `req.body` and inserts simulated records into D1.
10. **`POST /api/analytics/reset`** (Lines 1213-1244):
    Executes `DELETE FROM url_human_visits;` on Cloudflare D1.
11. **`GET /api/campaigns`** (Lines 1247-1249):
    Returns `loadCampaigns()` reading `dashboard-campaigns.json`.
12. **`DELETE /api/campaigns/:id`** (Lines 1252-1262):
    Removes the specified campaign by `id` from `dashboard-campaigns.json`.
13. **Server Listener & Startup** (Lines 1264-1287):
    Listens on `PORT` (default 5050). Initiates background `verifyCloudflare()` promise. Listens on `server.on('error')` for `EADDRINUSE`.

---

### 1.3 Cloaker Functionality & Redirection Architecture

The cloaking system operates as a dynamically generated Cloudflare Worker (`buildWorkerCode`, Lines 134-625) featuring two activation engines, multi-layer bot filtering, and client-side anti-automation verification.

#### A. Multi-Layer Bot & Crawler Detection
- **Server-Side Worker UA Inspection (`isBot`, Lines 166-194)**:
  - Disallows short/empty User-Agents (`ua.length < 15`, Line 167).
  - Inspects for Pinterest crawler (`/Pinterestbot/i` or `Pinterest/` + `bot.html`, Lines 169-171).
  - Inspects for automation frameworks: `/headlesschrome|puppeteer|playwright|selenium|phantomjs|cypress|webdriver/i` (Lines 173-175).
  - Search engine bots: `/googlebot|google-inspectiontool|mediapartners-google|storebot-google|bingbot|bingpreview|msnbot|yandexbot|baiduspider|duckduckbot/i` (Lines 177-179).
  - Social network crawlers: `/facebookexternalhit|facebot|meta-externalagent|twitterbot|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|bytespider/i` (Lines 181-183).
  - HTTP libraries and CLI scrapers: `/curl\/|wget\/|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|postman/i` (Lines 185-187).
  - Generic bot tokens: `/bot\b|crawler|spider|scraper|preview|archiver/i` (Lines 189-191).
- **Crawlers Handling (Safe Page)**:
  - Crawlers receive origin responses with ZERO redirection and ZERO database writes:
    ```javascript
    260: if (isBot(ua)) {
    261:   return fetch(request);
    262: }
    ```
- **Robots.txt & Path Restrictions**:
  - Intercepts `/robots.txt` (Lines 214-243) disallowing `/themes/`, `/wp-admin/`, `/search/`, `/wp-includes/`, and `/*?s=`.
  - Hard block on `/themes/` for detected bots returning HTTP 403 (Lines 246-250).
- **Client-Side Anti-Automation Verification (`scanAutomation`, Lines 350-411)**:
  - Injected script inspects:
    1. `navigator.webdriver === true`
    2. Headless screen dimensions: `window.outerWidth === 0 && window.outerHeight === 0 && window.screen.width === 0` (with touch device exemption).
    3. Error call stack signatures: stack frames containing `UtilityScript`, `playwright`, `puppeteer`, `evaluate (:`.
    4. Automation global variables: `window.__playwright`, `window.playwright`, `window.__pw_init`, `window.__pw_manual`, `window.__puppeteer_evaluation_script__`, `window.puppeteer`, `window.__selenium_evaluate`, `window._phantom`, `window.callPhantom`, `window.__nightmare`, `window.domAutomation`, `window.domAutomationController`.
    5. Headless UA indicators: `indexOf("HeadlessChrome") !== -1`.
    6. Root attributes: `document.documentElement.getAttribute("webdriver")` or `selenium`.
    7. Language presence: `!navigator.languages || navigator.languages.length === 0`.
    8. Event legitimacy check: requires `event.isTrusted === true` to prevent simulated `dispatchEvent` calls.

#### B. Safe vs. Money Redirection Engines
- **Method 1: Human Verification Trigger (`trigger`)** (Lines 528-585):
  - Injects client-side interaction listeners for `click`, `touchend`, or `scroll`.
  - For `scroll`, calculates vertical delta `pct = top / max` against configurable `SCROLL_PCT` (default 15%).
  - When verified, triggers `window.location.replace(target)` to the destination URL (`https://${TARGET_HOST}${postPath}${url.search}`).
- **Method 2: 24-Hour Unique Human Visitor Threshold (`visitor_threshold`)** (Lines 269-326, 463-523):
  - Cloudflare Worker reads headers `cf-connecting-ip` and `cf-ipcountry` (Lines 274-275).
  - Extracts cookie `cf_uv_id` or hashes `${clientIp}::${ua}::cloaker-salt` using SHA-256 (Lines 280-293).
  - Inserts visit into Cloudflare D1 `url_human_visits`.
  - Queries rolling 24h count: `SELECT COUNT(*) as cnt FROM url_human_visits WHERE post_path = ?1 AND visited_at >= datetime('now', '-24 hours')`.
  - **Threshold Gatekeeper (Lines 316-326)**: If `uniqueHumanCount24h < THRESHOLD_COUNT` (default 4), serves clean origin WordPress HTML with no redirection scripts and explicit cache-busting headers (`Cache-Control: no-store, no-cache, must-revalidate, max-age=0`).
  - **Threshold Exceeded (Lines 463-523)**: Once threshold is reached, injects script that immediately redirects upon ANY trusted interaction (`click`, `touchstart`, `touchend`, `pointerdown`, `pointermove`, `mousemove`, `wheel`, `scroll`, `keydown`).
- **Scheduled Maintenance** (Lines 198-207):
  - Cloudflare Worker scheduled handler runs daily: `DELETE FROM url_human_visits WHERE visited_at < datetime('now', '-48 hours')`.

---

### 1.4 Vulnerabilities and Code Deficiencies

#### Defect 1: SQL Injection Vulnerability in `/api/analytics/simulate`
- **Location**: `server.js` Lines 1172-1173:
  ```javascript
  1172: const randHash = 'sim_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  1173: statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${postPath}', '${randHash}', datetime('now'), '${country}');`);
  ```
- **Finding**: `postPath` and `country` from `req.body` (Line 1158) are interpolated directly into SQL statements without escaping, sanitization, or parameter binding. An attacker can inject arbitrary SQL payloads directly executed against Cloudflare D1.

#### Defect 2: Missing Express Centralized Error-Handling Middleware
- **Location**: Global application pipeline (Lines 6-11 and 1264-1288).
- **Finding**: Express uses default error handling. When clients send malformed JSON in a POST request with `Content-Type: application/json`, `express.json()` raises `SyntaxError: Unexpected token ... in JSON`. Because there is no `app.use((err, req, res, next) => ...)` middleware, Express produces an unhandled internal error, responds with raw HTML including stack traces, and does not return JSON.

#### Defect 3: Missing Input Validations & Type Coercion Crashes
- **`sitemaps` parameter** in `buildWorkerCode` (Line 148):
  ```javascript
  const sitemapDirectives = (sitemaps.length > 0 ? sitemaps : [...]).map(sm => ...)
  ```
  If `sitemaps` is passed as a string (e.g. `sitemaps: "https://example.com/sitemap.xml"`), `.length > 0` evaluates to true, and calling `.map` throws `TypeError: sitemaps.map is not a function`, causing an unhandled 500 error in `/api/generate` and `/api/deploy`.
- **`sourceDomain` / `targetDomain` regex coercion** (Lines 144-145, 889):
  ```javascript
  const cleanTarget = targetDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  ```
  If `targetDomain` is passed as a non-string (e.g. a number, boolean, or object), calling `.replace()` crashes the handler with `TypeError: targetDomain.replace is not a function`.
- **`thresholdCount` & `defaultScrollPct`**: No bounds validation in `/api/config` or `/api/deploy`; negative values or strings resulting in `NaN` can corrupt configuration and generated Worker code (`SCROLL_PCT = NaN`).

#### Defect 4: Synchronous File I/O on the Event Loop
- **Locations**:
  - `loadConfig()` (Line 86): `fs.readFileSync(CONFIG_FILE, 'utf8')`
  - `saveConfig()` (Line 102): `fs.writeFileSync(CONFIG_FILE, ...)`
  - `loadCampaigns()` (Line 108): `fs.readFileSync(CAMPAIGNS_FILE, 'utf8')`
  - `saveCampaigns()` (Line 129): `fs.writeFileSync(CAMPAIGNS_FILE, ...)`
  - `getWranglerDefaults()` (Lines 32, 48): `fs.readFileSync(configPath, 'utf8')`
- **Finding**: Synchronous blocking file reads and writes inside incoming HTTP route handlers block the Node.js single-threaded event loop during disk contention.

#### Defect 5: Uncontrolled Child Process Concurrency in Token Refresh
- **Location**: `getWranglerDefaultsFresh()` (Lines 73-79):
  ```javascript
  async function getWranglerDefaultsFresh() {
    return new Promise((resolve) => {
      exec('npx wrangler whoami', { timeout: 25000 }, () => {
        resolve(getWranglerDefaults());
      });
    });
  }
  ```
- **Finding**: While `_asyncRefreshWranglerToken` (Lines 23-41) employs a lock flag `_refreshInProgress`, `getWranglerDefaultsFresh` has no lock or throttle. When multiple API requests encounter an expired token concurrently, each request triggers an independent `npx wrangler whoami` process. This can spawn dozens of concurrent `npx` child processes, saturating CPU, memory, and file handles on Windows.

#### Defect 6: Missing Process Termination Signal Handling
- **Location**: `server.js` Lines 1264-1288.
- **Finding**: There are no listeners for `process.on('SIGINT')` or `process.on('SIGTERM')`. When stopped by process managers, Docker, or CI scripts, the server abruptly drops active socket connections and leaves hung ports or orphan child processes.

---

## 2. Logic Chain

1. **Premise 1**: A web server handling external JSON inputs requires robust input sanitization, error interception, and safe asynchronous operations to achieve production stability.
2. **Premise 2**: Observation 1.1 and 1.4 (Defect 2) establish that `server.js` mounts `express.json()` at Line 9 without an Express error-handling middleware (`app.use((err, req, res, next) => ...)`).
   - *Inference*: Malformed JSON payloads produce unhandled Express errors, leaking stack traces and failing API contracts.
3. **Premise 3**: Observation 1.4 (Defect 1) demonstrates that `postPath` and `country` are concatenated directly into SQL queries sent to Cloudflare D1 (Lines 1172-1173).
   - *Inference*: This provides a trivial SQL injection vector that can modify or drop tables in the production D1 database.
4. **Premise 4**: Observation 1.4 (Defect 5) demonstrates that `getWranglerDefaultsFresh()` spawns `exec('npx wrangler whoami')` without concurrency protection.
   - *Inference*: Under load or token invalidation, simultaneous incoming requests can spawn unbounded child processes, leading to event loop starvation and server hang.
5. **Premise 5**: Observation 1.4 (Defect 3) shows missing type checks on `sitemaps`, `sourceDomain`, and `targetDomain` in Worker generation.
   - *Inference*: Passing non-string or non-array inputs immediately throws unhandled runtime TypeErrors.

---

## 3. Caveats

- **External Network Dependencies**: Functions communicating with `api.cloudflare.com` require valid network connectivity and Cloudflare credentials to execute full end-to-end integration tests. Mocking or unit testing with stubbed `fetch` is necessary for offline test environments.
- **Wrangler CLI Installation**: `npx wrangler` execution depends on Node.js/npm environment variables and local Windows file paths (`%APPDATA%/xdg.config/.wrangler`).
- **Read-Only Constraint**: In accordance with explorer guidelines, no edits were made to `server.js`.

---

## 4. Conclusion

`server.js` functions as a full-featured cloaking campaign management server and Cloudflare Worker generator. However, it suffers from several critical stability, security, and error-handling deficiencies:
1. **Security**: Severe SQL injection vulnerability in `/api/analytics/simulate` (Lines 1172-1173).
2. **Robustness**: Missing centralized error handling middleware (`app.use((err, req, res, next) => ...)`) allows malformed JSON and internal errors to escape cleanly formatted JSON responses.
3. **Validation**: Unsafe string and array operations on `targetDomain`, `sourceDomain`, and `sitemaps` cause crashes on unexpected types.
4. **Concurrency & Resource Exhaustion**: Unbounded `npx wrangler` execution in `getWranglerDefaultsFresh()` risks event loop hangs under concurrent authentication retries.
5. **Process Lifecycle**: Missing graceful shutdown handlers (`SIGINT`/`SIGTERM`) and health-check endpoint (`GET /api/health`).

---

## 5. Verification Method

To verify these findings independently:
1. **Verify Line Numbers and File Content**:
   ```powershell
   # Inspect lines 1-50, 165-200, 1157-1210, 1260-1288
   Get-Content -Path "c:\Users\mouni\Desktop\my-cloaker\server.js" | Select-Object -Index 8,9,165,1170,1171,1172,1173
   ```
2. **Verify Malformed JSON Crash / Error Response**:
   Send malformed JSON to `POST /api/config`:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:5050/api/config" -Method POST -Headers @{"Content-Type"="application/json"} -Body "{ malformed: "
   ```
   *Expected defect behavior*: Returns HTML stack trace with HTTP 400 instead of clean JSON error response.
3. **Verify SQL Injection Exposure**:
   Inspect line 1173 of `server.js` to observe unparameterized SQL template string:
   ```javascript
   statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${postPath}', '${randHash}', datetime('now'), '${country}');`);
   ```
4. **Verify Missing Error Middleware**:
   Search for error-handling middleware signature:
   ```powershell
   Select-String -Path "c:\Users\mouni\Desktop\my-cloaker\server.js" -Pattern "app\.use\(\(err,"
   ```
   *Expected defect behavior*: 0 matches.
