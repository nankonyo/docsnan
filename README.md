<p align="center">
  <img src="assets/docsnan.png" width="220" alt="Docsnan, catat tiap eksekusi">
</p>

<h1 align="center">Docsnan</h1>

<p align="center">
  <em>Satu eksekusi, satu file log. Tidak ada kerja yang hilang tanpa jejak.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/works%20with-opencode-111111?style=flat-square" alt="Works with opencode">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

---

AI lupa apa yang ia kerjakan kemarin. Docsnan menghentikannya.

Setiap kali agent mengeksekusi pekerjaan — fitur, fix, debug, refactor,
config — ia wajib menutupnya dengan 1 file log di folder `docs/YYYYMMDD/`
project tersebut. Satu eksekusi, satu file. Obrolan biasa dan plan
tanpa eksekusi tidak dicatat.

## Contoh hasil

Selesai fix login, agent menulis `docs/20260926/143022-fix-login.log`:

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

## Cara kerja

1. Plugin injeksi aturan docsnan ke system prompt setiap turn (bila mode `on`).
2. Agent kerja seperti biasa.
3. Saat eksekusi selesai, agent buat folder `docs/YYYYMMDD/` via
   `mkdir -p docs/$(date +%Y%m%d)`, lalu tulis 1 file baru `HHmmss-<slug>.log`.
4. Slug dari judul tugas: lowercase, non-alfanumerik jadi `-`, maks 50 char.
   Tanggal folder `date +%Y%m%d`, jam file `date +%H%M%S` (waktu lokal).
5. File log lama tidak pernah ditimpa. Selalu file baru. Format lama flat
   `docs/<slug>_YYYYMMDD-HHmmss.log` tetap terbaca, jangan hapus.

Kapan wajib: ada file diubah/dibuat/dihapus, atau perintah
build/test/deploy dijalankan. Kapan skip: obrolan biasa, tanya jawab,
plan tanpa eksekusi, baca kode tanpa perubahan. Aturan putus: tidak ada
perubahan file dan tidak ada perintah = tidak ada log.

## Install

Satu file plugin dukung OpenCode 1.x (`server()`) dan 2.x (`id`+`setup`).

### OpenCode 2.x (npm)

```bash
npm i docsnan
```

```json
{ "plugins": ["docsnan"] }
```

### OpenCode 2.x (dari checkout)

Entry harus direktori, bukan file:

```json
{ "plugins": ["/abs/path/docsnan-checkout"] }
```

Path `./` relatif terhadap `opencode.json` project. Untuk satu checkout
dipakai banyak project, isi path absolut ke root checkout (ia temukan
`hooks/` dan `skills/` relatif ke lokasi plugin).

### OpenCode 1.x

```json
{ "plugin": ["docsnan"] }
```

atau dari checkout: `{ "plugin": ["./.opencode/plugins/docsnan.mjs"] }`.

## Perintah

| Perintah | Efek |
|---|---|
| `/docsnan` | Lapor mode + versi, tanpa ubah apa pun |
| `/docsnan on` | Nyalakan kewajiban log (default) |
| `/docsnan off` | Matikan sampai dinyalakan lagi |
| `/docsnan version` | Lapor versi terpasang (dari `package.json`) |
| `/docsnan update` | Cek versi terbaru, update bila ada, verifikasi hasil |

Env override default: `DOCSNAN_DEFAULT_MODE=off`.

## Isi log

Singkat, poin penting saja, 6 field wajib + 2 opsional mesin. 1–3 baris per field, tanpa essay:

```
Judul: <judul tugas>
Tipe: <fitur|fix|debug|refactor|config|docs|lainnya>
Waktu: <YYYY-MM-DDTHH:MM:SS+07:00 ISO lokal; format lama spasi tetap terbaca>
Files: <path koma, cth: auth/login.js> (opsional, disarankan)
Tags: <kata kunci koma lowercase> (opsional, disarankan)
Ringkasan: <masalah/permintaan, 1-2 kalimat>
Ubah: <file/fungsi utama + kenapa, bullet `path: alasan`>
Uji: <cara uji + hasil, 1-2 baris>
```

