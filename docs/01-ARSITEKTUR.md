# 01 · Arsitektur POSgrade

## 1. Gambaran lapisan

```
┌──────────────────────────────────────────────────────────────────────┐
│  BROWSER  (public/)                                                  │
│  HTML + CSS + ES Modules — tanpa bundler, tanpa framework            │
│                                                                      │
│   main.js ── Router(hash) ── views/*  ── components/*                │
│      │                          │                                    │
│      │                          └── services.js (logika domain)      │
│      │                                     │                         │
│      └── api.js ── lib/pb.js (klien REST buatan sendiri)             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  fetch("/pb/api/collections/...")
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  NODE.JS WEB SERVER  (server/)                                       │
│                                                                      │
│   GET /            → file statis dari public/ (+ SPA fallback)       │
│   GET /config.js   → window.__POS_CONFIG__ (URL API, versi, dev)     │
│   GET /healthz     → status app + status PocketBase                  │
│   ALL /pb/*        → reverse proxy transparan (streaming/SSE aman)   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  http://127.0.0.1:8090/*
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  POCKETBASE  (pb/)                                                   │
│   · SQLite (pb_data/data.db)                                         │
│   · REST API /api/collections/{name}/records                         │
│   · Auth + API Rules (otorisasi per koleksi & per baris)             │
│   · Dashboard admin di /_/                                          │
│   · pb_hooks/main.pb.js  → hook server-side                          │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Mengapa ada web server Node di depan PocketBase?

PocketBase sudah punya REST API dan bisa menyajikan file statis (`pb_public`).
Tetap ada satu lapisan Node karena memberi empat manfaat:

| Manfaat | Penjelasan |
| --- | --- |
| **Same-origin, bebas CORS** | Browser hanya bicara ke `:3000`. Tidak ada preflight, tidak ada konfigurasi CORS. |
| **Backend tidak terekspos** | Port 8090 cukup di-bind ke `127.0.0.1`; hanya Node yang mengaksesnya. |
| **Konfigurasi runtime** | `/config.js` menyuntikkan `window.__POS_CONFIG__` tanpa perlu rebuild aset. |
| **Titik tambah di masa depan** | Webhook, rate limit, ekspor laporan, atau endpoint kustom bisa ditambah tanpa menyentuh frontend. |

Proxy ditulis dengan `http.request` + `pipe()` sehingga **streaming tetap bekerja**
(penting bila nanti memakai Realtime SSE PocketBase).

## 3. Peta modul frontend

| Berkas | Tanggung jawab |
| --- | --- |
| `js/main.js` | Bootstrap: validasi sesi → preload data → bangun router → render shell. Juga memutus siklus ketika token dicabut server. |
| `js/api.js` | **Satu-satunya** tempat `new PocketBase()`. Juga mengekspor pintasan koleksi (`db.products`, `db.sales`, ...). |
| `js/services.js` | Logika domain: pengaturan, kategori, pencarian produk, shift, pembuatan transaksi, ringkasan harian, produk terlaris, penyesuaian stok, pelanggan. |
| `js/lib/pb.js` | Klien REST PocketBase minimal: auth store (localStorage), `request()`, CRUD koleksi, `getFullList()` dengan paginasi otomatis, `buildFilter()`, `quote()`. |
| `js/lib/router.js` | Router hash dengan guard: `public`, `roles`, redirect otomatis. |
| `js/lib/dom.js` | Helper `h()`, event delegation, `readForm()`, `setBusy()`, `debounce()`. |
| `js/lib/cart.js` | State keranjang: tambah/kurang/hapus, diskon baris, pajak & pembulatan, persist ke localStorage. |
| `js/lib/modal.js` | Modal generik, `confirmDialog()`, penggantian isi modal. |
| `js/lib/receipt.js` | Render HTML struk + cetak ke window terpisah. |
| `js/lib/store.js` | State bersama (`settings`, `categories`, `shift`, `lowStockCount`). |
| `js/components/layout.js` | Sidebar (menu difilter per peran), topbar, outlet konten. |
| `js/components/table.js` | `dataTable()`, `skeletonTable()`, `tableCard()`. |
| `js/components/form.js` | `field()`, `textInput()`, `numberInput()`, `selectInput()`, `checkboxInput()`, `showFieldErrors()`. |
| `js/views/crud.js` | Pabrik halaman CRUD (pencarian + tabel + paginasi + form modal). |

## 4. Alur data: satu transaksi penjualan

```
1. Kasir klik produk
   pos.js → cart.add(product)                 (state lokal + localStorage)

