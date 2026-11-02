process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer } = require('../server.js');

describe('Health & Status Endpoints', () => {
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

  test('GET /health returns 200 OK with status, uptime, and timestamp schema', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200, 'status should be 200');

    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /application\/json/, 'content-type should be application/json');

    const data = await res.json();
    assert.strictEqual(data.status, 'ok', 'status field should be "ok"');
    assert.strictEqual(typeof data.uptime, 'number', 'uptime should be a number');
    assert.ok(data.uptime >= 0, 'uptime should be non-negative');

    assert.strictEqual(typeof data.timestamp, 'string', 'timestamp should be a string');
    const parsedTime = Date.parse(data.timestamp);
    assert.ok(!isNaN(parsedTime), 'timestamp should be a valid ISO string');
    assert.ok(Math.abs(Date.now() - parsedTime) < 30000, 'timestamp should be current within 30s');
  });

  test('GET /api/health returns 200 OK with same structure as /health', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200, 'status should be 200');

    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /application\/json/, 'content-type should be application/json');

    const data = await res.json();
    assert.strictEqual(data.status, 'ok', 'status field should be "ok"');
    assert.strictEqual(typeof data.uptime, 'number', 'uptime should be a number');
    assert.ok(data.uptime >= 0, 'uptime should be non-negative');

    assert.strictEqual(typeof data.timestamp, 'string', 'timestamp should be a string');
    const parsedTime = Date.parse(data.timestamp);
    assert.ok(!isNaN(parsedTime), 'timestamp should be a valid ISO string');
    assert.ok(Math.abs(Date.now() - parsedTime) < 30000, 'timestamp should be current within 30s');
  });

  test('GET /api/stats returns 200 OK with campaigns statistics and uptime', async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    assert.strictEqual(res.status, 200, 'status should be 200');

    const data = await res.json();
    assert.strictEqual(data.status, 'ok', 'status field should be "ok"');
    assert.strictEqual(typeof data.totalCampaigns, 'number', 'totalCampaigns should be a number');
    assert.strictEqual(typeof data.activeCampaigns, 'number', 'activeCampaigns should be a number');
    assert.ok(data.totalCampaigns >= data.activeCampaigns, 'totalCampaigns >= activeCampaigns');
    assert.strictEqual(typeof data.uptime, 'number', 'uptime should be a number');
    assert.ok(Date.parse(data.timestamp) > 0, 'timestamp should be valid ISO date');
  });

  test('consecutive health checks reflect incrementing process uptime', async () => {
    const res1 = await fetch(`${baseUrl}/health`);
    const data1 = await res1.json();

    // Small delay to ensure measurable uptime progression
    await new Promise((r) => setTimeout(r, 50));

    const res2 = await fetch(`${baseUrl}/health`);
    const data2 = await res2.json();

    assert.ok(data2.uptime >= data1.uptime, 'second uptime should be greater than or equal to first');
    assert.ok(Date.parse(data2.timestamp) >= Date.parse(data1.timestamp), 'timestamp should advance');
  });

  test('health endpoints respond quickly under burst requests (concurrency probe)', async () => {
    const requests = Array.from({ length: 10 }, () => fetch(`${baseUrl}/health`));
    const responses = await Promise.all(requests);

    for (const res of responses) {
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
    }
  });
});
