const https = require('https');

function hitSlug(slug, visitorId) {
  return new Promise((resolve, reject) => {
    https.get('https://homeandrecipe.com' + slug, {
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36 User-${visitorId}`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          hasRedirectScript: body.includes('ACTIVATION_METHOD = "visitor_threshold"'),
          cacheControl: res.headers['cache-control'] || ''
        });
      });
    }).on('error', reject);
  });
}

async function verify() {
  const testSlug = `/live-check-${Date.now()}/`;
  console.log(`Testing fresh slug: ${testSlug}`);

  for (let i = 1; i <= 4; i++) {
    const res = await hitSlug(testSlug, i);
    console.log(`Visit #${i}: Status ${res.statusCode} | Has Redirect Script: ${res.hasRedirectScript} | Cache-Control: ${res.cacheControl}`);
    if (i < 4 && res.hasRedirectScript) {
      throw new Error(`Visit #${i} prematurely triggered redirect script!`);
    }
    if (i === 4 && !res.hasRedirectScript) {
      throw new Error(`Visit #4 failed to trigger redirect script!`);
    }
  }

  console.log('✅ 4-Visitor Threshold works 100% as expected!');
}

verify().catch(console.error);
