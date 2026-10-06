---
name: docsnan
description: >
  Mandatory log after EVERY execution task: after creating/editing/deleting files,
  after build/test/deploy, after fix/feature/refactor/config/docs.
  Creates 1 file docs/YYYYMMDD/HHmmss-<slug>.log. Skip chat/plan/read-only.
  Use /docsnan on | /docsnan off.
argument-hint: "[on|off]"
license: MIT
---

# Docsnan

MANDATORY FINAL STEP — DO NOT SKIP. After every execution task, you MUST
create 1 NEW log file before finishing. If you edited files but created NO
log, the task is INCOMPLETE — create the log now.

Tutup setiap eksekusi pekerjaan dengan dokumentasi. 1 eksekusi = 1 file.

## Kapan wajib log

Hanya saat ada eksekusi pekerjaan: file diubah/dibuat/dihapus, config
diubah, bug difix, fitur ditambah, refactor dijalankan, perintah build/test/
deploy dijalankan, atau hasil kerja konkret diserahkan. Berlaku untuk semua
jenis eksekusi: fitur, fix, debug, refactor, config, docs, lainnya.

## Kapan skip (tanpa log)

- Obrolan biasa: salam, tanya jawab, penjelasan, diskusi konsep.
- Plan / rencana saja tanpa eksekusi: belum ada file diubah, belum ada
  perintah dijalankan. Log ditulis nanti saat eksekusi jalan.
- Baca/browse kode saja tanpa perubahan.
- Tugas dibatalkan sebelum eksekusi.

Aturan putus: tidak ada perubahan file dan tidak ada perintah eksekusi =
tidak ada log.

## Lokasi dan nama

- Folder: `docs/YYYYMMDD/` di root project. Buat via `mkdir -p docs/$(date +%Y%m%d)`.
- Nama: `HHmmss-<slug>.log`. Full: `docs/20260926/143022-fix-login.log`.
- Contoh: `docs/20260926/143022-fix-login.log`, `docs/20260926/150310-tambah-cache-api.log`.
- Slug: dari judul tugas. Lowercase. Spasi dan non-alfanumerik jadi `-`.
  Maks 50 char. Contoh: "Fix Login Null" jadi `fix-login-null`.
- Tanggal folder via `date +%Y%m%d`, jam file via `date +%H%M%S` (waktu lokal).
- Selalu file baru. Jangan timpa atau append ke log lama.
- Format lama flat `docs/<slug>_YYYYMMDD-HHmmss.log` tak ditulis lagi,
  tapi tetap dibaca saat retrieval (backward compat). Jangan hapus log lama.

## Cakupan

Semua jenis eksekusi: fitur baru, fix, debug, refactor, config, docs, lainnya.
Eksekusi kecil tetap wajib 1 file. Satu sesi berisi banyak eksekusi = banyak
file, 1 per eksekusi. Tanpa eksekusi = tanpa file.

## Isi (singkat, poin penting, lengkap, mudah dipahami)

Tulis 6 field wajib + 2 opsional mesin ini, 1-3 baris per field. Tanpa essay.

```
Judul: <judul tugas>
Tipe: <fitur|fix|debug|refactor|config|docs|lainnya>
Waktu: <YYYY-MM-DDTHH:MM:SS+07:00, ISO lokal; format lama spasi tetap terbaca>
Files: <path koma, cth: auth/login.js, README.md> (opsional, disarankan bila sentuh file)
Tags: <kata kunci koma lowercase, cth: auth, login> (opsional, disarankan)
Ringkasan: <apa masalah / permintaan, 1-2 kalimat>
Ubah: <file/fungsi utama yang diubah + kenapa, bullet pendek>
Uji: <cara uji + hasil, 1-2 baris>
```

Aturan Ubah: tiap bullet wajib mulai `path: alasan`.
Contoh: `- auth/login.js: cek password kosong sebelum hash, return 400.`
Alias EN diterima parser (`Title/Type/Time/Summary/Changed/Test/Files/Tags`).
Format lama tanpa `Files/Tags` tetap terbaca. Field tak dikenal diabaikan, tak pernah crash.

Contoh:

```
Judul: Fix login null saat password kosong
Tipe: fix
Waktu: 2026-09-26T14:30:22+07:00
Files: auth/login.js
Tags: auth, login
Ringkasan: Login crash saat password kosong. Tambah guard kosong.
Ubah:
- auth/login.js: cek password kosong sebelum hash, return 400.
Uji: POST /login tanpa password balas 400. npm test lolos.
```

## Batas

- `/docsnan off` hentikan kewajiban sampai `/docsnan on` lagi.
- Mode default `on`. Env `DOCSNAN_DEFAULT_MODE=off` ubah default.
- Dokumentasi tulis normal, jelas. Bukan gaya caveman/ponytail.

## Riwayat (baca log lama, token hemat)

Untuk tugas coding biasa, bagian ini dormant. Jangan sentuh `docs/`.

Hanya aktif bila permintaan user soal kerja lampau: perubahan terbaru,
kemarin, terakhir, riwayat, "sudah difix?", "pernah dikerjakan?",
"implementasi sebelumnya", "apa yang agent sebelumnya lakukan",
"kenapa file ini diubah", "why was auth/login.js changed", atau padanan EN
(what changed/recently, previous task, last session, did we already).

Alur wajib (ringan, offline, tanpa vector DB):

1. `ls docs/*/*.log docs/*.log` terbaru dulu (path `YYYYMMDD/HHmmss-<slug>.log`
   sudah terurut waktu; flat lama `<slug>_YYYYMMDD-HHmmss.log` ikut terbaca).
   Bila kosong: jawab terus terang, lanjut ke kode/git.
2. Pilih maks 3 log relevan via cocok `Files` (+5) / `Tags` (+4) /
   nama/judul (+3) / file di `Ubah` (+2) / `Tipe` exact (+2) / Ringkasan (+1).
   Contoh: tanya auth → prioritaskan `Files/Tags` berisi `auth|login`.
   Baca maks 50 kandidat terbaru untuk skor, return 3 teratas.
3. Baca hanya log terpilih itu. Jangan load semua log ke konteks.
4. Bila log tak cukup, baru cek source code lalu git history.
5. Jangan klaim kejadian historis hanya karena kode sekarang ada
   implementasinya. Bedakan sumber jawaban: log docsnan vs
   kode saat ini vs git history.

Opsional: `node <docsnan>/hooks/docsnan-retrieve.js "<pertanyaan>" --dir docs --limit 3`
lakukan langkah 1-2 deterministik (deteksi intent + ranking newest-first).
