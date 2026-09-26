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
} = require('../hooks/docsnan-retrieve');

function mktmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'docsnan-'));
}

function write(dir, name, body) {
  fs.writeFileSync(path.join(dir, name), body);
  return path.join(dir, name);
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
