process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, isBot } = require('../server.js');

describe('Cloaker Logic, Bot Detection, Safe/Offer Routing & Error Resilience', () => {
  let serverInstance;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = 'test';
    serverInstance = await startServer(0);
    const port = serverInstance.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await stopServer();
  });

  test('isBot unit test: correctly detects search engines, social crawlers, and scrapers', () => {
    assert.strictEqual(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
    assert.strictEqual(isBot('Pinterest/0.2 (+https://www.pinterest.com/bot.html)'), true);
    assert.strictEqual(isBot('curl/7.88.1'), true);
    assert.strictEqual(isBot('HeadlessChrome/112.0.5615.49'), true);
    assert.strictEqual(isBot(''), true, 'empty UA should be considered bot/suspicious');
  });

  test('isBot unit test: correctly identifies genuine human mobile browser user agents', () => {
    const humanUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    assert.strictEqual(isBot(humanUa), false);
  });

  test('GET /cloaker/check identifies bot user-agents and routes to /safe', async () => {
    const res = await fetch(`${baseUrl}/cloaker/check`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.isBot, true);
    assert.strictEqual(data.destination, '/safe');
  });

  test('GET /cloaker/check identifies human user-agents and routes to /offer', async () => {
    const humanUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const res = await fetch(`${baseUrl}/cloaker/check`, {
      headers: {
        'User-Agent': humanUa
      }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.isBot, false);
    assert.strictEqual(data.destination, '/offer');
  });

  test('GET /safe returns 200 with clean safe page HTML content', async () => {
    const res = await fetch(`${baseUrl}/safe`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Safe Content') || html.includes('Safe Page'));
  });

  test('GET /offer returns 200 with offer page HTML content', async () => {
    const res = await fetch(`${baseUrl}/offer`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Target Offer') || html.includes('Offer Page'));
  });

  test('Malformed JSON POST body returns 400 Bad Request with JSON error object and no HTML leak', async () => {
    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken": json without closing brace'
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, 'Response must be JSON with an error property');
    assert.ok(typeof data.error === 'string');
  });

  test('Catch-all 404 handler returns structured JSON error for unknown route', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route-xyz`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, 'Not Found');
  });
});
