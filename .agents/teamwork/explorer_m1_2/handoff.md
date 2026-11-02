# Milestone 1 Remediation Strategy: Health Check, Validation & Centralized Error Middleware

**Agent**: Milestone 1 Explorer 2 (`teamwork_explorer`)  
**Target File**: `c:\Users\mouni\Desktop\my-cloaker\server.js`  
**Parent Conversation ID**: `99771219-9d06-49a7-a16f-250903dc2536`  
**Working Directory**: `c:\Users\mouni\Desktop\my-cloaker\.agents\teamwork\explorer_m1_2`  
**Authoritative References**: `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/teamwork/PROJECT.md`

---

## 1. Observation

Direct examination of `c:\Users\mouni\Desktop\my-cloaker\server.js` (1288 lines) and related project files using `view_file` and code inspection revealed the following exact observations:

### 1.1 Complete Absence of Health Check Endpoints
- In `server.js`, there is no route registered for `/health` or `/api/health`.
- The only root/utility route registered is `GET /favicon.ico` (Lines 658-662):
  ```javascript
  658: // Serve favicon to prevent 404 noise
  659: app.get('/favicon.ico', (req, res) => {
  660:   res.set('Content-Type', 'image/svg+xml');
  661:   res.set('Cache-Control', 'public, max-age=86400');
  662:   res.send('<svg ...');
  663: });
  ```
- Requesting `GET /health` or `GET /api/health` currently results in an unhandled 404 HTML response (`<!DOCTYPE html><html>Cannot GET /health</html>`).
- Specification requirement from dispatch:
  - Return HTTP 200 OK with JSON payload:
    `{ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), memory: process.memoryUsage() }`

### 1.2 Fragile Input Handling and Crash Vulnerabilities on POST Routes
- **`POST /api/config` (Lines 670-684)**:
  ```javascript
  670: app.post('/api/config', (req, res) => {
  671:   const { apiToken, accountId, d1DatabaseId, activationMethod, defaultScrollPct, defaultTrigger, thresholdCount, autoCreateWww } = req.body;
  672:   const cfg = {
  673:     apiToken: apiToken || '',
  674:     accountId: accountId || '',
  675:     d1DatabaseId: d1DatabaseId || DEFAULT_D1_DATABASE_ID,
  676:     activationMethod: activationMethod === 'visitor_threshold' ? 'visitor_threshold' : 'trigger',
  677:     defaultScrollPct: defaultScrollPct || 15,
  678:     defaultTrigger: defaultTrigger || 'both',
  679:     thresholdCount: parseInt(thresholdCount, 10) || 50,
  680:     autoCreateWww: autoCreateWww !== false
  681:   };
  682:   saveConfig(cfg);
  683:   res.json({ success: true, config: cfg });
  684: });
  ```
  - **Defect**: If a request arrives without a body, with header `Content-Type: text/plain`, or with a JSON `null` literal (`null`), `req.body` is `undefined` or `null`. Attempting to destructure properties at Line 671 throws an unhandled exception:
    `TypeError: Cannot destructure property 'apiToken' of 'req.body' as it is undefined` (or null).
- **`POST /api/verify-cf` (Line 761)**:
  ```javascript
  761: const { apiToken, accountId, forceRefresh } = req.body;
  ```
  - Throws `TypeError` on missing/null body.
- **`POST /api/generate` (Lines 817-826)**:
  ```javascript
  817: const {
  818:   sourceDomain,
  819:   targetDomain,
  820:   activationMethod = 'visitor_threshold',
  821:   scrollPct,
  822:   triggerCondition = 'both',
  823:   thresholdCount = 4,
  824:   sitemaps,
  825:   blockThemes
  826: } = req.body;
  ```
  - Missing body throws `TypeError`.
  - Non-string `sourceDomain` or `targetDomain` crashes `buildWorkerCode()` at Lines 144-145:
    `cleanTarget = targetDomain.replace(...) -> TypeError: targetDomain.replace is not a function`.
  - Passing `sitemaps` as a string crashes `buildWorkerCode()` at Line 151 and `buildRobotsTxt()` at Line 633:
    `(sitemaps.length > 0 ? sitemaps : [...]).map(...) -> TypeError: sitemaps.map is not a function`.
- **`POST /api/deploy` (Lines 862-874)**:
  - Destructures directly from `req.body` without defensive default `{}`.
