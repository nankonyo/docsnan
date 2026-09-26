---
description: Control docsnan (on|off|update|version, default status)
---

Switch docsnan. Subcommand = $ARGUMENTS (satu kata, case-insensitive).

- `` (kosong): lapor mode aktif + versi. Tanpa ubah apa pun.
- `on`: nyalakan kewajiban log (berlaku pesan berikut).
- `off`: matikan sampai dinyalakan lagi.
- `version`: lapor versi terpasang (dari package.json). Tanpa ubah apa pun.
- `update`: cek versi terbaru (npm registry, fallback GitHub tags), bandingkan
  dengan versi terpasang. Bila sama: lapor up-to-date. Bila beda: jelaskan
  versi lama -> baru + sumbernya, update via mekanisme install yang sama
  (checkout git: `git pull --ff-only`, tolak bila worktree kotor;
  install npm: `npm install docsnan@latest`), verifikasi versi hasil,
  lapor sukses/gagal singkat tanpa rusak install lama.
  Jangan curl|sh, jangan timpa modifikasi user diam-diam.
  Detail: `node <docsnan>/hooks/docsnan-update.js [version|check|update]`.
- Selain itu: abaikan, beri tahu pemakaian valid.

When on: tutup setiap eksekusi pekerjaan (fitur, fix, debug, refactor, config, lainnya) dengan 1 file baru docs/<slug>_YYYYMMDD-HHmmss.log. Buat folder docs bila belum ada. Skip obrolan biasa, tanya jawab, plan tanpa eksekusi, dan baca kode tanpa perubahan. Isi singkat 6 field: Judul, Tipe, Waktu, Ringkasan, Ubah, Uji.

Riwayat: untuk pertanyaan soal kerja lampau (recent/previous/last/yesterday/terakhir/kemarin/riwayat/sudah difix), cari docs/*.log terbaru dulu, baca maks 3 yang relevan, jangan load semua log. Detail di SKILL.md bagian Riwayat.
