async function testLiveSimulation() {
  const testSlug = '/test-visitor-condition-' + Date.now() + '/';
  console.log('Testing fresh slug:', testSlug);

  // 1. Check initial count
  const res1 = await fetch('http://localhost:5050/api/analytics/posts');
  const d1 = await res1.json();
  const foundBefore = d1.posts.find(p => p.post_path === testSlug);
  console.log('Before simulation:', foundBefore || 'Not present (0 visits)');

  // 2. Simulate 1 human visit
  const simRes = await fetch('http://localhost:5050/api/analytics/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postPath: testSlug, count: 1 })
  });
  const simData = await simRes.json();
  console.log('Simulation response:', simData.message);

  // 3. Verify in DB via analytics
  const res2 = await fetch('http://localhost:5050/api/analytics/posts');
  const d2 = await res2.json();
  const foundAfter = d2.posts.find(p => p.post_path === testSlug);
  console.log('After simulation:', foundAfter);

  // 4. Simulate 7 more visits to reach 8 (threshold)
  await fetch('http://localhost:5050/api/analytics/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postPath: testSlug, count: 7 })
  });
  const res3 = await fetch('http://localhost:5050/api/analytics/posts');
  const d3 = await res3.json();
  const foundThreshold = d3.posts.find(p => p.post_path === testSlug);
  console.log('After 8 visits (Threshold 8):', foundThreshold);
}

testLiveSimulation().catch(console.error);
