# 00 · Rencana Aplikasi POSgrade

> Dokumen ini adalah peta jalan tingkat tinggi: **apa** yang dibangun, **kenapa**
> dipilih begitu, dan **bagaimana** urutan pengerjaannya.

---

## 1. Tujuan produk

Membangun aplikasi Point of Sale (kasir) yang:

1. **Cepat dipakai** — kasir bisa menyelesaikan satu transaksi < 15 detik
   (cari produk → klik → bayar → struk).
2. **Jujur secara data** — setiap perubahan stok dan kas punya jejak audit.
3. **Mudah dirawat** — tanpa build step, tanpa `node_modules` di sisi web,
   satu binary untuk backend.
4. **Aman secara default** — hak akses ditegakkan di server (API Rules),
   bukan sekadar menyembunyikan tombol.
5. **Bisa jalan lokal & offline** — PocketBase + Node berjalan di satu mesin
   (PC kasir / mini PC) tanpa perlu internet.

## 2. Ruang lingkup

### Termasuk (versi 0.1 ini)

| Modul | Ringkasan |
| --- | --- |
| Autentikasi & peran | Login email/sandi, peran owner / admin / cashier |
| Kasir | Katalog produk, pencarian, keranjang, diskon, pajak, pembayaran, struk |
| Riwayat transaksi | Daftar struk, detail, cetak ulang, void (batalkan) |
| Master data | Produk, kategori, pelanggan |
| Stok | Pengurangan otomatis, pengembalian saat void, audit trail, penyesuaian manual |
| Shift kasir | Kas awal, kas seharusnya, kas aktual, selisih |
| Dashboard | Omzet harian, jumlah transaksi, produk terlaris, stok menipis |
| Pengaturan | Identitas toko, pajak, pembulatan, footer struk |
| Pengguna | CRUD akun + peran (khusus owner) |

### Belum termasuk (lihat `03-ROADMAP.md`)

Pembelian ke supplier, multi gudang, multi toko, program loyalitas berjenjang,
diskon otomatis/promo, integrasi pembayaran (QRIS/EDC), printer thermal langsung
(ESC/POS), mode offline penuh, laporan ekspor Excel/PDF.

## 3. Keputusan teknologi & alasannya

| Keputusan | Alasan |
| --- | --- |
| **PocketBase** sebagai backend | Satu binary: SQLite + Auth + REST + Realtime + dashboard admin. Tidak perlu menulis API CRUD, tidak perlu ORM, tidak perlu server database terpisah. Sangat cocok untuk POS toko kecil–menengah. |
| **Node.js tanpa dependency** | Server hanya perlu 3 hal: sajikan file statis, suntik konfigurasi runtime, proxy ke PocketBase. Semuanya bisa dengan modul `http` bawaan → tidak ada `npm install`, tidak ada supply-chain risk. |
| **HTML/CSS/JS native (ES Modules)** | Tanpa bundler, tanpa transpiler, tanpa `node_modules`. Edit file → refresh browser. Umur pakai panjang karena tidak bergantung pada framework yang cepat berubah. |
| **Reverse proxy `/pb/*`** | Frontend & API jadi same-origin: CORS hilang, port PocketBase tidak terekspos, dan produksi bisa ditambahkan HTTPS di satu tempat. |
| **Hash router** (`#/pos`) | Tidak perlu aturan rewrite di server, aman untuk hosting statis apa pun. |
| **Nomor struk & stok di server (pb_hooks)** | Klien tidak boleh jadi sumber kebenaran untuk nomor dokumen maupun stok. |

## 4. Prinsip desain yang dipegang

1. **Server adalah hakim.** Validasi penting (nomor struk, kasir, stok) tidak
   bergantung pada input klien.
2. **Snapshot di transaksi.** `sale_items` menyimpan nama & harga produk saat
   terjual, sehingga mengubah harga produk tidak merusak riwayat.
3. **Uang = bilangan bulat.** Semua nominal rupiah disimpan sebagai integer
   (`noDecimal: true`) agar tidak ada galat pembulatan floating point.
4. **Satu tempat untuk satu hal.** Instance PocketBase hanya dibuat di `api.js`;
   logika domain hanya di `services.js`; view tetap tipis.
5. **UI konsisten.** Semua tabel lewat `components/table.js`, semua form lewat
   `components/form.js`, semua halaman master data lewat pabrik `views/crud.js`.

## 5. Urutan pengerjaan (yang sudah dilaksanakan)

| # | Langkah | Hasil |
| --- | --- | --- |
| 1 | Rancang model data | 9 koleksi (lihat `02-DATA-MODEL.md`) |
| 2 | Tulis migration PocketBase | `pb/pb_migrations/17500000xx_*.js` |
| 3 | Tulis hook server | `pb/pb_hooks/main.pb.js` |
| 4 | Buat web server Node | `server/index.js` + static + proxy |
| 5 | Buat library frontend | `lib/pb, router, dom, cart, modal, toast, format, receipt, store` |
| 6 | Buat komponen | `layout`, `table`, `form`, pabrik `crud` |
| 7 | Buat halaman | login, dashboard, pos, products, categories, customers, sales, stock, shifts, users, settings |
| 8 | Skrip operasional | `setup-pocketbase.sh`, `dev.sh`, `seed.mjs` |
| 9 | Uji end-to-end | login → shift → transaksi → stok → void → guard peran |

## 6. Definisi "selesai" untuk versi ini

- [x] `npm run dev` menyalakan seluruh sistem dari nol (unduh PB, migrasi, seed).
- [x] Kasir dapat menyelesaikan transaksi dan mencetak struk.
- [x] Stok berkurang saat penjualan dan kembali saat void — otomatis, dengan audit trail.
- [x] Nomor struk dibuat server, tidak dapat diduplikasi (unique index).
- [x] Kasir tidak dapat mengubah produk, menghapus data, atau melihat daftar pengguna.
- [x] Tidak ada satu pun dependency npm untuk menjalankan aplikasi.
