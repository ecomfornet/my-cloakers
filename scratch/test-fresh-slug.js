const https = require('https');

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.get('https://homeandrecipe.com' + urlPath, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          hasScript: body.includes('Cloaker Active') || body.includes('onThresholdRedirect'),
          bodyLength: body.length
        });
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  const testSlug = '/test-slug-' + Math.floor(Math.random() * 100000) + '/';
  console.log(`=== Testing Fresh Slug: ${testSlug} ===`);

  for (let i = 1; i <= 4; i++) {
    const res = await fetchUrl(testSlug);
    console.log(`Visit #${i}: Status ${res.statusCode}, Has Script: ${res.hasScript}, Size: ${res.bodyLength} bytes`);
    if (i < 4 && res.hasScript) {
      console.error(`FAIL: Visit #${i} injected script before threshold 4!`);
      process.exit(1);
    }
    if (i === 4 && !res.hasScript) {
      console.error(`FAIL: Visit #4 did NOT inject script at threshold 4!`);
      process.exit(1);
    }
  }

  console.log(`✅ SUCCESS! Visits 1-3 got clean origin HTML without cloaker script.`);
  console.log(`✅ SUCCESS! Visit 4 activated cloaker script exactly at threshold 4.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
