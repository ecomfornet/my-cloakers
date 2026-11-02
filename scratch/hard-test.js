const fs = require('fs');

async function runHardTest() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE HARD TESTS FOR ALL SLUGS & REDIRECTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: HOMEPAGE (/) - 73+ VISITS (THRESHOLD EXCEEDED)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Homepage (https://homeandrecipe.com/) ---');
  const homeRes = await fetch('https://homeandrecipe.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }
  });
  const homeHtml = await homeRes.text();
  const homeHasRedirect = homeHtml.includes('ACTIVATION_METHOD = "visitor_threshold"');
  const homeTarget = (homeHtml.match(/var target = "([^"]+)";/) || [])[1];
  console.log(`  HTTP Status: ${homeRes.status}`);
  console.log(`  Redirect Active: ${homeHasRedirect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Target URL: ${homeTarget} (Expected: https://asqstyle.com/)`);

  // -------------------------------------------------------------------------
  // TEST 2: EXISTING SLUG (/about/) - 24 VISITS (THRESHOLD EXCEEDED)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Existing Slug (https://homeandrecipe.com/about/) ---');
  const aboutRes = await fetch('https://homeandrecipe.com/about/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }
  });
  const aboutHtml = await aboutRes.text();
  const aboutHasRedirect = aboutHtml.includes('ACTIVATION_METHOD = "visitor_threshold"');
  const aboutTarget = (aboutHtml.match(/var target = "([^"]+)";/) || [])[1];
  console.log(`  HTTP Status: ${aboutRes.status}`);
  console.log(`  Redirect Active on /about/: ${aboutHasRedirect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Target URL for /about/: ${aboutTarget} (Expected: https://asqstyle.com/about/)`);

  // -------------------------------------------------------------------------
  // TEST 3: QUERY PARAMETERS PRESERVATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Query Parameter Preservation on Slug ---');
  const queryUrl = 'https://homeandrecipe.com/about/?utm_source=pinterest&pin_id=12345';
  const queryRes = await fetch(queryUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }
  });
  const queryHtml = await queryRes.text();
  const queryTarget = (queryHtml.match(/var target = "([^"]+)";/) || [])[1];
  console.log(`  Requested: ${queryUrl}`);
  console.log(`  Target URL: ${queryTarget}`);
  console.log(`  Query Preserved: ${queryTarget && queryTarget.includes('utm_source=pinterest&pin_id=12345') ? '✅ PASS' : '❌ FAIL'}`);

  // -------------------------------------------------------------------------
  // TEST 4: BRAND NEW SLUG PROGRESSION (VISITS 1, 2, 3 -> CLEAN; VISIT 4 -> REDIRECT)
  // -------------------------------------------------------------------------
  const randSlug = '/fresh-test-' + Math.random().toString(36).substring(2, 9) + '/';
  console.log(`\n--- TEST 4: Brand New Slug Progression Test (${randSlug}) ---`);

  for (let i = 1; i <= 5; i++) {
    const slugUrl = `https://homeandrecipe.com${randSlug}`;
    const slugRes = await fetch(slugUrl, {
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestVisitor/${i} Safari/537.36`
      }
    });
    const slugHtml = await slugRes.text();
    const hasScript = slugHtml.includes('ACTIVATION_METHOD = "visitor_threshold"');
    const targetUrl = (slugHtml.match(/var target = "([^"]+)";/) || [])[1];

    if (i < 4) {
      console.log(`  Visit #${i}: Redirect Active: ${hasScript} | ${!hasScript ? '✅ PASS (Clean Origin HTML - Sub-Threshold)' : '❌ FAIL'}`);
    } else {
      console.log(`  Visit #${i} (Threshold Reached!): Redirect Active: ${hasScript} | Target: ${targetUrl} | ${hasScript && targetUrl.includes(randSlug) ? '✅ PASS (Redirects to exact slug!)' : '❌ FAIL'}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 5: CRAWLER & AD BOT DEFENSE (Pinterestbot & Googlebot)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Crawler Isolation on Active Threshold Slugs ---');
  const botUAs = [
    { name: 'Pinterestbot', ua: 'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)' },
    { name: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
  ];
  for (const bot of botUAs) {
    const bRes = await fetch('https://homeandrecipe.com/about/', { headers: { 'User-Agent': bot.ua } });
    const bHtml = await bRes.text();
    const bHasScript = bHtml.includes('ACTIVATION_METHOD') || bHtml.includes('[CF Worker]');
    console.log(`  ${bot.name} on /about/: Has Redirect Script: ${bHasScript} | ${!bHasScript ? '✅ PASS (Clean Origin WordPress, Zero Redirect)' : '❌ FAIL'}`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL HARD TESTS COMPLETE!');
  console.log('================================================================');
}

runHardTest().catch(console.error);
