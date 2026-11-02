async function checkAnalyticsApi() {
  const res = await fetch('http://localhost:5050/api/analytics/posts');
  const data = await res.json();
  console.log('--- API /api/analytics/posts ---');
  console.log('Threshold returned:', data.threshold);
  console.log('Stats:', data.stats);
  console.log('Top 5 posts:');
  console.table(data.posts.slice(0, 5));
}

checkAnalyticsApi().catch(console.error);
