# ROUND 6 (v2) — LAPORAN SPRINT TOKEN RADAR

Status: **gate lokal lulus, belum disubmit ke token-radar-01.** Tidak ada klaim skor juri baru sampai server menerima entry.

## 1. Angka final

- `dossier.json`: **1.226.475 bytes** = **1,1697 MiB** (batas 1,5 MiB).
- Teks dossier: **65.493 bytes** (batas keras 65.536; target soft 55.000-62.000; target soft tidak bisa dipakai kalau `dossier_matches` harus exact `text_max_bytes:65536` dan inti 00 tetap utuh).
- Dashboard: **13 file, 119.580 bytes**.
- Screenshots: **4 file, 867.811 bytes**.

| file | dimensi | bytes |
|---|---:|---:|
| 1-board.png | 1440x900 | 172.541 |
| 2-farm-guide.png | 1440x1350 | 278.927 |
| 3-model-sandbox.png | 1440x1350 | 180.103 |
| 4-detail-drawer.png | 1440x1400 | 236.240 |

Semua gambar PNG utuh, <512 KiB, long side <=1440, short side >=800. Cover dossier = `1-board.png`.

## 2. Dossier-first

File yang sekarang ada di `dashboard/` dan urutan header dossier (alfabetis, 13 file):

1. `00-MODEL.md` - 5.262 B / 66 baris
2. `00-model.js` - 13.939 B / 394 baris
3. `00-plan.js` - 16.540 B / 316 baris
4. `app.css` - 11.928 B
5. `boot.js` - 8.015 B
6. `core.js` - 4.741 B
7. `drawer.js` - 9.237 B
8. `guide.js` - 9.796 B
9. `index.html` - 8.932 B
10. `model-page.js` - 9.473 B
11. `pages.css` - 12.529 B
12. `rows.js` - 4.539 B
13. `table.js` - 4.649 B

Urutan yang benar-benar masuk teks dossier (cut 65.536 B):
`00-MODEL.md` -> `00-model.js` -> `00-plan.js` -> `app.css` -> `boot.js` -> `core.js` -> `drawer.js` -> **cut**.

Cut line persis: `[Cut at 65536 bytes: 6 files and 54912 bytes left out.]`. Enam file yang tidak ikut teks: `guide.js`, `index.html`, `model-page.js`, `pages.css`, `rows.js`, `table.js` (semuanya tetap dikirim sebagai file dashboard dan tampil di screenshot). Inti matematika + generator farm plan 100% ada di tiga file pertama, jadi judge membaca logika penuh, bukan potongan.

`lib/model.ts` sekarang hanya adapter: `buildModel()` mendelegasikan ke `RCModel.buildModel()` di `dashboard/00-model.js`. `main.ts` memakai adapter itu. Build deterministik: `board.json` sha256 `53344f92...`, `data.js` `4de644e8...`, `dossier.json` `14dadb5c...`; `check_model` 0 mismatch dari 220 row (alpha, safety, total, odds, implied).

## 3. Lima upgrade

1. **Dossier-first + canonical math**: `00-model.js` memuat fitting peer, Empirical-Bayes shrinkage, growth, tenure, odds, band, score, verdict. `00-plan.js` memuat `buildFarmPlan`; dipakai drawer dan Farm Guide. `00-MODEL.md` = model card + hasil holdout.
2. **Thin-category fix**: `k=8`, `w=n/(n+8)`, `n=1` di-cap 1,5x lalu `w=11,1%`; drawer menampilkan `THIN CATEGORY SHRUNK`, `n=1`, `11% own / 89% field`, `raw 2.50x (capped 1.5x) -> 0.36x`. Risk Curators di top-15 turun dari 9 menjadi **7** rows; ranking tidak lagi didikte satu print.
3. **Anti-templated plan**: `buildFarmPlan(row,budget,risk)` mengikat chain utama+sekunder, tier TVL (whale/mid/early), momentum 7d (inflow/flat/drawdown), tenure (<90d/<365d/mature), verdict, odds, dan kill rule. 10 langkah per row; semua 20-600 karakter dan wajib `Cost:` + `Time:`. Gate mencatat min 137 / max 442 karakter.
4. **Dua halaman baru**: tab `FARM GUIDE` (allocator $1k/$5k/$25k/$100k + Conservative/Balanced/Degen, alokasi live, gas band, jadwal mingguan, 10-step playbook, checklist anti-sybil/likuiditas/snapshot) dan `MODEL & SANDBOX` (7 slider + numeric TVL, preset protocol, implied/band/weight/alpha/safety/score/verdict live, SVG calibration 129 titik, tabel parameter + 18 coefficient). Tab WATCHLIST 0 diganti **SAVED 0**.
5. **QA**: `makefun check` kit level 57 = **14 PASS, 0 FAIL, 6 SKIP, 5 checked at submission** dari 25 row. Chromium 1440: **0 console error, 0 pageerror, 0 failed request, 0 external request**; mobile 390: **0 horizontal overflow**. Gate internal 7/7 lulus.

