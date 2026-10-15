# 03 · Roadmap POSgrade

Status saat ini: **v0.1 — kerangka aplikasi yang sudah berfungsi penuh**
(kasir → transaksi → stok → struk → laporan harian, dengan kontrol akses per peran).

---

## Fase 0 — Fondasi ✅ (selesai)

- [x] Model data 9 koleksi + migration berversi
- [x] Web server Node tanpa dependency (statis + proxy + `/config.js` + `/healthz`)
- [x] Klien PocketBase buatan sendiri (`lib/pb.js`) dengan auth store & paginasi
- [x] Router hash dengan guard peran
- [x] Komponen UI bersama (layout, tabel, form) + pabrik halaman CRUD
- [x] Skrip operasional: setup binary, dev runner, seed idempotent
- [x] Uji end-to-end: login → shift → transaksi → stok → void → guard peran

## Fase 1 — Menuju siap pakai di toko nyata

- [ ] **Checkout atomik**: pindahkan pembuatan `sales` + `sale_items` ke satu
      endpoint hook `POST /api/pos/checkout` yang berjalan dalam satu transaksi
      database (sekarang header dan item dibuat berurutan dari klien).
- [ ] **Pembatalan baris** (partial refund) — bukan hanya void seluruh struk.
- [ ] **Diskon per produk & diskon persen** di halaman kasir.
- [ ] **Pembayaran campuran** (split payment: sebagian tunai, sebagian QRIS).
- [ ] **Printer thermal ESC/POS** langsung (WebUSB / WebSerial) atau agent lokal kecil.
- [ ] **Nomor struk per-terminal**: `INV-{KODE_TERMINAL}-{TANGGAL}-{URUT}`.
- [ ] **Login cepat kasir**: PIN 4–6 digit di samping email/sandi.
- [ ] **Kunci sesi otomatis** setelah N menit idle.

## Fase 2 — Operasional & laporan

- [ ] Laporan penjualan periode (harian/mingguan/bulanan) + grafik sederhana.
- [ ] Laporan laba kotor (omzet − HPP dari `products.cost`).
- [ ] Ekspor CSV/Excel dan cetak laporan PDF.
- [ ] **Modul pembelian**: supplier, penerimaan barang, hutang dagang.
- [ ] Rekap shift per kasir + rekap selisih kas.
- [ ] Analisis jam sibuk (heatmap transaksi per jam).
- [ ] Stok opname terjadwal dengan form input cepat.

## Fase 3 — Skala & integrasi

- [ ] **Multi gudang / multi toko** (`warehouses`, `stock_levels`).
- [ ] Sinkronisasi harga antar cabang.
- [ ] Integrasi pembayaran: QRIS dinamis, EDC, e-wallet.
- [ ] Program loyalitas berjenjang (tier, diskon member, tukar poin).
- [ ] Promo otomatis: beli 2 gratis 1, bundling, diskon jam tertentu.
- [ ] **Mode offline penuh**: antrean transaksi di IndexedDB + sinkronisasi otomatis
      saat koneksi kembali (PocketBase client-side caching + Service Worker).
- [ ] Realtime multi-kasir (PocketBase Realtime) agar stok di layar kasir lain ikut berubah.
- [ ] WhatsApp/email struk digital.

## Fase 4 — Kualitas teknis

- [ ] **Smoke test render UI di browser** (prioritas tinggi). Uji lewat API saja
      tidak cukup: pernah terjadi bug yang membuat seluruh UI gagal dirender
      (`outlet` tidak diteruskan router ke view) namun semua uji API tetap hijau.
      Rencana: skrip kecil berbasis Chrome DevTools Protocol yang membuka setiap
      route, memastikan tidak ada error di console, lalu mengambil screenshot.
- [ ] **Uji otomatis**: unit test untuk `lib/cart.js`, `lib/format.js`, `lib/pb.js`
      (pakai `node --test` bawaan Node, tanpa dependency).
- [ ] Uji integrasi API untuk setiap aturan akses (regresi keamanan).
- [ ] PWA: manifest + Service Worker + ikon agar bisa di-*install* di tablet kasir.
- [ ] Aksesibilitas: audit kontras, navigasi keyboard penuh di halaman kasir.
- [ ] i18n: pemisahan string ke berkas terjemahan (ID/EN).
- [ ] Audit log aksi pengguna (siapa mengubah apa, kapan).

---

## TODO teknis yang diketahui (technical debt)

| # | Lokasi | Masalah | Rencana |
| --- | --- | --- | --- |
| 1 | `public/js/services.js` | `createSale()` membuat header lalu item satu per satu; bila gagal di tengah, rollback dilakukan manual dengan menghapus header. | Pindahkan ke hook `POST /api/pos/checkout` dengan `runInTransaction`. |
| 2 | `public/js/views/dashboard.js` | `topProducts()` mengambil semua `sale_items` lalu agregasi di klien. | Ganti dengan query agregat (`GROUP BY`) lewat hook atau view collection. |
| 3 | `public/js/lib/pb.js` | Belum ada retry otomatis untuk request gagal (jaringan tidak stabil). | Tambah exponential backoff untuk method idempotent (GET). |
| 4 | `public/js/lib/pb.js` | Belum memanfaatkan PocketBase Realtime. | Tambah `subscribe()` berbasis EventSource/fetch-stream untuk stok & transaksi. |
| 5 | `pb/pb_hooks/main.pb.js` | Kegagalan penyesuaian stok hanya dicatat ke log, penjualan tetap sukses. | Tambahkan rekonsiliasi berkala / tombol "perbaiki stok dari mutasi". |
| 6 | `server/index.js` | Belum ada rate limiting / header keamanan produksi (CSP). | Tambah CSP + `helmet`-like header manual (tetap tanpa dependency). |
| 7 | `public/js/views/products.js` | Mengubah `stock` langsung dari form produk tidak tercatat sebagai mutasi. | Arahkan perubahan stok ke `services.adjustStock()`. |
| 8 | Umum | Belum ada uji otomatis. | Mulai dari `node --test` untuk modul murni (cart, format, pb). |

---

## Kriteria rilis

| Versi | Kriteria |
| --- | --- |
| **0.1** ✅ | Kasir dapat bertransaksi, stok & struk benar, peran ditegakkan, `npm run dev` jalan dari nol. |
| **0.2** | Checkout atomik, printer thermal, diskon fleksibel, laporan periode + ekspor. |
| **0.3** | Modul pembelian + supplier, stok opname, rekap shift lengkap. |
| **1.0** | Multi-toko, mode offline, uji otomatis menyeluruh, dokumentasi operasional toko. |
