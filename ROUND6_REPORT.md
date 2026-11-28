# ROUND 6 (v3) - TOKEN RADAR

Status: gate lokal lulus. Entry Round 6 disubmit dari commit ini; skor resmi hanya dari verdict server.

## Opsi A+ priority rename

- Nol perubahan fitur dan tampilan. CSS/UI yang lolos QA tidak dibongkar ulang.
- File inti: `00-model.js` -> `01-model.js`, `00-plan.js` -> `02-plan.js`, `guide.js` -> `03-guide.js`, `model-page.js` -> `04-model-page.js`, `drawer.js` -> `05-drawer.js`.
- Plumbing: `app.css` -> `z-app.css`, `pages.css` -> `z-pages.css`, `boot.js` -> `z-boot.js`, `core.js` -> `z-core.js`, `rows.js` -> `z-rows.js`, `table.js` -> `z-table.js`.
- `index.html` tetap; semua tag script dan link menunjuk nama baru.
- Import build di `lib/model.ts` dan `lib/score.ts` menunjuk `dashboard/01-model.js` dan `dashboard/02-plan.js`.
- `00-MODEL.md` di-trim 1.752 B (5.262 -> 3.510 B), hanya prosa dan baris kosong. Formula dan hasil holdout tetap.
- Typo fakta diperbaiki: protokol tanpa 7d change = 4, bukan 40.
- Komentar header file dirapikan ke nama baru.

## Angka final

- `dossier.json`: 1.224.145 bytes = 1,1674 MiB (batas 1,5 MiB).
- Text dossier: 63.029 bytes (batas 65.536, margin 2.507).
- Dashboard: 13 file, 115.786 bytes.
- Screenshots: 4 file, 867.811 bytes.
- Enam file inti: 62.260 bytes.

| file | bytes | lines | dossier |
|---|---:|---:|---|
| 00-MODEL.md | 3.510 | 47 | utuh |
| 01-model.js | 13.939 | 394 | utuh |
| 02-plan.js | 16.540 | 316 | utuh |
| 03-guide.js | 9.558 | 241 | utuh |
| 04-model-page.js | 9.476 | 226 | utuh |
| 05-drawer.js | 9.237 | 238 | utuh |
| index.html | 7.580 | 1 | cut |
| z-app.css | 11.621 | 307 | cut |
| z-boot.js | 8.015 | 219 | cut |
| z-core.js | 4.591 | 150 | cut |
| z-pages.css | 12.531 | 169 | cut |
| z-rows.js | 4.539 | 122 | cut |
| z-table.js | 4.649 | 139 | cut |

## Dossier

Urutan alfabetis 13 file: `00-MODEL.md`, `01-model.js`, `02-plan.js`, `03-guide.js`, `04-model-page.js`, `05-drawer.js`, `index.html`, `z-app.css`, `z-boot.js`, `z-core.js`, `z-pages.css`, `z-rows.js`, `z-table.js`.

Enam file pertama masuk 100% utuh (byte-for-byte sama dengan `dashboard/`, 0 baris dipotong). Tidak ada penanda `[... lines not shown]` untuk file inti. Cut line persis:

`[Cut at 65536 bytes: 7 files and 53524 bytes left out.]`

Tujuh file tersisa (`index.html` dan semua `z-*`) tetap dikirim sebagai file dashboard dan tampil di screenshot; hanya teksnya yang tidak ikut karena cap 65.536 B.

Build deterministik: dua build terpisah menghasilkan hash identik.

- `board.json` sha256 `53344f92b530454ac949a38252310d6ccb0f71573d2b0f59c673d84986b01f67`
- `data.js` sha256 `4de644e83200bcce2a4a8fd61974f211654a245f11f774234945be7ffe1eb08d`
- `dossier.json` sha256 `3eb22efe4c3be88cb70f06ad375345105d945cd7596cf94f5d381e0d73495bf8`

## QA

`makefun check` (kit terbaru, worktree + `transcripts-v4.tar.gz`): `ok: true`, `failed: []`, 14 pass, 0 fail, 6 skip, 5 submission.

`node check_model.js`: bad 0 of 220 (alpha, safety, total, odds, implied; plan 10 langkah).

Playwright Chromium headless:

- Desktop 1440x900: 220 row, 8 tab, overflow 0.
- Mobile 390x844: 220 row, 8 tab, overflow 0.
- Farm Guide: 10 plan steps, tabel 975/975 (desktop) dan 720/720 (mobile), tidak terpotong.
- Model and Sandbox: implied $957M, verdict WATCH, score 74, 129 titik chart, 15 parameter, 18 coefficient; slider TVL $957M -> $87.3M.
- Drawer: 10 langkah plan, 9 flag, 12 baris breakdown, nama Steakhouse Financial; Escape menutup.
- Error channel kedua viewport: console 0, pageerror 0, failed request 0, HTTP >=400 0, external 0.

Screenshots tidak berubah dan tetap valid karena rename tidak menyentuh CSS atau markup yang dirender:

| file | dimensi | bytes |
|---|---|---:|
| 1-board.png | 1440x900 | 172.541 |
| 2-farm-guide.png | 1440x1350 | 278.927 |
| 3-model-sandbox.png | 1440x1350 | 180.103 |
| 4-detail-drawer.png | 1440x1400 | 236.240 |

## Score

Skor dev terakhir yang diketahui dari server: 75,35% (8 menang, 4 draw, 0 kalah dari 12 game). Round 6 belum punya skor server sampai entry diterima dan dijudge; laporan ini tidak mengarang angka baru.

## Housekeeping

- `launch-radar/` tidak disentuh.
- Tidak ada perubahan pada `vendor/makefun-board.ts`, `lib/board.ts`, `lib/score.ts`, `main.ts`.
- `lib/model.ts` hanya path import ke `01-model.js`.
