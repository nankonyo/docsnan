#!/usr/bin/env node
// docsnan — deterministic log retrieval (offline, no deps).
//
// Two-phase, low-token:
//   1. rank by filename/timestamp (no file read)
//   2. read only top candidates to score files/tags/title/type/changed/summary
// Agent then reads only the returned top N files.

const fs = require('fs');
const path = require('path');

const DEFAULT_LIMIT = 3;
const MAX_CANDIDATE_READ = 50;

// Words that mark a request as "about past work", ID + EN.
const HISTORY_PATTERNS = [
  /apa (yang|yg|saja) (diubah|berubah|difix|diperbaiki|dikerjakan|terjadi)/i,
  /yang (diubah|berubah|difix|diperbaiki|dikerjakan) (terakhir|terbaru|kemarin)/i,
  /(terakhir|terbaru|terdahulu|sebelumnya|kemarin|riwayat|histori|history)/i,
  /(sudah|pernah) (difix|diperbaiki|diubah|dikerjakan)/i,
  /kenapa .* (diubah|diganti)/i,
  /implementasi sebelumnya/i,
  /what (was|were|did|have|has) .* (change[sd]?|changed|fix(e[sd])?|update[sd]?|done|work\w*)/i,
  /what .* (recently|lately|yesterday)/i,
  /did we already/i,
  /have we .* (fixed|changed|updated)/i,
  /show .* (latest|recent|last|previous)/i,
  /previous (task|implementation|agent|work|session|change|fix)/i,
  /last (session|task|change|update|fix)/i,
  /recent (changes|updates|fixes|work)/i,
  /why (was|were|did) .* (chang|fix|updat|modif)/i,
];

// Small stopword set so generic words don't outrank real keywords.
// History markers (change/update/work/task/...) score nothing; content stays.
const STOPWORDS = new Set(
  ('yang,dan,atau,apa,itu,ini,kami,kita,saya,anda,kamu,ada,sudah,telah,dari,untuk,pada,' +
    'adalah,yaitu,yakni,yg,tsb,the,a,an,of,to,in,on,for,was,were,what,did,have,has,been,' +
    'show,tell,about,recent,recently,latest,last,previous,already,ever,' +
    'change,changed,changes,update,updated,updates,work,worked,working,' +
    'task,tasks,session,sessions,agent,agents,implementation,implementations,file,files,' +
    'log,logs,docs,docsnan,please,find,get,give,list')
    .split(','),
);

// auth <-> authentication are the same topic in these logs.
const SYNONYMS = { authentication: 'auth', authenticate: 'auth', authentications: 'auth' };

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] || t);
}

function isHistoryQuery(query) {
  if (!query || typeof query !== 'string') return false;
  return HISTORY_PATTERNS.some((re) => re.test(query));
}

// `fix-login_20260926-143022.log` (lama, flat) -> 20260926143022.
// `20260926/143022-fix-login.log` (baru, harian) -> 20260926143022.
// Terima full path, relative, atau basename. 0 bila tak cocok.
function timestampFromLogPath(logPath) {
  const p = String(logPath || '');
  let m = p.match(/(\d{8})\/(\d{6})-[^/]+\.log$/);
  if (m) return Number(m[1] + m[2]);
  m = String(path.basename(p)).match(/_(\d{8})-(\d{6})\.log$/);
  if (m) return Number(m[1] + m[2]);
  m = String(path.basename(p)).match(/^(\d{6})-[^/]+\.log$/);
  if (m) {
    const d = p.match(/(\d{8})/);
    return d ? Number(d[1] + m[1]) : 0;
  }
  return 0;
}

// Alias lama, tetap diekspor agar tes/skrip lama tak rusak.
function timestampFromFilename(filename) {
  return timestampFromLogPath(filename);
}

// Ambil slug dari nama file lama maupun baru.
// lama: `fix-login_20260926-143022.log` -> `fix-login`
// baru: `143022-fix-login.log` -> `fix-login`
function slugFromLogName(name) {
  const base = String(path.basename(name || ''));
  let m = base.match(/^(\d{6})-(.+)\.log$/);
  if (m) return m[2];
  m = base.match(/^(.+?)_\d{8}-\d{6}\.log$/);
  if (m) return m[1];
  return base.replace(/\.log$/, '');
}

// Tolerant 6+2-field parse. Never throws; malformed logs yield empty fields.
// Format lama (6 field ID saja) tetap terbaca. Alias EN + Files/Tags opsional.
function parseLogContent(text) {
  const out = { title: '', type: '', time: '', summary: '', changed: [], files: [], tags: [], test: '', raw: String(text || '') };
  if (!text || typeof text !== 'string') return out;
  const lines = text.split(/\r?\n/);
  const changed = [];
  let section = null;
  for (const line of lines) {
    let m;
    if ((m = line.match(/^\s*(Judul|Title)\s*:\s*(.*)\s*$/i))) { out.title = m[2]; section = null; continue; }
    if ((m = line.match(/^\s*(Tipe|Type)\s*:\s*(.*)\s*$/i))) { out.type = m[2].trim().toLowerCase(); section = null; continue; }
    if ((m = line.match(/^\s*(Waktu|Time)\s*:\s*(.*)\s*$/i))) { out.time = m[2]; section = null; continue; }
    if ((m = line.match(/^\s*(Ringkasan|Summary)\s*:\s*(.*)\s*$/i))) { out.summary = m[2]; section = null; continue; }
    if ((m = line.match(/^\s*(Files?|Berkas)\s*:\s*(.*)\s*$/i))) {
      out.files = m[2].split(',').map((s) => s.trim()).filter(Boolean);
      section = null; continue;
    }
    if ((m = line.match(/^\s*(Tags?|Label)\s*:\s*(.*)\s*$/i))) {
      out.tags = m[2].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      section = null; continue;
    }
    if (/^\s*(Ubah|Changed?)\s*:/i.test(line)) {
      const rest = line.replace(/^\s*(Ubah|Changed?)\s*:\s*/i, '');
      if (rest) changed.push(rest.replace(/^[-*]\s*/, ''));
      section = 'changed';
      continue;
    }
    if ((m = line.match(/^\s*(Uji|Test)\s*:\s*(.*)\s*$/i))) { out.test = m[2]; section = null; continue; }
    if (section === 'changed') {
      const bullet = line.match(/^\s*[-*]\s*(.+)\s*$/);
      if (bullet) changed.push(bullet[1]);
      else if (/^\s*$/.test(line)) section = null;
      // Non-bullet continuation lines are ignored (short-log philosophy).
    }
  }
  out.changed = changed;
  return out;
}

