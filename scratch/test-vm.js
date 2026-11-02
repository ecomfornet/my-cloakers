const fs = require('fs');

async function testPageExecution() {
  const res = await fetch('https://homeandrecipe.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  console.log('HTML size:', html.length);

  // Extract the injected script
  const start = html.indexOf('<script>\n(function() {');
  const end = html.indexOf('</script>', start);
  const scriptContent = html.substring(start + 8, end);
  console.log('Script size:', scriptContent.length);

  // Check script syntax using node vm
  const vm = require('vm');
  const context = {
    window: {
      location: {
        replace: function(url) { console.log('window.location.replace called with:', url); },
        href: ''
      },
      addEventListener: function(evt, fn) { console.log('addEventListener:', evt); },
      outerWidth: 1920,
      outerHeight: 1080
    },
    navigator: {
      webdriver: false,
      languages: ['en-US', 'en']
    },
    document: {
      documentElement: {
        getAttribute: function() { return null; }
      }
    },
    history: {},
    setInterval: function(fn, ms) { return 1; },
    clearInterval: function(id) {},
    setTimeout: function(fn, ms) {
      console.log('setTimeout called with ms:', ms);
      fn();
    },
    console: console,
    Error: Error
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;
  context.window.history = context.history;

  try {
    vm.runInNewContext(scriptContent, context);
    console.log('VM execution finished successfully!');
  } catch(e) {
    console.error('VM execution ERROR:', e);
  }
}

testPageExecution();
