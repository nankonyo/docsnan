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
config — ia wajib menutupnya dengan 1 file log di folder `docs/`
project tersebut. Satu eksekusi, satu file. Obrolan biasa dan plan
tanpa eksekusi tidak dicatat.

## Contoh hasil

Selesai fix login, agent menulis `docs/fix-login_20260926-143022.log`:

```
Judul: Fix login null saat password kosong
Tipe: fix
Waktu: 2026-09-26 14:30:22
Ringkasan: Login crash saat password kosong. Tambah guard kosong.
Ubah:
- auth/login.js: cek password kosong sebelum hash, return 400.
Uji: POST /login tanpa password balas 400. npm test lolos.
```

## Cara kerja

1. Plugin injeksi aturan docsnan ke system prompt setiap turn (bila mode `on`).
2. Agent kerja seperti biasa.
3. Saat eksekusi selesai, agent buat folder `docs/` bila belum ada,
   lalu tulis 1 file baru `<slug>_YYYYMMDD-HHmmss.log`.
4. Slug dari judul tugas: lowercase, non-alfanumerik jadi `-`, maks 50 char.
   Timestamp waktu lokal via `date +%Y%m%d-%H%M%S`.
5. File log lama tidak pernah ditimpa. Selalu file baru.

Kapan wajib: ada file diubah/dibuat/dihapus, atau perintah
build/test/deploy dijalankan. Kapan skip: obrolan biasa, tanya jawab,
plan tanpa eksekusi, baca kode tanpa perubahan. Aturan putus: tidak ada
perubahan file dan tidak ada perintah = tidak ada log.

## Install

### OpenCode (npm)

```bash
npm i docsnan
```

```json
{ "plugin": ["docsnan"] }
```

### OpenCode (dari checkout)

```json
{ "plugin": ["./.opencode/plugins/docsnan.mjs"] }
```

Path `./` relatif terhadap `opencode.json` project. Untuk satu checkout
dipakai banyak project, isi path absolut ke file `.mjs` (ia temukan
`hooks/` dan `skills/` relatif ke lokasinya sendiri).

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

Singkat, poin penting saja, 6 field. 1–3 baris per field, tanpa essay:

```
Judul: <judul tugas>
Tipe: <fitur|fix|debug|refactor|lainnya>
Waktu: <YYYY-MM-DD HH:MM:SS lokal>
Ringkasan: <masalah/permintaan, 1-2 kalimat>
Ubah: <file/fungsi utama + kenapa, bullet pendek>
Uji: <cara uji + hasil, 1-2 baris>
```

Format lama tetap terbaca. Field tak dikenal diabaikan, tak pernah crash.

## Riwayat (log sebagai memori kerja)

Log `docs/` juga jadi memori kerja ringan. Saat user tanya soal kerja
lampau ("What did we change recently in authentication?", "Apa yang
sudah difix kemarin?"), agent cek log dulu sebelum bongkar source tree:

```text
Search docs/*.log
↓
Find relevant authentication logs
↓
Sort newest first
↓
Read relevant logs
↓
Summarize the changes
```

Aturan: deteksi intent riwayat dulu (recent/previous/last/yesterday /
terakhir/kemarin/riwayat/sudah difix). Bila bukan pertanyaan riwayat,
bagian ini dormant — `docs/` tak disentuh. Bila ya: `ls docs/*.log`
terbaru dulu, pilih maks 3 paling relevan (cocok nama/judul/tipe/kata
kunci/file di field Ubah), baca hanya itu. Folder kosong: jawab terus
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

## Lisensi

MIT. Lihat [LICENSE](LICENSE).
