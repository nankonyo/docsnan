#!/usr/bin/env node
// docsnan — shared instruction builder (mirip ponytail-instructions.js).
// SKILL.md sumber tunggal. Fallback bila file tak terbaca.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizePersistedMode } = require('./docsnan-config');

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'docsnan', 'SKILL.md');

function getFallbackInstructions() {
  return 'DOCSNAN MODE ACTIVE — level: on\n\n' +
    'Tutup setiap eksekusi pekerjaan dengan 1 file baru di docs/<slug>_YYYYMMDD-HHmmss.log. ' +
    'Buat folder docs bila belum ada. Jangan timpa log lama.\n' +
    'Hanya saat eksekusi (ada file diubah atau perintah build/test/deploy dijalankan). ' +
    'Skip untuk obrolan biasa, tanya jawab, plan tanpa eksekusi, dan baca kode tanpa perubahan.\n' +
    'Isi singkat, poin penting saja: Judul, Tipe, Waktu, Ringkasan, Ubah, Uji.';
}

function getDocsnanInstructions(mode) {
  const m = normalizePersistedMode(mode) || DEFAULT_MODE;
  if (m === 'off') return '';
  try {
    const body = String(fs.readFileSync(SKILL_PATH, 'utf8')).replace(/^---[\s\S]*?---\s*/, '');
    return 'DOCSNAN MODE ACTIVE — level: on\n\n' + body.trim();
  } catch (e) {
    return getFallbackInstructions();
  }
}

module.exports = { getDocsnanInstructions, getFallbackInstructions };
