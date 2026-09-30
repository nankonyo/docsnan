const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isHistoryQuery,
  parseLogContent,
  selectLogs,
  listLogsNewestFirst,
  timestampFromFilename,
  timestampFromLogPath,
  slugFromLogName,
} = require('../hooks/docsnan-retrieve');

function mktmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'docsnan-'));
}

function write(dir, name, body) {
  const full = path.join(dir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
  return full;
}

const LOG = (title, type, changed) =>
  `Judul: ${title}\nTipe: ${type}\nWaktu: 2026-09-26 10:00:00\nRingkasan: Ringkasan ${title}.\nUbah:\n- ${changed}\nUji: npm test lolos.\n`;

// --- 7. historical intent detection (ID + EN from spec) ---
test('history questions trigger retrieval', () => {
  const positives = [
    'What was changed recently?',
    'What did we fix yesterday?',
    'What was the latest authentication update?',
    'Did we already fix the login problem?',
    'What have we worked on recently?',
    'Why was this file changed?',
    'What was the previous implementation?',
    'What did the previous agent do?',
    'Show me the latest changes related to authentication.',
    'What happened in the previous task?',
    'What did we change in the last session?',
    'Apa yang diubah kemarin?',
    'Apa yang sudah difix?',
    'Siapa—eh, apa yang agent sebelumnya lakukan?',
  ];
  for (const q of positives) assert.equal(isHistoryQuery(q), true, q);
});

// --- 14. normal coding requests stay dormant ---
test('normal coding requests do NOT trigger retrieval', () => {
  const negatives = [
    'Buatkan fungsi login baru.',
    'Tambahkan cache untuk API ini.',
    'Fix login null saat password kosong.',
    'Refactor auth middleware.',
    'Jelaskan cara kerja connection pooling.',
    'Halo, apa kabar?',
  ];
  for (const q of negatives) assert.equal(isHistoryQuery(q), false, q);
});

// --- 8/9/10. selection, newest-first, keyword relevance ---
test('keyword relevance beats older logs; ties newest-first', () => {
  const dir = mktmp();
  write(dir, 'fix-login_20260925-100000.log', LOG('Fix login null', 'fix', 'auth/login.js: guard kosong.'));
  write(dir, 'tambah-cache_20260926-100000.log', LOG('Tambah cache API', 'fitur', 'api/cache.js: lru cache.'));
  write(dir, 'update-auth_20260926-110000.log', LOG('Update auth middleware', 'refactor', 'auth/middleware.js: cek expiry.'));
  const hits = selectLogs({ dir, query: 'What did we change recently in authentication?', limit: 3 });
  assert.ok(hits.length >= 1);
  // auth-related logs rank above the unrelated cache log
  const names = hits.map((h) => h.name);
  assert.ok(!names.includes('tambah-cache_20260926-100000.log') || names[names.length - 1] === 'tambah-cache_20260926-100000.log');
  assert.ok(names[0].includes('update-auth') || names[0].includes('fix-login'));
});

test('changed-file matching finds logs by filename in Ubah field', () => {
  const dir = mktmp();
  write(dir, 'a_20260925-100000.log', LOG('Sesuatu', 'lainnya', 'other/thing.js: ubah.'));
  write(dir, 'b_20260926-100000.log', LOG('Sesuatu lain', 'lainnya', 'auth/login.js: ubah guard.'));
  const hits = selectLogs({ dir, query: 'Why was auth/login.js changed?', limit: 3 });
  assert.equal(hits.length, 1);
  assert.ok(hits[0].name.startsWith('b_'));
});

test('generic history query returns newest logs first', () => {
  const dir = mktmp();
  write(dir, 'a_20260924-100000.log', LOG('A', 'fix', 'a.js.'));
  write(dir, 'b_20260926-120000.log', LOG('B', 'fix', 'b.js.'));
  const listed = listLogsNewestFirst(dir).map((l) => l.name);
  assert.deepEqual(listed, ['b_20260926-120000.log', 'a_20260924-100000.log']);
  const hits = selectLogs({ dir, query: 'What was changed recently?', limit: 1 });
  assert.equal(hits[0].name, 'b_20260926-120000.log');
});

// --- 11. empty docs/ ---
test('empty docs dir returns no logs', () => {
  const dir = mktmp();
  assert.deepEqual(selectLogs({ dir, query: 'What changed recently?' }), []);
  assert.deepEqual(selectLogs({ dir: path.join(dir, 'nope'), query: 'What changed recently?' }), []);
});

// --- 12. malformed logs ---
test('malformed logs never crash, filename still ranks', () => {
  const dir = mktmp();
  write(dir, 'fix-login_20260926-100000.log', 'this is not a valid log {{{');
  const hits = selectLogs({ dir, query: 'Did we already fix the login problem?', limit: 3 });
  assert.equal(hits.length, 1);
  assert.ok(hits[0].name.includes('fix-login'));
  const parsed = parseLogContent('garbage{{{');
  assert.equal(parsed.title, '');
  assert.deepEqual(parsed.changed, []);
});

// --- 13. large numbers of logs ---
test('200 logs: fast, limited, newest-first', () => {
  const dir = mktmp();
  for (let i = 0; i < 200; i++) {
    const day = String(1 + (i % 28)).padStart(2, '0');
    write(dir, `task-${String(i).padStart(3, '0')}_202609${day}-100000.log`, LOG(`Task ${i}`, 'lainnya', `file${i}.js.`));
  }
  const t0 = Date.now();
  const hits = selectLogs({ dir, query: 'What was changed recently?', limit: 3 });
  assert.ok(Date.now() - t0 < 5000, 'must stay fast');
  assert.equal(hits.length, 3);
});

// --- v0.3: Files/Tags parse, EN aliases, old format stays readable ---
test('parse Files/Tags + EN aliases; old logs stay readable', () => {
  const p1 = parseLogContent('Judul: A\nTipe: fix\nWaktu: 2026-09-26 10:00:00\nRingkasan: R.\nUbah:\n- a.js: x.\nUji: ok.\n');
  assert.deepEqual(p1.files, []);
  assert.deepEqual(p1.tags, []);
  const p2 = parseLogContent('Title: B\nType: config\nTime: 2026-09-26T10:00:00+07:00\nFiles: auth/login.js, README.md\nTags: Auth, Login\nSummary: S.\nChanged:\n- auth/login.js: guard.\nTest: ok.\n');
  assert.equal(p2.title, 'B');
  assert.equal(p2.type, 'config');
  assert.deepEqual(p2.files, ['auth/login.js', 'README.md']);
  assert.deepEqual(p2.tags, ['auth', 'login']);
});

// --- v0.3: Files weight beats title ---
test('Files exact match outranks title-only match', () => {
  const dir = mktmp();
  write(dir, 'alpha_20260926-100000.log', 'Judul: auth overhaul\nTipe: fix\nWaktu: 2026-09-26 10:00:00\nRingkasan: umum.\nUbah:\n- other.js: x.\nUji: ok.\n');
  write(dir, 'beta_20260926-110000.log', 'Judul: Sesuatu umum\nTipe: fix\nWaktu: 2026-09-26 11:00:00\nFiles: auth/login.js\nTags: auth\nRingkasan: umum.\nUbah:\n- auth/login.js: guard.\nUji: ok.\n');
  const hits = selectLogs({ dir, query: 'What did we change in auth/login.js?', limit: 2 });
  assert.equal(hits[0].name.startsWith('beta_'), true);
});

// --- v0.3: why-was file query triggers ---
test('why-was file query is history', () => {
  assert.equal(isHistoryQuery('Why was auth/login.js changed?'), true);
  assert.equal(isHistoryQuery('Why was SKILL.md modified?'), true);
  assert.equal(isHistoryQuery('Why was this file changed?'), true);
});

// --- v0.3: old log beyond 20 still found via Files ---
test('specific old log beyond 20 newest still found', () => {
  const dir = mktmp();
  for (let i = 0; i < 40; i++) {
    write(dir, `noise-${String(i).padStart(2, '0')}_20260926-100000.log`, LOG(`Noise ${i}`, 'lainnya', `noise${i}.js.`));
  }
  write(dir, 'ancient-auth_20260901-080000.log', 'Judul: Ancient auth\nTipe: fix\nWaktu: 2026-09-01 08:00:00\nFiles: auth/ancient.js\nTags: auth\nRingkasan: lama.\nUbah:\n- auth/ancient.js: guard lama.\nUji: ok.\n');
  const hits = selectLogs({ dir, query: 'What did we change in auth ancient?', limit: 3 });
  assert.ok(hits.some((h) => h.name.startsWith('ancient-auth')));
});

// --- v0.4: layout harian docs/YYYYMMDD/HHmmss-<slug>.log + backward compat ---
test('timestamp + slug parse layout baru dan lama', () => {
  assert.equal(timestampFromLogPath('20260926/143022-fix-login.log'), 20260926143022);
  assert.equal(timestampFromLogPath('fix-login_20260926-143022.log'), 20260926143022);
  assert.equal(timestampFromFilename('20260926/143022-fix-login.log'), 20260926143022);
  assert.equal(slugFromLogName('143022-fix-login.log'), 'fix-login');
  assert.equal(slugFromLogName('fix-login_20260926-143022.log'), 'fix-login');
});

test('list nested + flat newest-first', () => {
  const dir = mktmp();
  write(dir, 'fix-lama_20260925-100000.log', LOG('Lama', 'fix', 'a.js.'));
  fs.mkdirSync(path.join(dir, '20260926'));
  write(dir, '20260926/110000-baru.log', LOG('Baru', 'fix', 'b.js.'));
  const listed = listLogsNewestFirst(dir).map((l) => l.name);
  assert.deepEqual(listed, ['20260926/110000-baru.log', 'fix-lama_20260925-100000.log']);
});

test('select campuran nested + flat tetap relevan', () => {
  const dir = mktmp();
  write(dir, 'cache-lama_20260925-100000.log', LOG('Cache lama', 'fitur', 'api/cache.js: lru.'));
  fs.mkdirSync(path.join(dir, '20260926'));
  write(dir, '20260926/110000-update-auth.log', LOG('Update auth', 'fix', 'auth/login.js: guard.'));
  const hits = selectLogs({ dir, query: 'What did we change in auth/login.js?', limit: 2 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, '20260926/110000-update-auth.log');
});