Format lama tetap terbaca. Field tak dikenal diabaikan, tak pernah crash.

## Riwayat (log sebagai memori kerja)

Log `docs/YYYYMMDD/` juga jadi memori kerja ringan. Saat user tanya soal kerja
lampau ("What did we change recently in authentication?", "Apa yang
sudah difix kemarin?"), agent cek log dulu sebelum bongkar source tree:

```text
Search docs/*/*.log + docs/*.log
↓
Find relevant authentication logs
↓
Sort newest first (path YYYYMMDD/HHmmss terurut waktu)
↓
Read relevant logs
↓
Summarize the changes
```

Aturan: deteksi intent riwayat dulu (recent/previous/last/yesterday /
terakhir/kemarin/riwayat/sudah difix, plus `why was <file> changed`).
Bila bukan pertanyaan riwayat,
bagian ini dormant — `docs/` tak disentuh. Bila ya: `ls docs/*/*.log docs/*.log`
terbaru dulu, pilih maks 3 paling relevan (skor `Files` +5 / `Tags` +4 /
nama/judul +3 / file di `Ubah` +2 / `Tipe` exact +2 / Ringkasan +1,
baca maks 50 kandidat terbaru), baca hanya itu. Folder kosong: jawab terus
terang, lanjut ke kode/git. Tak cukup: baru cek source lalu git history.
Jangan klaim riwayat hanya karena kode sekarang ada implementasinya —
bedakan sumber: log docsnan vs kode saat ini vs git history.

Tanpa vector DB, offline. Helper deterministik opsional:

```bash
node <docsnan>/hooks/docsnan-retrieve.js "What changed in auth?" --dir docs --limit 3
```

## Update

`/docsnan update` update Docsnan dari dalam OpenCode:

1. Baca versi terpasang dari `package.json` (satu-satunya sumber versi).
2. Cek versi terbaru: registry npm (`npm view docsnan version`),
   fallback GitHub tags. Tanpa `curl|sh`, tanpa perintah remote arbitrer.
3. Sama: lapor up-to-date. Beda: tunjukkan lama → baru + sumbernya,
   update via jalur install yang sama — checkout git: `git pull
   --ff-only` (tolak bila worktree kotor); install npm:
   `npm install docsnan@latest`. Modifikasi user tak ditimpa diam-diam.
4. Verifikasi versi hasil, lapor singkat. Gagal: install lama dipertahankan
   + error ringkas, tak tinggalkan plugin setengah rusak.

Batasan: bila paket belum terbit di npm dan offline/tanpa tags, updater
lapor `latest unknown` dan pertahankan install lama. CLI langsung:
`node <docsnan>/hooks/docsnan-update.js [version|check|update]`.

## Tes

Butuh Node 18+. Tanpa deps tambahan.

```bash
npm test
```

28 test via `node:test`: routing perintah (bare/on/off/update/version),
deteksi versi, up-to-date, gagal update, intent riwayat ID+EN, seleksi
log, newest-first, relevansi kata kunci, `docs/` kosong, log rusak,
200 file, Files/Tags + alias EN, bobot Files, why-was file, recall log lama,
request coding biasa yang tak picu retrieval, layout harian nested +
backward compat flat.

## Struktur

```text
.opencode/plugins/docsnan.mjs  # plugin: command, skills, injeksi prompt
.opencode/command/docsnan.md    # template /docsnan
skills/docsnan/SKILL.md         # aturan log + riwayat (sumber injeksi)
hooks/docsnan-config.js         # mode on/off
hooks/docsnan-instructions.js   # bangun teks injeksi
hooks/docsnan-command.js        # router bare/on/off/update/version
hooks/docsnan-retrieve.js       # retrieval log deterministik + CLI
hooks/docsnan-update.js         # cek/update versi + CLI
test/                           # node:test, tanpa framework
docs/YYYYMMDD/                  # log eksekusi harian (flat lama tetap terbaca)
```

## Lisensi

MIT. Lihat [LICENSE](LICENSE).
