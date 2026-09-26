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

Struktur plugin persis [ponytail](https://github.com/DietrichGebert/ponytail):
`SKILL.md` sebagai sumber tunggal, `hooks/` sebagai builder + config,
`.opencode/plugins/` sebagai injeksi system prompt tiap turn,
`.opencode/command/` sebagai slash command.

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
| `/docsnan on` | Nyalakan kewajiban log (default) |
| `/docsnan off` | Matikan sampai dinyalakan lagi |

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

## Struktur

```
docsnan/
├── package.json
├── AGENTS.md
├── README.md
├── LICENSE
├── assets/docsnan.png
├── .opencode/plugins/docsnan.mjs
├── .opencode/command/docsnan.md
├── skills/docsnan/SKILL.md
├── hooks/docsnan-config.js
└── hooks/docsnan-instructions.js
```

## Lisensi

MIT. Lihat [LICENSE](LICENSE).
