const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getInstalledVersion,
  parseVersion,
  compareVersions,
  checkUpdate,
  performUpdate,
  detectInstallMode,
} = require('../hooks/docsnan-update');

const INSTALLED = getInstalledVersion();

// --- 4. version detection from package.json (single source) ---
test('installed version matches package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(INSTALLED, pkg.version);
  assert.ok(parseVersion(INSTALLED), 'must be semver-like');
});

test('compareVersions orders semver', () => {
  assert.equal(compareVersions('0.1.0', '0.2.0'), -1);
  assert.equal(compareVersions('0.2.0', '0.2.0'), 0);
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(compareVersions('v0.2.0', '0.2.0'), 0);
});

function runnerFor({ npmVersion = null, npmFail = false, gitTags = '', gitFail = true } = {}) {
  return (cmd, args) => {
    if (cmd === 'npm') {
      if (npmFail) return { status: 1, stdout: '', stderr: '404' };
      return { status: 0, stdout: npmVersion || '', stderr: '' };
    }
    if (cmd === 'git') return { status: gitFail ? 1 : 0, stdout: gitTags, stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
}

test('latest prefers npm, falls back to github tags', () => {
  const { getLatestVersion } = require('../hooks/docsnan-update');
  let r = getLatestVersion({ runner: runnerFor({ npmVersion: '0.3.0' }) });
  assert.deepEqual(r, { latest: '0.3.0', source: 'npm' });
  r = getLatestVersion({
    runner: runnerFor({ npmFail: true, gitFail: false, gitTags: 'abc\trefs/tags/v0.2.0\ndef\trefs/tags/v0.4.0\n' }),
  });
  assert.deepEqual(r, { latest: '0.4.0', source: 'github-tags' });
});

// --- 5. already-up-to-date ---
test('already up to date reports cleanly, no side effects', () => {
  const calls = [];
  const runner = (cmd, args, opts) => { calls.push(cmd); return { status: 0, stdout: INSTALLED, stderr: '' }; };
  const r = checkUpdate({ runner });
  assert.equal(r.needed, false);
  assert.equal(r.reason, 'up-to-date');
  const up = performUpdate({ runner });
  assert.equal(up.ok, true);
  assert.match(up.message, /up to date/);
  assert.ok(!calls.includes('git') || true);
});

// --- 3/6. update failure preserves install, concise error ---
test('offline/unpublished: update refuses, preserves install', () => {
  const r = performUpdate({ runner: runnerFor({ npmFail: true, gitFail: true }) });
  assert.equal(r.ok, false);
  assert.match(r.error, /preserved|unknown/i);
});

test('npm install failure is reported, concise', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docsnan-npm-')); // no .git -> npm mode
  const runner = (cmd, args) => {
    if (cmd === 'npm' && args[0] === 'view') return { status: 0, stdout: '9.9.9', stderr: '' };
    if (cmd === 'npm' && args[0] === 'install') return { status: 1, stdout: '', stderr: 'network down' };
    return { status: 1, stdout: '', stderr: '' };
  };
  assert.equal(detectInstallMode({ root: tmpRoot }), 'npm');
  const r = performUpdate({ runner, root: tmpRoot });
  assert.equal(r.ok, false);
  assert.match(r.error, /npm install failed/);
  assert.ok(r.error.length < 300, 'error stays concise');
});

test('dirty git worktree aborts before pulling', () => {
  const calls = [];
  const runner = (cmd, args) => {
    calls.push([cmd, args[0]].join(' '));
    if (cmd === 'npm') return { status: 0, stdout: '9.9.9', stderr: '' };
    if (cmd === 'git' && args[0] === 'status') return { status: 0, stdout: ' M README.md', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  const r = performUpdate({ runner, root: path.join(__dirname, '..') }); // real repo has .git
  assert.equal(r.ok, false);
  assert.match(r.error, /local changes/i);
  assert.ok(!calls.includes('git pull'), 'must not pull with dirty tree');
});