2. Kasir klik "Bayar (F9)"
   pos.js → openCheckout()                    modal: pelanggan, diskon, metode, jumlah bayar
   cart.totals({ taxPercent, taxIncluded, roundTo100, billDiscount })

3. Submit
   services.createSale(payload, items)
      ├── POST /pb/api/collections/sales/records
      │      └── hook: isi receipt_no + sold_at + cashier (dari token, bukan dari klien)
      └── POST /pb/api/collections/sale_items/records      (untuk setiap item)
             └── hook: stok produk -= qty, catat stock_moves (dalam satu transaksi)
   Bila salah satu item gagal → header dihapus kembali (rollback manual di services.js)

4. Sukses
   pos.js → cart.clear() → showReceipt() → cetak struk
   services.addLoyaltyPoints(customer, floor(total / 10000))
```

Penanganan error: `lib/pb.js` melempar `ApiError` berisi `status`, `message`, dan
`data` (pesan validasi per field). `showFieldErrors()` menempelkan pesan tersebut
ke input yang bersangkutan.

## 5. Alur data: void / refund

```
sales.js → services.voidSale(id) → PATCH status = "void"
   └── hook onRecordUpdateRequest("sales"):
          bila status berubah dari "completed" → "void"/"refunded":
             untuk setiap sale_items → stok += qty, catat stock_moves
```

## 6. Hak akses berlapis

| Lapisan | Contoh |
| --- | --- |
| **Menu** (`layout.js`) | Menu Produk hanya dirender bila peran termasuk `owner`/`admin`. |
| **Route** (`router.js`) | `roles: ["owner","admin"]` → kasir yang mengetik `#/products` otomatis dialihkan. |
| **Tombol** (`pb.can()`) | Tombol "Hapus" tidak dirender bila tidak punya `manage:all`. |
| **Server** (API Rules) | **Lapisan yang menentukan.** Kasir tetap ditolak walau memanggil API langsung. |

## 7. Titik ekstensi yang sudah disiapkan

| Kebutuhan | Tempat menambah |
| --- | --- |
| Endpoint kustom (checkout atomik, laporan PDF) | `pb/pb_hooks/main.pb.js` (routing PocketBase) atau `server/index.js` |
| Aturan bisnis baru saat transaksi | hook `onRecordCreateRequest("sales")` |
| Kolom baru pada tabel | tambah migration baru di `pb/pb_migrations/` |
| Halaman baru | tambah file di `public/js/views/` + daftarkan di `routes` (`main.js`) |
| Tema / warna | ubah CSS custom properties di `public/css/base.css` |

## 8. Kinerja & batasan yang perlu diketahui

| Hal | Kondisi saat ini | Catatan |
| --- | --- | --- |
| Paginasi daftar | 25 baris/halaman (server-side) | `getFullList()` memakai 500 baris/request |
| Keranjang | localStorage | Hilang bila localStorage dibersihkan browser |
| Pembuatan transaksi | header lalu item, berurutan | Belum atomik 100%; lihat TODO di ROADMAP |
| Realtime | belum dipakai | Halaman di-refresh manual / setelah aksi |
| Laporan | dihitung di klien | Cukup untuk ratusan struk/hari; untuk volume besar pindahkan ke SQL/hook |
| Cetak struk | `window.print()` | Belum bicara langsung ke printer thermal (ESC/POS) |
