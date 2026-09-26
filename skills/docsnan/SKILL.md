---
name: docsnan
description: >
  Wajibkan 1 tugas = 1 file docs/*.log bernama <slug>_YYYYMMDD-HHmmss.log.
  Berlaku untuk semua jenis tugas: fitur, fix, debug, refactor, tugas lain.
  Pakai /docsnan on | /docsnan off. Isi singkat tapi lengkap dan mudah dipahami.
argument-hint: "[on|off]"
license: MIT
---

# Docsnan

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

- Folder: `docs/` di root project. Buat bila belum ada.
- Nama: `<slug>_YYYYMMDD-HHmmss.log`
- Contoh: `fix-login_20260926-143022.log`, `tambah-cache-api_20260926-150310.log`
- Slug: dari judul tugas. Lowercase. Spasi dan non-alfanumerik jadi `-`.
  Maks 50 char. Contoh: "Fix Login Null" jadi `fix-login-null`.
- Timestamp: waktu lokal saat tugas selesai. Ambil via `date +%Y%m%d-%H%M%S`.
- Selalu file baru. Jangan timpa atau append ke log lama.

## Cakupan

Semua jenis eksekusi: fitur baru, fix, debug, refactor, config, docs, lainnya.
Eksekusi kecil tetap wajib 1 file. Satu sesi berisi banyak eksekusi = banyak
file, 1 per eksekusi. Tanpa eksekusi = tanpa file.

## Isi (singkat, poin penting, lengkap, mudah dipahami)

Tulis 6 field ini, 1-3 baris per field. Tanpa essay.

```
Judul: <judul tugas>
Tipe: <fitur|fix|debug|refactor|lainnya>
Waktu: <YYYY-MM-DD HH:MM:SS lokal>
Ringkasan: <apa masalah / permintaan, 1-2 kalimat>
Ubah: <file/fungsi utama yang diubah + kenapa, bullet pendek>
Uji: <cara uji + hasil, 1-2 baris>
```

Contoh:

```
Judul: Fix login null saat password kosong
Tipe: fix
Waktu: 2026-09-26 14:30:22
Ringkasan: Login crash saat password kosong. Tambah guard kosong.
Ubah:
- auth/login.js: cek password kosong sebelum hash, return 400.
Uji: POST /login tanpa password balas 400. npm test lolos.
```

## Batas

- `/docsnan off` hentikan kewajiban sampai `/docsnan on` lagi.
- Mode default `on`. Env `DOCSNAN_DEFAULT_MODE=off` ubah default.
- Dokumentasi tulis normal, jelas. Bukan gaya caveman/ponytail.
