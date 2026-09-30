# Docsnan — 1 tugas = 1 file docs/YYYYMMDD/*.log

Aturan wajib, bukan opsional. Setiap eksekusi pekerjaan tutup dengan 1 file
log di `docs/YYYYMMDD/` folder project. Hanya saat eksekusi (ada file diubah atau
perintah dijalankan). Skip untuk obrolan biasa, plan tanpa eksekusi, dan
baca kode tanpa perubahan.

Format nama: `docs/YYYYMMDD/HHmmss-<slug>.log`
Contoh: `docs/20260926/143022-fix-login.log`
Buat via: `mkdir -p docs/$(date +%Y%m%d)`

Isi singkat, poin penting saja, tapi lengkap dan mudah dipahami.
Template isi ada di `skills/docsnan/SKILL.md`.
Format lama `docs/<slug>_YYYYMMDD-HHmmss.log` tetap terbaca, jangan hapus.

Kontrol: `/docsnan on` | `/docsnan off`. Default: `on`.