function scoreLog(meta, queryTokens) {
  // meta: { file, slug, title, type, summary, changed, files, tags }
  if (queryTokens.length === 0) return 1; // generic "what changed recently" -> newest wins
  const hay = {
    file: String(meta.slug || '').toLowerCase(),
    title: String(meta.title || '').toLowerCase(),
    type: String(meta.type || '').toLowerCase(),
    summary: String(meta.summary || '').toLowerCase(),
    changed: (meta.changed || []).join('\n').toLowerCase(),
    files: (meta.files || []).join(' ').toLowerCase(),
    tags: meta.tags || [],
  };
  let score = 0;
  for (const tok of queryTokens) {
    if (hay.files.includes(tok)) score += 5;
    if (hay.tags.includes(tok)) score += 4;
    if (hay.file.includes(tok)) score += 3;
    if (hay.title.includes(tok)) score += 3;
    if (hay.changed.includes(tok)) score += 2;
    if (hay.type === tok) score += 2;
    if (hay.summary.includes(tok)) score += 1;
  }
  return score;
}

// List log newest-first by path timestamp (no content read).
// Dukung dua layout: lama flat `docs/<slug>_YYYYMMDD-HHmmss.log`
// dan baru harian `docs/YYYYMMDD/HHmmss-<slug>.log`.
// name = path relatif dari dir (mis. `20260926/143022-fix-login.log`).
function listLogsNewestFirst(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.log')) {
      const rel = e.name;
      out.push({ file: path.join(dir, rel), name: rel, ts: timestampFromLogPath(rel) });
    } else if (e.isDirectory() && /^\d{8}$/.test(e.name)) {
      // ponytail: 1 level tanggal cukup, tanpa walk rekursif mahal.
      let inner = [];
      try {
        inner = fs.readdirSync(path.join(dir, e.name));
      } catch (err) { continue; }
      for (const f of inner) {
        if (!f.endsWith('.log')) continue;
        const rel = e.name + '/' + f;
        out.push({ file: path.join(dir, rel), name: rel, ts: timestampFromLogPath(rel) });
      }
    }
  }
  return out.sort((a, b) => b.ts - a.ts || (a.name < b.name ? 1 : -1));
}

// Main entry: return up to `limit` most relevant logs, newest-first on ties.
// Only reads file contents for top candidates; caller reads full files.
function selectLogs({ dir = 'docs', query = '', limit = DEFAULT_LIMIT } = {}) {
  const listed = listLogsNewestFirst(dir);
  if (listed.length === 0) return [];
  const tokens = tokenize(query);
  const candidates = listed.slice(0, MAX_CANDIDATE_READ);
  const scored = candidates.map((c, order) => {
    let meta = { slug: slugFromLogName(c.name), title: '', type: '', summary: '', changed: [], files: [], tags: [] };
    try {
      const parsed = parseLogContent(fs.readFileSync(c.file, 'utf8'));
      meta = { ...meta, title: parsed.title, type: parsed.type, summary: parsed.summary, changed: parsed.changed, files: parsed.files, tags: parsed.tags };
    } catch (e) { /* unreadable -> filename-only rank */ }
    return { ...c, order, meta, score: scoreLog(meta, tokens) };
  });
  const relevant = scored.filter((s) => s.score > 0);
  const picked = (relevant.length > 0 ? relevant : scored.slice(0, 0)).slice(0, limit);
  // Generic history query with no keyword hit -> newest logs.
  const final = relevant.length > 0 ? picked : (tokens.length === 0 ? scored.slice(0, limit) : []);
  return final.map(({ file, name, ts, score, meta }) => ({ file, name, ts, score, meta }));
}

module.exports = {
  DEFAULT_LIMIT,
  HISTORY_PATTERNS,
  isHistoryQuery,
  tokenize,
  timestampFromFilename,
  timestampFromLogPath,
  slugFromLogName,
  parseLogContent,
  scoreLog,
  listLogsNewestFirst,
  selectLogs,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const query = args.find((a) => !a.startsWith('--')) || '';
  const getOpt = (name, def) => {
    const m = args.find((a) => a.startsWith(name + '='));
    return m ? m.slice(name.length + 1) : def;
  };
  const dir = getOpt('--dir', 'docs');
  const limit = Number(getOpt('--limit', String(DEFAULT_LIMIT))) || DEFAULT_LIMIT;
  const json = args.includes('--json');
  if (!isHistoryQuery(query)) {
    console.log('Not a history query. Retrieval dormant.');
    process.exit(0);
  }
  const hits = selectLogs({ dir, query, limit });
  if (json) console.log(JSON.stringify(hits, null, 2));
  else if (hits.length === 0) console.log('No relevant logs in ' + dir + '/.');
  else hits.forEach((h) => console.log(`${h.score}\t${h.name}\t${h.meta.title || '(no title)'}`));
}
