const { test } = require('node:test');
const assert = require('node:assert/strict');
const { routeCommand } = require('../hooks/docsnan-command');

test('bare /docsnan reports status without changing mode', () => {
  assert.deepEqual(routeCommand(''), { action: 'status' });
  assert.deepEqual(routeCommand('   '), { action: 'status' });
});

test('/docsnan on works', () => {
  assert.deepEqual(routeCommand('on'), { action: 'mode', mode: 'on' });
  assert.deepEqual(routeCommand(' ON '), { action: 'mode', mode: 'on' });
});

test('/docsnan off works', () => {
  assert.deepEqual(routeCommand('off'), { action: 'mode', mode: 'off' });
  assert.deepEqual(routeCommand('Off'), { action: 'mode', mode: 'off' });
});

test('/docsnan update routes to update, not mode change', () => {
  assert.deepEqual(routeCommand('update'), { action: 'update' });
  assert.deepEqual(routeCommand('UPDATE'), { action: 'update' });
});

test('/docsnan version routes to version', () => {
  assert.deepEqual(routeCommand('version'), { action: 'version' });
  assert.deepEqual(routeCommand('-v'), { action: 'version' });
  assert.deepEqual(routeCommand('--version'), { action: 'version' });
});

test('unknown arg is explicit, never silently a mode change', () => {
  const r = routeCommand('banana');
  assert.equal(r.action, 'unknown');
  assert.equal(r.arg, 'banana');
});
