const { startServer, stopServer } = require('../../../server.js');

async function main() {
  const srv = await startServer(0);
  const port = srv.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. Malformed JSON to /api/campaigns
  const r1 = await fetch(`${baseUrl}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"bad": broken-json'
  });
  console.log('/api/campaigns malformed json status:', r1.status);
  const j1 = await r1.json();
  console.log('/api/campaigns malformed json error exists:', typeof j1.error === 'string');

  // 2. Malformed JSON to /api/generate
  const r2 = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"incomplete'
  });
  console.log('/api/generate malformed json status:', r2.status);
  const j2 = await r2.json();
  console.log('/api/generate malformed json error exists:', typeof j2.error === 'string');

  // 3. /cloaker/check with empty user-agent
  const r3 = await fetch(`${baseUrl}/cloaker/check`);
  const j3 = await r3.json();
  console.log('/cloaker/check empty UA destination:', j3.destination, 'isBot:', j3.isBot);

  // 4. Unknown route 404
  const r4 = await fetch(`${baseUrl}/nonexistent/${Date.now()}`);
  console.log('404 route status:', r4.status);
  const j4 = await r4.json();
  console.log('404 error message:', j4.error);

  await stopServer();
  console.log('Adversarial probe completed cleanly');
}

main().catch((err) => {
  console.error('Adversarial probe failure:', err);
  process.exit(1);
});
