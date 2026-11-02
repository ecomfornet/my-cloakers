process.env.NODE_ENV = 'test';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');

describe('Server Startup & Modular Export', () => {
  let mod;

  afterEach(async () => {
    if (mod && typeof mod.stopServer === 'function') {
      await mod.stopServer();
    }
  });

  test('requiring server.js exports { app, server, startServer, stopServer } without auto-binding port', async () => {
    mod = require('../server.js');

    assert.ok(mod, 'server module should be defined');
    assert.strictEqual(typeof mod.app, 'function', 'app should be an Express application function');
    assert.strictEqual(typeof mod.startServer, 'function', 'startServer should be a function');
    assert.strictEqual(typeof mod.stopServer, 'function', 'stopServer should be a function');
    assert.strictEqual(typeof mod.server, 'function', 'server should be an exported getter function');

    // Server should not be listening immediately upon require
    const activeServer = mod.server();
    assert.strictEqual(activeServer, null, 'server should not be actively listening upon require');

    // Verify port 5050 is not occupied by this process
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // If port 5050 is occupied by something else unrelated, we note it, but our server shouldn't hold it
          resolve();
        } else {
          reject(err);
        }
      });
      probe.once('listening', () => {
        probe.close(resolve);
      });
      probe.listen(5050, '127.0.0.1');
    });
  });

  test('calling startServer(0) binds an ephemeral port cleanly and returns listening HTTP server', async () => {
    mod = require('../server.js');

    const srv = await mod.startServer(0);
    assert.ok(srv, 'startServer(0) should return server instance');
    assert.ok(srv.listening, 'server instance should be listening');

    const addr = srv.address();
    assert.ok(addr, 'server should have an address');
    assert.strictEqual(typeof addr.port, 'number', 'address should have a port number');
    assert.ok(addr.port > 0, `assigned port should be greater than 0, got ${addr.port}`);

    // mod.server() should return the active server instance
    const currentServer = mod.server();
    assert.strictEqual(currentServer, srv, 'mod.server() should return active server');
  });

  test('calling stopServer() shuts down cleanly without hanging', async () => {
    mod = require('../server.js');

    const srv = await mod.startServer(0);
    assert.ok(srv.listening, 'server should be listening before shutdown');

    const stopPromise = mod.stopServer();
    assert.ok(stopPromise instanceof Promise, 'stopServer should return a Promise');

    await stopPromise;
    assert.strictEqual(srv.listening, false, 'server should no longer be listening');
    assert.strictEqual(mod.server(), null, 'mod.server() should return null after stopServer()');

    // Subsequent stopServer() call should resolve cleanly (idempotent)
    await assert.doesNotReject(async () => {
      await mod.stopServer();
    }, 'subsequent stopServer() calls should be idempotent');
  });

  test('calling startServer(occupiedPort) rejects with EADDRINUSE', async () => {
    mod = require('../server.js');

    // Occupy an ephemeral port first with a separate net server
    const dummyServer = net.createServer();
    const occupiedPort = await new Promise((resolve) => {
      dummyServer.listen(0, () => {
        resolve(dummyServer.address().port);
      });
    });

    try {
      await assert.rejects(
        async () => {
          await mod.startServer(occupiedPort);
        },
        (err) => {
          assert.strictEqual(err.code, 'EADDRINUSE');
          return true;
        },
        'startServer should reject with EADDRINUSE when port is occupied'
      );
    } finally {
      await new Promise((resolve) => dummyServer.close(resolve));
    }
  });

  test('server can be restarted on a new ephemeral port after stopServer()', async () => {
    mod = require('../server.js');

    const srv1 = await mod.startServer(0);
    const port1 = srv1.address().port;
    await mod.stopServer();

    const srv2 = await mod.startServer(0);
    const port2 = srv2.address().port;
    assert.ok(srv2.listening, 'second server instance should be listening');
    assert.ok(port2 > 0, 'second server should have valid port');

    await mod.stopServer();
  });
});
