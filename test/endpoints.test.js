process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stopServer } = require('../server.js');

describe('Core API Endpoints & Routes', () => {
  let serverInstance;
  let baseUrl;

  const configFile = path.join(__dirname, '..', 'dashboard-config.json');
  const campaignsFile = path.join(__dirname, '..', 'dashboard-campaigns.json');

  let originalConfig = null;
  let originalCampaigns = null;

  before(async () => {
    process.env.NODE_ENV = 'test';

    // Backup config and campaigns files
    if (fs.existsSync(configFile)) {
      originalConfig = fs.readFileSync(configFile, 'utf8');
    }
    if (fs.existsSync(campaignsFile)) {
      originalCampaigns = fs.readFileSync(campaignsFile, 'utf8');
    }

    serverInstance = await startServer(0);
    const port = serverInstance.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await stopServer();

    // Restore original files (or remove if they did not exist prior to test)
    if (originalConfig !== null) {
      fs.writeFileSync(configFile, originalConfig, 'utf8');
    } else if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
    if (originalCampaigns !== null) {
      fs.writeFileSync(campaignsFile, originalCampaigns, 'utf8');
    } else if (fs.existsSync(campaignsFile)) {
      fs.unlinkSync(campaignsFile);
    }
  });

  test('GET /favicon.ico returns 200 with SVG content-type', async () => {
    const res = await fetch(`${baseUrl}/favicon.ico`);
    assert.strictEqual(res.status, 200, 'favicon should return 200');

    const contentType = res.headers.get('content-type') || '';
    assert.match(contentType, /image\/svg\+xml/, 'favicon should be SVG');

    const body = await res.text();
    assert.ok(body.includes('<svg'), 'body should contain SVG root tag');
  });

  test('GET /api/config returns 200 with JSON configuration object', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.ok(data && typeof data === 'object');
    assert.ok('activationMethod' in data, 'config should contain activationMethod');
    assert.ok('d1DatabaseId' in data, 'config should contain d1DatabaseId');
    assert.ok('thresholdCount' in data, 'config should contain thresholdCount');
  });

  test('POST /api/config saves configuration updates', async () => {
    const updatePayload = {
      apiToken: 'test_token_123',
      accountId: 'test_account_456',
      activationMethod: 'visitor_threshold',
      defaultScrollPct: 25,
      defaultTrigger: 'both',
      thresholdCount: 10,
      autoCreateWww: true
    };

    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.config.thresholdCount, 10);
    assert.strictEqual(data.config.defaultScrollPct, 25);

    // Verify GET /api/config returns updated values
    const verifyRes = await fetch(`${baseUrl}/api/config`);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.thresholdCount, 10);
  });

  test('GET /api/campaigns returns 200 with campaign list', async () => {
    const res = await fetch(`${baseUrl}/api/campaigns`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.campaigns), 'campaigns should be an array');
  });

  test('POST /api/campaigns creates a new campaign record and validates input', async () => {
    // 1. Missing name returns 400
    const badRes1 = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safeUrl: 'https://safe.com', moneyUrl: 'https://money.com' })
    });
    assert.strictEqual(badRes1.status, 400);
    const badData1 = await badRes1.json();
    assert.ok(badData1.error);

    // 2. Missing safeUrl returns 400
    const badRes2 = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Campaign 1', moneyUrl: 'https://money.com' })
    });
    assert.strictEqual(badRes2.status, 400);

    // 3. Valid creation returns 201
    const validRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Campaign',
        safeUrl: 'https://safe.example.com/article',
        moneyUrl: 'https://money.example.com/offer'
      })
    });
    assert.strictEqual(validRes.status, 201);
    const validData = await validRes.json();
    assert.strictEqual(validData.success, true);
    assert.strictEqual(validData.campaign.name, 'Automated Test Campaign');
    assert.ok(validData.campaign.id);
  });

  test('DELETE /api/campaigns/:id handles existing and nonexistent IDs safely', async () => {
    // Delete non-existent ID
    const res1 = await fetch(`${baseUrl}/api/campaigns/non-existent-campaign-${Date.now()}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert.strictEqual(data1.success, true);

    // Create a temporary campaign then delete it
    const createRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'To Delete Campaign',
        safeUrl: 'https://safe.com',
        moneyUrl: 'https://money.com'
      })
    });
    const created = await createRes.json();
    const tempId = created.campaign.id;

    const deleteRes = await fetch(`${baseUrl}/api/campaigns/${tempId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 200);
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteData.success, true);
  });

  test('POST /api/generate returns 200 with worker code and robots preview', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceDomain: 'testsite.com',
        targetDomain: 'offertarget.com',
        activationMethod: 'visitor_threshold',
        thresholdCount: 5,
        sitemaps: ['https://testsite.com/sitemap_index.xml']
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.workerCode === 'string' && data.workerCode.length > 100);
    assert.ok(typeof data.robotsTxt === 'string' && data.robotsTxt.includes('Pinterestbot'));
  });

  test('POST /api/generate returns 400 when missing sourceDomain or targetDomain', async () => {
    const res1 = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceDomain: 'testsite.com' })
    });
    assert.strictEqual(res1.status, 400);
    const data1 = await res1.json();
    assert.strictEqual(data1.success, false);

    const res2 = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDomain: 'target.com' })
    });
    assert.strictEqual(res2.status, 400);
  });

  test('GET /api/zones returns 200 or handles unauthenticated CF token gracefully', async () => {
    // Query with explicit invalid token should be rejected gracefully by Cloudflare (400 or 500)
    const res = await fetch(`${baseUrl}/api/zones?token=invalid_dummy_token_12345`);
    assert.ok(res.status === 400 || res.status === 500 || res.status === 200);
    const data = await res.json();
    assert.ok(data && typeof data === 'object');
    if (!data.success) {
      assert.ok(data.message, 'error response should provide a message');
    }
  });

  test('POST /api/verify-cf handles credentials verification safely without crashing', async () => {
    const res = await fetch(`${baseUrl}/api/verify-cf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiToken: 'dummy_nonexistent_token' })
    });

    assert.ok(res.status === 200 || res.status === 400);
    const data = await res.json();
    assert.ok(data && typeof data === 'object');
    assert.strictEqual(typeof data.success, 'boolean');
  });

  test('GET /api/analytics/posts handles queries safely', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/posts`);
    assert.ok([200, 400, 500].includes(res.status));
    const data = await res.json();
    assert.ok(data && typeof data === 'object');
  });

  test('POST /api/analytics/simulate handles simulation safely', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postPath: '/test-post-slug/', count: 2, country: 'US' })
    });

    assert.ok([200, 400, 500].includes(res.status));
    const data = await res.json();
    assert.ok(data && typeof data === 'object');
  });

  test('POST /api/analytics/reset handles reset safely', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.ok([200, 400, 500].includes(res.status));
    const data = await res.json();
    assert.ok(data && typeof data === 'object');
  });
});
