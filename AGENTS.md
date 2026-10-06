# Docsnan — 1 tugas = 1 file docs/YYYYMMDD/*.log

MANDATORY FINAL STEP — DO NOT SKIP. After every execution task, you MUST
create 1 NEW log file before finishing. If you edited files but created NO
log, the task is INCOMPLETE — create the log now.

Aturan wajib, bukan opsional. Setiap eksekusi pekerjaan (ada file diubah atau
perintah dijalankan) tutup dengan 1 file log di `docs/YYYYMMDD/` folder project.
Skip HANYA untuk obrolan biasa, plan tanpa eksekusi, dan baca kode tanpa perubahan.

Format nama: `docs/YYYYMMDD/HHmmss-<slug>.log`
Contoh: `docs/20260926/143022-fix-login.log`
Buat via: `mkdir -p docs/$(date +%Y%m%d)`

Isi singkat, poin penting saja, tapi lengkap dan mudah dipahami.
Template isi ada di `skills/docsnan/SKILL.md`.
Format lama `docs/<slug>_YYYYMMDD-HHmmss.log` tetap terbaca, jangan hapus.

Kontrol: `/docsnan on` | `/docsnan off`. Default: `on`.