- **`POST /api/analytics/simulate` (Lines 1158, 1172-1173)**:
  ```javascript
  1158: const { postPath = '/50-driveway-landscaping-ideas/', count = 1, country = 'US' } = req.body;
  ...
  1173: statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${postPath}', '${randHash}', datetime('now'), '${country}');`);
  ```
  - Direct string interpolation exposes SQL injection in Cloudflare D1 query.
- **Missing `POST /api/campaigns` Route**:
  - `server.js` currently defines `GET /api/campaigns` (Line 1247) and `DELETE /api/campaigns/:id` (Line 1252), but does NOT implement `POST /api/campaigns`, violating `PROJECT.md` Feature 5 and Interface Contract (lines 38-41).

### 1.3 Missing Express Centralized Error-Handling Middleware
- In `server.js`, lines 9-10 configure:
  ```javascript
  9: app.use(express.json());
  10: app.use(express.static(path.join(__dirname, 'public')));
  ```
- There is NO error-handling middleware (`app.use((err, req, res, next) => ...)` anywhere in the application.
- When `express.json()` receives malformed JSON (e.g. `POST` with `Content-Type: application/json` and body `{"foo":`), it generates a `SyntaxError: Unexpected end of JSON input`.
- Without a centralized error middleware, Express defaults to its built-in HTML error handler, returning raw HTML with stack trace details instead of a clean JSON `{ error: ... }` response.
- There is also no 404 catch-all middleware; unhandled routes return HTML `Cannot GET /route`.

---

## 2. Logic Chain

1. **Premise 1 (Health Monitoring & Liveness)**: Automated orchestration and test runners (`test/health.test.js`) require standard HTTP health endpoints to verify that the server is alive and operational.
   - *Direct inference from Observation 1.1*: Adding `GET /health` and `GET /api/health` that respond with status 200 and `{ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), memory: process.memoryUsage() }` satisfies health monitoring requirements and guarantees zero-dependency readiness checks.
2. **Premise 2 (Input Validation & Body Defense)**: In Node.js / Express, `req.body` is populated by body-parser middleware. If the client omits the body or sends invalid content types, `req.body` is `undefined`. If the client sends JSON `null`, `req.body` is `null`.
   - *Direct inference from Observation 1.2*: Destructuring from `req.body` without defensive defaults causes immediate unhandled `TypeError` exceptions. A two-tier defense is required:
     a) A global body-safety middleware (`app.use`) that ensures `req.body` is always at least an empty object `{}` on `POST`, `PUT`, and `PATCH` requests.
     b) Per-route defensive destructuring (`const { ... } = req.body || {};`) with type and boundary checks.
3. **Premise 3 (Express Error Protocol)**: Express error-handling middleware must take exactly four arguments: `(err, req, res, next)`. When `express.json()` fails to parse incoming JSON, it invokes `next(err)` with a `SyntaxError`.
   - *Direct inference from Observation 1.3*: Placing an Express centralized error-handling middleware at the very end of the middleware stack intercepts `SyntaxError` from `express.json()`, converts it into HTTP 400 Bad Request with JSON `{ error: ... }`, and catches all subsequent route errors (HTTP 500) as JSON, preventing raw HTML stack traces from leaking to clients.
4. **Premise 4 (Contract Fulfillment)**: `PROJECT.md` Feature 5 and Interface Contract (lines 38-41) require `POST /api/campaigns` to validate `{ name, safeUrl, moneyUrl }` and return HTTP 400 Bad Request with `{ error: string }` on missing fields.
   - *Direct inference from Observation 1.2*: Implementing `POST /api/campaigns` with explicit schema checks prevents `TypeError` and fulfills the API contract.

---

## 3. Caveats

1. **Read-Only Explorer Scope**: In accordance with the Teamwork explorer role, no files in the workspace (specifically `server.js`) have been directly modified. All implementations are presented as concrete code snippets ready for the Milestone 1 Worker to apply.
2. **Express 5 Compatibility**: The project uses Express v5.3.0 (`package.json`). Express 5 automatically forwards rejected Promises from `async` route handlers to the error-handling middleware without requiring explicit `try/catch` or third-party wrappers like `express-async-errors`. However, explicit try/catch or `next(err)` forwarding has been designed for maximum backward and forward compatibility.
3. **Wrangler / Cloudflare Authentication**: Routes calling external Cloudflare APIs (`/api/verify-cf`, `/api/zones`, `/api/deploy`, `/api/analytics/*`) require valid Cloudflare credentials or offline fallback logic. The input validation ensures that missing credentials cleanly return HTTP 400 JSON errors without hanging or throwing unhandled rejections.

---

## 4. Conclusion & Remediation Design

To remediate all deficiencies observed, the following exact code changes must be applied to `c:\Users\mouni\Desktop\my-cloaker\server.js`.

### 4.1 Remediation Code Snippets

#### Snippet 1: Global Body Safety Guard & Centralized JSON Parsing Setup
**Location**: Insert immediately after `app.use(express.json())` (around Line 9 of `server.js`).

```javascript
// --- Start Body Safety Guard Middleware ---
// Parse incoming JSON payloads
app.use(express.json({ limit: '5mb' }));

// Guard against missing, undefined, or null req.body on body-carrying methods
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      req.body = {};
    }
  }
  next();
});
// --- End Body Safety Guard Middleware ---
```

---

#### Snippet 2: Health Check Endpoints (`GET /health` & `GET /api/health`) and Stats (`GET /api/stats`)
**Location**: Insert around Line 663 of `server.js` (alongside `GET /favicon.ico`).

```javascript
// =========================================================================
// HEALTH CHECK & MONITORING ENDPOINTS
// =========================================================================

// Shared health handler returning 200 OK with server uptime, timestamp, and memory
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API: Server Stats & Health Summary (PROJECT.md Feature 8)
app.get('/api/stats', (req, res) => {
  try {
    const campaigns = loadCampaigns();
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      campaignCount: Array.isArray(campaigns) ? campaigns.length : 0,
      memory: process.memoryUsage()
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to retrieve stats' });
  }
});
```

---

#### Snippet 3: Hardened `POST /api/config`
**Location**: Replace Lines 670-684 of `server.js`.

```javascript
// API: Save Config (Robust Validation & Body Protection)
app.post('/api/config', (req, res, next) => {
  try {
    const body = req.body || {};
    const {
      apiToken,
      accountId,
      d1DatabaseId,
      activationMethod,
      defaultScrollPct,
      defaultTrigger,
      thresholdCount,
      autoCreateWww
    } = body;

    const parsedThreshold = parseInt(thresholdCount, 10);
    const parsedScrollPct = parseInt(defaultScrollPct, 10);

    const cfg = {
      apiToken: typeof apiToken === 'string' ? apiToken.trim() : (apiToken || ''),
      accountId: typeof accountId === 'string' ? accountId.trim() : (accountId || ''),
      d1DatabaseId: d1DatabaseId || DEFAULT_D1_DATABASE_ID,
      activationMethod: activationMethod === 'visitor_threshold' ? 'visitor_threshold' : 'trigger',
      defaultScrollPct: (!isNaN(parsedScrollPct) && parsedScrollPct > 0 && parsedScrollPct <= 100) ? parsedScrollPct : 15,
      defaultTrigger: ['scroll', 'click', 'both'].includes(defaultTrigger) ? defaultTrigger : 'both',
      thresholdCount: (!isNaN(parsedThreshold) && parsedThreshold > 0) ? parsedThreshold : 50,
      autoCreateWww: autoCreateWww !== false
    };

    saveConfig(cfg);
    res.status(200).json({ success: true, config: cfg });
  } catch (err) {
    next(err);
  }
});
```

---

#### Snippet 4: Implement `POST /api/campaigns` (Contract Fulfillment & Schema Validation)
**Location**: Insert directly after `GET /api/campaigns` (around Line 1250 of `server.js`).

```javascript
// API: Create Campaign Route (PROJECT.md Contract lines 38-41)
app.post('/api/campaigns', (req, res, next) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { name, safeUrl, moneyUrl, status } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or invalid required field: name' });
    }
    if (!safeUrl || typeof safeUrl !== 'string' || safeUrl.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or invalid required field: safeUrl' });
    }
    if (!moneyUrl || typeof moneyUrl !== 'string' || moneyUrl.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or invalid required field: moneyUrl' });
    }

    const campaigns = loadCampaigns();
    const cleanId = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    const campaignRecord = {
      id: cleanId,
      name: name.trim(),
      safeUrl: safeUrl.trim(),
      moneyUrl: moneyUrl.trim(),
      status: (status && typeof status === 'string') ? status : 'active',
      createdAt: new Date().toISOString()
    };

    campaigns.unshift(campaignRecord);
    saveCampaigns(campaigns);

    res.status(201).json({ success: true, campaign: campaignRecord });
  } catch (err) {
    next(err);
  }
});
```

---

#### Snippet 5: Defensive Hardening for `buildWorkerCode` and `buildRobotsTxt`
**Location**: Lines 134-152 and Lines 628-634 of `server.js`.

```javascript
// In buildWorkerCode():
function buildWorkerCode({
  sourceDomain = '',
  targetDomain = '',
  activationMethod = 'visitor_threshold',
  scrollPct = 0.15,
  triggerCondition = 'both',
  thresholdCount = 4,
  sitemaps = [],
  blockThemes = true
}) {
  const cleanTarget = String(targetDomain || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const cleanSource = String(sourceDomain || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const isVisitorThreshold = activationMethod === 'visitor_threshold';
  
  // Guarantee safe array handling for sitemaps
  const safeSitemaps = Array.isArray(sitemaps) ? sitemaps : (typeof sitemaps === 'string' ? [sitemaps] : []);
  const sitemapDirectives = (safeSitemaps.length > 0 ? safeSitemaps : [
    `https://${cleanSource}/wp-sitemap.xml`,
    `https://${cleanSource}/sitemap.xml`
  ]).map(sm => `Sitemap: ${sm.startsWith('http') ? sm : 'https://' + sm}`).join('\\n');
  ...
```

```javascript
// In buildRobotsTxt():
function buildRobotsTxt({ sourceDomain = '', sitemaps = [] }) {
  const cleanSource = String(sourceDomain || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const safeSitemaps = Array.isArray(sitemaps) ? sitemaps : (typeof sitemaps === 'string' ? [sitemaps] : []);
  const sitemapLines = (safeSitemaps.length > 0 ? safeSitemaps : [
    `https://${cleanSource}/wp-sitemap.xml`,
    `https://${cleanSource}/sitemap.xml`
  ]).map(sm => `Sitemap: ${sm.startsWith('http') ? sm : 'https://' + sm}`).join('\n');
  ...
```

---

#### Snippet 6: Hardened `POST /api/generate`
**Location**: Replace Lines 815-852 of `server.js`.

```javascript
// API: Generate Code Preview (Hardened Type Checking)
app.post('/api/generate', (req, res, next) => {
  try {
    const body = req.body || {};
    const {
      sourceDomain,
      targetDomain,
      activationMethod = 'visitor_threshold',
      scrollPct,
      triggerCondition = 'both',
      thresholdCount = 4,
      sitemaps,
      blockThemes
    } = body;

    if (!sourceDomain || typeof sourceDomain !== 'string' || !targetDomain || typeof targetDomain !== 'string') {
      return res.status(400).json({
        error: 'Source and Target domains are required strings',
        success: false,
        message: 'Source and Target domains are required strings'
      });
    }

    const safeSitemaps = Array.isArray(sitemaps) ? sitemaps : (typeof sitemaps === 'string' ? [sitemaps] : []);
    const parsedScrollPct = parseInt(scrollPct, 10);
    const parsedThreshold = parseInt(thresholdCount, 10);

    const code = buildWorkerCode({
      sourceDomain: sourceDomain.trim(),
      targetDomain: targetDomain.trim(),
      activationMethod: activationMethod === 'visitor_threshold' ? 'visitor_threshold' : 'trigger',
      scrollPct: (!isNaN(parsedScrollPct) && parsedScrollPct > 0 ? parsedScrollPct : 15) / 100,
      triggerCondition: ['scroll', 'click', 'both'].includes(triggerCondition) ? triggerCondition : 'both',
      thresholdCount: (!isNaN(parsedThreshold) && parsedThreshold > 0 ? parsedThreshold : 4),
      sitemaps: safeSitemaps,
      blockThemes: blockThemes !== false
    });
    const robots = buildRobotsTxt({ sourceDomain: sourceDomain.trim(), sitemaps: safeSitemaps });

    res.json({
      success: true,
      workerCode: code,
      robotsTxt: robots
    });
  } catch (err) {
    next(err);
  }
});
```

---

#### Snippet 7: Sanitized `POST /api/analytics/simulate` (SQL Injection Protection)
**Location**: Lines 1157-1175 of `server.js`.

```javascript
// API: Simulate / Test Human Visit to a URL Path (SQL Injection Protected)
app.post('/api/analytics/simulate', async (req, res, next) => {
  try {
    const body = req.body || {};
    const { postPath = '/50-driveway-landscaping-ideas/', count = 1, country = 'US' } = body;
    const cfg = loadConfig();
    let token = cfg.apiToken;
    const account = cfg.accountId;
    const dbId = cfg.d1DatabaseId || DEFAULT_D1_DATABASE_ID;

    if (!token || !account || !dbId) {
      return res.status(400).json({ error: 'Cloudflare credentials not configured', success: false, message: 'Cloudflare credentials not configured' });
    }

    // Sanitize parameters against SQL injection
    const safePath = String(postPath).replace(/'/g, "''");
    const safeCountry = String(country).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'US';
    const num = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);

    const statements = [];
    for (let i = 0; i < num; i++) {
      const randHash = 'sim_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${safePath}', '${randHash}', datetime('now'), '${safeCountry}');`);
    }

    let cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: statements.join(' ') })
    });
    let cfData = await cfRes.json();

    res.json({
      success: cfData.success,
      message: `Simulated ${num} human visit(s) to ${safePath}!`,
      details: cfData
    });
  } catch (err) {
    next(err);
  }
});
```

---

#### Snippet 8: 404 Catch-All & Centralized Express Error-Handling Middleware
**Location**: Place at the very end of all routes, immediately preceding the server startup / export block (around Line 1263 of `server.js`).

```javascript
// =========================================================================
// 404 CATCH-ALL & CENTRALIZED ERROR-HANDLING MIDDLEWARE
// =========================================================================

// 404 Catch-All Handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.url}`
  });
});

// Centralized Express Error Handler (must have exact signature: err, req, res, next)
app.use((err, req, res, next) => {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    return res.status(400).json({
      error: `Invalid JSON payload: ${err.message}`
    });
  }

  // Determine HTTP status code
  const statusCode = err.status || err.statusCode || 500;

  // Format clean JSON error response (preventing HTML stack traces)
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error'
  });
});
```

---

## 5. Verification Method

Once the Milestone 1 Worker incorporates these remediations, verify the fix using the following independent verification procedures:

### 5.1 Verification Test 1: Health Check Verification (`/health` & `/api/health`)
Execute via PowerShell:
```powershell
# Test /health
$res1 = Invoke-RestMethod -Uri "http://localhost:5050/health" -Method GET
if ($res1.status -eq 'ok' -and $res1.uptime -gt 0 -and $res1.memory.rss -gt 0) {
  Write-Host "✅ GET /health test passed!"
} else {
  Write-Host "❌ GET /health test failed!"
}

# Test /api/health
$res2 = Invoke-RestMethod -Uri "http://localhost:5050/api/health" -Method GET
if ($res2.status -eq 'ok' -and $res2.uptime -gt 0) {
  Write-Host "✅ GET /api/health test passed!"
} else {
  Write-Host "❌ GET /api/health test failed!"
}
```

### 5.2 Verification Test 2: Malformed JSON Syntax Handling
Send broken JSON to verify that the centralized error handler catches `SyntaxError` and returns HTTP 400 JSON without HTML stack traces:
```powershell
try {
  $badReq = Invoke-WebRequest -Uri "http://localhost:5050/api/config" -Method POST -Headers @{"Content-Type"="application/json"} -Body "{ brokenJson: "
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $body = $reader.ReadToEnd()
  Write-Host "HTTP Status: $statusCode"
  Write-Host "Response Body: $body"
  # Expected: Status 400, Body contains {"error": "Invalid JSON payload..."}
}
```

### 5.3 Verification Test 3: Missing / Null Body Protection on `POST /api/config`
Send an empty or null body to verify no `TypeError: Cannot destructure` is thrown:
```powershell
# Test empty body
$resEmpty = Invoke-RestMethod -Uri "http://localhost:5050/api/config" -Method POST -Headers @{"Content-Type"="application/json"} -Body "{}"
Write-Host "Config Empty Body Status: $($resEmpty.success)"

# Test null literal body
$resNull = Invoke-RestMethod -Uri "http://localhost:5050/api/config" -Method POST -Headers @{"Content-Type"="application/json"} -Body "null"
Write-Host "Config Null Body Status: $($resNull.success)"
```

### 5.4 Verification Test 4: `POST /api/campaigns` Validation
Verify missing fields return HTTP 400 with `{ error: string }`:
```powershell
try {
  Invoke-RestMethod -Uri "http://localhost:5050/api/campaigns" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"name": "test"}'
} catch {
  Write-Host "Campaign Missing Fields Status: $($_.Exception.Response.StatusCode.value__)"
  # Expected: HTTP 400 with {"error": "Missing or invalid required field: safeUrl"}
}
```

### 5.5 Verification Test 5: 404 Catch-All JSON Response
```powershell
try {
  Invoke-RestMethod -Uri "http://localhost:5050/api/nonexistent-endpoint" -Method GET
} catch {
  Write-Host "404 Catch-all Status: $($_.Exception.Response.StatusCode.value__)"
  # Expected: HTTP 404 with JSON {"error": "Route not found: GET /api/nonexistent-endpoint"}
}
```

### 5.6 Invalidation Conditions
This remediation strategy is invalidated if:
1. `GET /health` or `GET /api/health` returns any status other than 200 OK or does not include `status`, `uptime`, `timestamp`, or `memory`.
2. A malformed JSON POST returns an HTML response or unhandled Node exception.
3. A null body on `POST /api/config` crashes the event loop or returns HTTP 500.
4. Error responses do not contain the JSON key `error`.
