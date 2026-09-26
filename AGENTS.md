# Docsnan — 1 tugas = 1 file docs/*.log

Aturan wajib, bukan opsional. Setiap eksekusi pekerjaan tutup dengan 1 file
log di `docs/` folder project. Hanya saat eksekusi (ada file diubah atau
perintah dijalankan). Skip untuk obrolan biasa, plan tanpa eksekusi, dan
baca kode tanpa perubahan.

Format nama: `<slug>_YYYYMMDD-HHmmss.log`
Contoh: `fix-login_20260926-143022.log`

Isi singkat, poin penting saja, tapi lengkap dan mudah dipahami.
Template isi ada di `skills/docsnan/SKILL.md`.

Kontrol: `/docsnan on` | `/docsnan off`. Default: `on`.