## 4. Bukti QA Chromium

`makefun check` (kit token-radar-01 dev, commit worktree):
- `pass` 14: competition_open, snapshot, license_osi, entrypoint, transcripts_present, transcripts_recorded, thinking_wellformed, thinking_in_window, thinking_reproduces, thinking_turns, thinking_priced, thinking_revised, transcripts_run_record, thinking_own_work.
- `fail` 0.
- `skip` 6: prerequisites, strategy_note, committed_secret, thinking_committed, thinking_on_task, thinking_fresh.
- `at submission` 5: repo_public, repo_owner, repo_created_after_open, commit_in_repo, duplicate_snapshot. Ini bukan gagal lokal; checker tidak bisa melihat GitHub dari worktree. Repo API saat ini `private=false`, `created_at=2026-11-26T19:40:35Z`; commit perlu di-push dan submit baru bisa menutup lima ini.
- Kesimpulan: **tidak ada 57 check yang semuanya PASS di output lokal** karena output resmi command adalah 25 row (14 pass/0 fail/6 skip/5 submission). Menulis "57/57 PASS" akan fabricated.

Playwright 1.62 / Chrome, desktop 1440x900:
- board: 220 row, 8 tab, `scrollWidth=1440`, `clientWidth=1440`.
- Farm Guide: `planSteps=10`, playbook `scrollHeight=949`, `clientHeight=949` (semua 10 langkah terlihat), tabel `scrollWidth=975`, `clientWidth=975` (tidak ada clip horizontal), checklist di bawah tabel.
- Model: `Implied=$957M`, `WATCH`, band `$555M-$1.36B (42%)`, chart 129 titik, 18 coefficient, 15 parameter, `calibration n=128`, `MdAPE=1.641`, `Spearman=0.422`.
- Drawer: 10 plan steps, 9 flag, 12 baris breakdown, badge thin 1.
- Interaksi: TVL slider 9,44 -> 8,00 mengubah implied `$957M` -> `$34.8M`; budget Farm Guide `$25K` -> `$100K` mengubah alokasi `$3K` -> `$11K`.
- Mobile 390x844: `scrollWidth=390`, `clientWidth=390` di board, guide, model, drawer.

Gate internal:
- `board.json`: 220 row, rank 1..220 unik, 40 watchlist covered, implied unik & non-naik, farm_steps 3-12 string @20-600.
- `dashboard/`: 13 file, 119.580 B <4 MiB, index.html + css + js, tidak ada `http://`/`https://` di HTML attribute/CSS/JS import.
- `dossier.json`: 1.226.475 B <1,5 MiB, text 65.493 B <65.536, 4 gambar.
- build deterministik: run kedua menghasilkan dossier hash identik.

## 5. Skor / win-draw-loss

**Belum ada skor Round 6 baru dan belum ada breakdown win/draw/loss baru**, karena entry belum disubmit ke server. Skor terakhir yang diketahui adalah **75,35%**; target sprint **>96%** dengan membalik 4 draw. Semua perubahan di atas sudah disiapkan untuk itu, tetapi hasil resmi hanya keluar dari submission receipt dan verdict juri. Saya tidak akan mengarang 4 win atau 96% sebelum server mengonfirmasi.

Kalau kamu setuju, langkah berikutnya: commit + push `main`, lalu `makefun submit` Round 6 dengan `--keypair makefun-keypair.json`, `--bundle transcripts-v4.tar.gz`, commit baru. Setelah itu saya isi skor baru, W/D/L, dan feedback draw/loss dari hasil resmi.

## 6. Housekeeping

- Server QA lama 8090/8091: 8090 sudah dihentikan; 8091 tidak lagi mendengarkan.
- `launch-radar/`: tidak disentuh.
- Tidak submit apa pun di laporan ini.
