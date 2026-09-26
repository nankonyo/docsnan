#!/usr/bin/env node
// docsnan — deterministic log retrieval (offline, no deps).
//
// Two-phase, low-token:
//   1. rank by filename/timestamp (no file read)
//   2. read only top candidates to score title/type/summary/changed
// Agent then reads only the returned top N files.

const fs = require('fs');
const path = require('path');

const DEFAULT_LIMIT = 3;
const MAX_CANDIDATE_READ = 20;

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
  /why was this file changed/i,
];

// Small stopword set so generic words don't outrank real keywords.
// History markers (change/update/work/task/...) score nothing; content stays.
const STOPWORDS = new Set(
  ('yang,dan,atau,apa,itu,ini,kami,kita,saya,anda,kamu,ada,sudah,telah,dari,untuk,pada,' +
    'adalah,yaitu,yakni,yg,tsb,the,a,an,of,to,in,on,for,was,were,what,did,have,has,been,' +
    'show,tell,about,recent,recently,latest,last,previous,already,ever,' +
    'change,changed,changes,update,updated,updates,work,worked,working,' +
    'task,tasks,session,sessions,agent,agents,implementation,implementations,file,files')
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

// `fix-login_20260926-143022.log` -> 20260926143022 (number, 0 if no match).
function timestampFromFilename(filename) {
  const m = String(path.basename(filename)).match(/_(\d{8})-(\d{6})\.log$/);
  return m ? Number(m[1] + m[2]) : 0;
}

// Tolerant 6-field parse. Never throws; malformed logs yield empty fields.
function parseLogContent(text) {
  const out = { title: '', type: '', time: '', summary: '', changed: [], test: '', raw: String(text || '') };
  if (!text || typeof text !== 'string') return out;
  const lines = text.split(/\r?\n/);
  const changed = [];
  let section = null;
  for (const line of lines) {
    let m;
    if ((m = line.match(/^\s*Judul\s*:\s*(.*)\s*$/i))) { out.title = m[1]; section = null; continue; }
    if ((m = line.match(/^\s*Tipe\s*:\s*(.*)\s*$/i))) { out.type = m[1].trim().toLowerCase(); section = null; continue; }
    if ((m = line.match(/^\s*Waktu\s*:\s*(.*)\s*$/i))) { out.time = m[1]; section = null; continue; }
    if ((m = line.match(/^\s*Ringkasan\s*:\s*(.*)\s*$/i))) { out.summary = m[1]; section = null; continue; }
    if (/^\s*Ubah\s*:/i.test(line)) {
      const rest = line.replace(/^\s*Ubah\s*:\s*/i, '');
      if (rest) changed.push(rest.replace(/^[-*]\s*/, ''));
      section = 'changed';
      continue;
    }
    if ((m = line.match(/^\s*Uji\s*:\s*(.*)\s*$/i))) { out.test = m[1]; section = null; continue; }
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
  // meta: { file, slug, title, type, summary, changed }
  if (queryTokens.length === 0) return 1; // generic "what changed recently" -> newest wins
  const hay = {
    file: String(meta.slug || '').toLowerCase(),
    title: String(meta.title || '').toLowerCase(),
    type: String(meta.type || '').toLowerCase(),
    summary: String(meta.summary || '').toLowerCase(),
    changed: (meta.changed || []).join('\n').toLowerCase(),
  };
  let score = 0;
  for (const tok of queryTokens) {
    if (hay.file.includes(tok)) score += 3;
    if (hay.title.includes(tok)) score += 3;
    if (hay.changed.includes(tok)) score += 2;
    if (hay.type === tok) score += 2;
    if (hay.summary.includes(tok)) score += 1;
  }
  return score;
}

// List log files newest-first by filename timestamp (no content read).
function listLogsNewestFirst(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.log'));
  } catch (e) {
    return [];
  }
  return files
    .map((f) => ({ file: path.join(dir, f), name: f, ts: timestampFromFilename(f) }))
    .sort((a, b) => b.ts - a.ts || (a.name < b.name ? 1 : -1));
}

// Main entry: return up to `limit` most relevant logs, newest-first on ties.
// Only reads file contents for top candidates; caller reads full files.
function selectLogs({ dir = 'docs', query = '', limit = DEFAULT_LIMIT } = {}) {
  const listed = listLogsNewestFirst(dir);
  if (listed.length === 0) return [];
  const tokens = tokenize(query);
  const candidates = listed.slice(0, MAX_CANDIDATE_READ);
  const scored = candidates.map((c, order) => {
    let meta = { slug: c.name.replace(/_\d{8}-\d{6}\.log$/, ''), title: '', type: '', summary: '', changed: [] };
    try {
      const parsed = parseLogContent(fs.readFileSync(c.file, 'utf8'));
      meta = { ...meta, title: parsed.title, type: parsed.type, summary: parsed.summary, changed: parsed.changed };
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
