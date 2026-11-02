const http = require('http');

const data = JSON.stringify({
  sourceDomain: 'homeandrecipe.com',
  targetDomain: 'https://asqstyle.com',
  activationMethod: 'visitor_threshold',
  thresholdCount: 4,
  includeWww: true
});

const req = http.request('http://localhost:3000/api/deploy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(body);
      console.log('Response:', JSON.stringify(parsed, null, 2));
    } catch(e) {
      console.log('Body:', body);
    }
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err);
});

req.write(data);
req.end();
