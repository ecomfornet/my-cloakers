const fs = require('fs');
const content = fs.readFileSync('scratch/current-deployed-script.js', 'utf8');

// The script in current-deployed-script.js is multipart form-data format returned by CF
// Extract just the JS portion
const boundary = content.split('\n')[0].trim();
const parts = content.split(boundary);
for (const part of parts) {
  if (part.includes('name="worker.js"')) {
    const headerEnd = part.indexOf('\r\n\r\n');
    const headerEndAlt = part.indexOf('\n\n');
    const splitPoint = headerEnd !== -1 ? headerEnd + 4 : headerEndAlt + 2;
    const js = part.substring(splitPoint).trim();
    fs.writeFileSync('src/index.js', js, 'utf8');
    console.log('src/index.js updated! Length:', js.length);
    break;
  }
}
