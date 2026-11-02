const fs = require('fs');
const path = require('path');

// Read server.js and extract buildWorkerCode
const serverCode = fs.readFileSync('server.js', 'utf8');

// We can require server.js's buildWorkerCode by evaluating it or running a test
const testConfig = {
  sourceDomain: 'homeandrecipe.com',
  targetDomain: 'https://asqstyle.com',
  activationMethod: 'visitor_threshold',
  thresholdCount: 4,
  scrollPct: 15,
  triggerCondition: 'both',
  includeWww: true
};

console.log('Testing code compilation...');
