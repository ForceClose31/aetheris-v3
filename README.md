# Aetheris

**The Quiet Before** — RPG aksi 2D untuk browser. Perjalanan dimulai sebagai warga biasa di Larkhaven, tanpa kekuatan khusus atau garis keturunan legendaris.

## Menjalankan

Gunakan Node.js 22.16+ dan npm. Jalankan dari direktori proyek:

```sh
npm ci
npm run dev
```

Buka alamat lokal yang dicetak Vite, biasanya `http://127.0.0.1:5173`. Game mendukung browser modern dengan WebGL atau Canvas, keyboard/mouse, dan tombol sentuh pada layar kecil. Tidak memerlukan akun atau server backend. Font web memiliki fallback sistem apabila koneksi tidak tersedia.

```sh
npm run build          # Type-check dan build produksi ke dist/
npm run preview        # Pratinjau hasil build
npm test               # Pengujian aturan gameplay dan save
npm run typecheck      # Pemeriksaan TypeScript strict
npm run format         # Format source dengan Prettier
npm run format:check   # Periksa format tanpa mengubah file
npm run test:browser   # Pengujian browser dengan Chrome yang terpasang
```

Untuk browser lain, ubah `channel` pada `playwright.config.ts`; gunakan `npx playwright install chromium` dan hapus `channel` jika memakai browser bawaan Playwright. Tes headless memakai fallback Canvas agar hasil tidak bergantung pada akselerasi GPU mesin pengujian.

## Cara bermain

| Kontrol                         | Aksi                                        |
| ------------------------------- | ------------------------------------------- |
| WASD / tombol panah             | Bergerak                                    |
| J / klik kiri                   | Serangan combo; klik membidik arah kursor   |
| Spasi / Shift kiri / klik kanan | Menghindar; memakai stamina                 |
| E                               | Bicara, memetik, membuka peti, beristirahat |
| Q                               | Skill setelah memilih job                   |
| R                               | Minum tonik                                 |
| L / I / M                       | Jurnal / inventaris / peta                  |
| Esc                             | Jeda / tutup panel                          |

Temui **Mara** di dekat sumur. Seberangi jembatan, kalahkan tiga Moss Slime, dan petik tiga Moonleaf. Kembali ke Mara, persiapkan pedang besi dan tonik dari **Borin**, lalu selidiki **The Old Watch**. **Elian** memulihkan HP tanpa biaya. **Sera** menawarkan delapan job pada level 10; pilihan bersifat permanen.

## Penyimpanan

Tersedia tiga slot di `localStorage`, manual save lewat menu atau api unggun, dan autosave setiap 30 detik permainan aktif. Memuat slot mengganti perjalanan aktif setelah konfirmasi. Save menyimpan karakter, inventaris, posisi, quest, peti, bahan yang dipetik, waktu, dan stok pedagang; posisi/HP musuh biasa direset ketika memuat. Boss yang sudah dikalahkan tetap mati.

Data mengikuti browser **dan origin**, termasuk port. Menghapus data situs menghapus save. Tidak ada sinkronisasi cloud. Kehilangan seluruh HP mengembalikan karakter ke desa dan mengurangi gold sekitar 10%, tanpa menghapus progression.

## Struktur

```text
src/content/       # Definisi job, item, musuh, dan peta buatan tangan
src/domain/        # Aturan combat, ekonomi, progression; tanpa Phaser/DOM
src/game/          # Scene dan sistem runtime
src/rendering/     # Tekstur pixel dan pembangunan visual dunia
src/platform/      # Input, audio sintetis, adapter penyimpanan
src/ui/            # HUD, dialog, menu, dan peta
tests/unit/        # Invariant gameplay dan integritas save
tests/browser/     # Alur permainan melalui browser
```
