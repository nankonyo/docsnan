#!/usr/bin/env node
// docsnan — shared instruction builder.
// Injeksi context pendek + imperatif (bukan full SKILL.md) agar tidak
// terkubur di system prompt. Full spec tetap via skill `docsnan`.

const { DEFAULT_MODE, normalizePersistedMode } = require('./docsnan-config');

function getFallbackInstructions() {
  return 'DOCSNAN MODE ACTIVE — MANDATORY FINAL STEP, DO NOT SKIP.\n\n' +
    'After EVERY execution task (file created/edited/deleted, or build/test/deploy run), ' +
    'you MUST create 1 NEW log file before finishing: `mkdir -p docs/$(date +%Y%m%d)` then write ' +
    'docs/YYYYMMDD/HHmmss-<slug>.log (never overwrite old logs).\n' +
    'Skip ONLY plain chat, Q&A, plan without execution, read-only browse.\n' +
    'Log fields: Judul, Tipe, Waktu ISO, Files, Tags, Ringkasan, Ubah (`path: alasan`), Uji.\n' +
    'If you edited files but created NO log, task is INCOMPLETE — create log now. ' +
    'Full spec: skill `docsnan` (skills/docsnan/SKILL.md).';
}

function getShortInstructions() {
  return 'DOCSNAN MODE ACTIVE — MANDATORY FINAL STEP, DO NOT SKIP.\n\n' +
    'After EVERY execution task (file created/edited/deleted, or build/test/deploy run), ' +
    'you MUST create 1 NEW log file before finishing: `mkdir -p docs/$(date +%Y%m%d)` then write ' +
    'docs/YYYYMMDD/HHmmss-<slug>.log (never overwrite old logs).\n' +
    'Skip ONLY plain chat, Q&A, plan without execution, read-only browse.\n' +
    'Log fields: Judul, Tipe, Waktu ISO, Files, Tags, Ringkasan, Ubah (`path: alasan`), Uji.\n' +
    'If you edited files but created NO log, task is INCOMPLETE — create log now. ' +
    'Full spec: skill `docsnan` (skills/docsnan/SKILL.md). ' +
    'History Q (recent/previous/last/yesterday/terakhir/kemarin/riwayat/sudah difix, why was <file> changed)? ' +
    'Check docs/*/*.log + docs/*.log newest-first, read max 3 relevant.';
}

function getDocsnanInstructions(mode) {
  const m = normalizePersistedMode(mode) || DEFAULT_MODE;
  if (m === 'off') return '';
  return getShortInstructions();
}

module.exports = { getDocsnanInstructions, getFallbackInstructions };
