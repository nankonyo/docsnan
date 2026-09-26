#!/usr/bin/env node
// docsnan — version detection + safe update (offline-friendly, no deps).
//
// Version source: package.json "version" (single source of truth).
// Latest source: npm registry (`npm view docsnan version`), fallback to
// GitHub tags (`git ls-remote --tags`). No curl|sh, no arbitrary remote exec.
// Update path matches install mode: git checkout -> `git pull --ff-only`
// (refuses dirty tree); npm install -> `npm install docsnan@latest`.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PKG_PATH = path.join(__dirname, '..', 'package.json');
const REPO_URL = 'https://github.com/nankonyo/docsnan.git';

function getInstalledVersion(pkgPath = PKG_PATH) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch (e) {
    return null;
  }
}

function parseVersion(v) {
  const m = String(v || '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
}

// -1 if a<b, 0 if equal, 1 if a>b. Non-parseable -> 0 (treat as equal).
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

function run(cmd, args, { timeout = 15000, cwd } = {}) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout, cwd });
    return { status: r.status, stdout: String(r.stdout || '').trim(), stderr: String(r.stderr || '').trim() };
  } catch (e) {
    return { status: 1, stdout: '', stderr: String((e && e.message) || e) };
  }
}

function getNpmLatest(runner = run) {
  const r = runner('npm', ['view', 'docsnan', 'version']);
  const v = (r.stdout || '').trim();
  return r.status === 0 && parseVersion(v) ? v : null;
}

function getGitTagLatest(runner = run) {
  const r = runner('git', ['ls-remote', '--tags', REPO_URL]);
  if (r.status !== 0) return null;
  const versions = [];
  for (const line of String(r.stdout || '').split('\n')) {
    const m = line.match(/refs\/tags\/v?(\d+\.\d+\.\d+)(?:\^\{\})?$/);
    if (m && parseVersion(m[1])) versions.push(m[1]);
  }
  versions.sort(compareVersions);
  return versions.length ? versions[versions.length - 1] : null;
}

// runGitTagLatest/getNpmLatest injectable for tests. Returns { installed, latest, source }.
function getLatestVersion({ runner = run } = {}) {
  const npm = getNpmLatest(runner);
  if (npm) return { latest: npm, source: 'npm' };
  const tag = getGitTagLatest(runner);
  if (tag) return { latest: tag, source: 'github-tags' };
  return { latest: null, source: null };
}

// Detect how this copy was installed: git checkout vs npm package.
function detectInstallMode({ root = path.join(__dirname, '..'), runner = run } = {}) {
  try {
    if (fs.statSync(path.join(root, '.git')).isDirectory()) return 'git';
  } catch (e) { /* not a checkout */ }
  return 'npm';
}

function isWorktreeDirty({ root = path.join(__dirname, '..'), runner = run } = {}) {
  const r = runner('git', ['status', '--porcelain'], { cwd: root });
  if (r.status !== 0) return false; // can't tell -> don't block on unknown
  return String(r.stdout || '').trim().length > 0;
}

function checkUpdate({ runner = run } = {}) {
  const installed = getInstalledVersion();
  const { latest, source } = getLatestVersion({ runner });
  if (!installed) return { installed, latest, source, needed: false, reason: 'cannot-read-package-json' };
  if (!latest) return { installed, latest, source, needed: false, reason: 'latest-unknown-offline-or-unpublished' };
  const cmp = compareVersions(installed, latest);
  if (cmp >= 0) return { installed, latest, source, needed: false, reason: 'up-to-date' };
  return { installed, latest, source, needed: true, reason: 'update-available' };
}

// Safe update. Never deletes user files. Returns { ok, ... }.
function performUpdate({ runner = run, root = path.join(__dirname, '..') } = {}) {
  const before = checkUpdate({ runner });
  if (!before.installed) return { ok: false, ...before, error: 'Cannot read installed version.' };
  if (!before.latest) {
    return { ok: false, ...before, error: 'Latest version unknown (offline or unpublished). Installation preserved.' };
  }
  if (!before.needed) return { ok: true, ...before, message: `Docsnan already up to date (${before.installed}).` };

  const mode = detectInstallMode({ root, runner });
  if (mode === 'git') {
    if (isWorktreeDirty({ root, runner })) {
      return { ok: false, ...before, error: 'Worktree has local changes. Commit or stash first; update aborted.' };
    }
    const pull = runner('git', ['pull', '--ff-only'], { cwd: root });
    if (pull.status !== 0) {
      return { ok: false, ...before, error: `git pull failed: ${(pull.stderr || pull.stdout || 'unknown error').slice(0, 200)}` };
    }
  } else {
    const inst = runner('npm', ['install', `docsnan@${before.latest}`], { cwd: root });
    if (inst.status !== 0) {
      return { ok: false, ...before, error: `npm install failed: ${(inst.stderr || inst.stdout || 'unknown error').slice(0, 200)}` };
    }
  }
  const installed = getInstalledVersion();
  if (compareVersions(installed, before.latest) !== 0) {
    return { ok: false, ...before, installed, error: `Verify failed: still at ${installed}. Previous install preserved.` };
  }
  return { ok: true, ...before, installed, message: `Docsnan updated ${before.installed} -> ${installed}.` };
}

module.exports = {
  PKG_PATH,
  REPO_URL,
  getInstalledVersion,
  parseVersion,
  compareVersions,
  getNpmLatest,
  getGitTagLatest,
  getLatestVersion,
  detectInstallMode,
  isWorktreeDirty,
  checkUpdate,
  performUpdate,
};

if (require.main === module) {
  const cmd = String(process.argv[2] || 'check').toLowerCase();
  if (cmd === 'version' || cmd === '-v' || cmd === '--version') {
    console.log(getInstalledVersion() || 'unknown');
  } else if (cmd === 'check') {
    const r = checkUpdate();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.needed ? 2 : 0);
  } else if (cmd === 'update') {
    const r = performUpdate();
    if (r.ok) console.log(r.message);
    else console.error('Error: ' + (r.error || r.reason));
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error('Usage: docsnan-update.js [version|check|update]');
    process.exit(1);
  }
}
