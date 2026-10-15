# POSgrade — Aplikasi Point of Sale (Native HTML + Node.js + PocketBase)

Aplikasi kasir (POS) ringan dengan **tiga teknologi inti** dan **nol framework frontend**:

| Lapisan | Teknologi | Catatan |
| --- | --- | --- |
| Database, Auth, API | **PocketBase** (single binary, SQLite) | REST API + dashboard admin bawaan |
| Web server | **Node.js** (modul `http` bawaan) | 0 dependency npm, sekaligus reverse proxy |
| Antarmuka | **HTML + CSS + Vanilla JS (ES Modules)** | tanpa bundler, tanpa build step |

---

## 1. Fitur yang sudah jalan

- 🔐 **Login & peran** — `owner`, `admin`, `cashier`, ditegakkan lewat API Rules PocketBase (bukan sekadar menyembunyikan menu).
- 🛒 **Kasir (POS)** — pencarian produk (nama/SKU/barcode), filter kategori, keranjang persisten, diskon nota, pajak, pembulatan, multi metode bayar, pintasan `F2` / `F9`.
- 🧾 **Struk** — nomor struk digenerate **di server**, cetak & cetak ulang, cocok untuk printer 58/80 mm.
- 📦 **Master data** — produk, kategori, pelanggan (CRUD + pencarian + paginasi).
- 📥 **Stok** — pengurangan otomatis saat penjualan, pengembalian saat void/refund, **audit trail** (`stock_moves`), penyesuaian manual.
- 🕒 **Shift kasir** — kas awal, kas seharusnya, kas aktual, dan selisih.
- 📊 **Dashboard** — omzet harian, jumlah transaksi, produk terlaris, stok menipis.
- 🧑‍💼 **Pengguna** — kelola akun & peran (khusus owner).
- ⚙️ **Pengaturan toko** — identitas, pajak, pembulatan, footer struk.

---

## 2. Mulai cepat (1 perintah)

```bash
npm run dev
```

Perintah tersebut otomatis:

1. membuat `.env` dari `.env.example` (bila belum ada),
2. mengunduh binary PocketBase ke `.tools/`,
3. membuat superuser `admin@posgrade.local`,
4. menjalankan PocketBase di `127.0.0.1:8090` + aplikasi di `http://127.0.0.1:3000`.

Buka **http://127.0.0.1:3000**, lalu login memakai data contoh:

| Peran | Email | Sandi |
| --- | --- | --- |
| Pemilik | `owner@posgrade.local` | `posgrade123` |
| Admin | `admin@posgrade.local` | `posgrade123` |
| Kasir | `kasir@posgrade.local` | `posgrade123` |

> Akun demo dibuat oleh `npm run pb:seed`. Untuk database kosong, lewati seed dan
> buat akun pertama dari Dashboard PocketBase (`http://127.0.0.1:8090/_/`) dengan
> mengisi field `role = owner`.

### Perintah lain

```bash
npm start                  # jalankan hanya web server Node
npm run pb                 # jalankan hanya PocketBase
npm run pb:migrate         # terapkan migration secara manual
npm run pb:seed            # isi data contoh (idempotent)
npm run pb:superuser -- admin@toko.id rahasia123
npm run check              # cek sintaks server
```

---

## 3. Struktur proyek

```
.
├── server/                     # Web server Node.js (zero dependency)
│   ├── index.js                #   routing: statis + /config.js + /healthz + proxy
│   ├── config.js               #   pembaca .env tanpa library
│   └── lib/{static,proxy,mime}.js
├── public/                     # Frontend native (tanpa build step)
│   ├── index.html
│   ├── css/{base,app}.css      #   design token + komponen
│   └── js/
│       ├── main.js             #   bootstrap + definisi route
│       ├── api.js              #   instance PocketBase + pintasan koleksi
│       ├── services.js         #   logika domain (transaksi, shift, stok, laporan)
│       ├── lib/                #   pb, router, dom, cart, modal, toast, format, receipt, store
│       ├── components/         #   layout, table, form
│       └── views/              #   login, dashboard, pos, crud, sales, stock, shifts, users, settings
├── pb/
│   ├── pb_migrations/          # 7 migration: schema + pengaturan default + rule users
│   └── pb_hooks/main.pb.js     # logika server: nomor struk, stok otomatis, void
├── scripts/                    # setup-pocketbase.sh, pocketbase.sh, dev.sh, seed.mjs
└── docs/                       # RENCANA, ARSITEKTUR, DATA-MODEL, ROADMAP
```

---

## 4. Arsitektur singkat

```
Browser (HTML/JS native)
   │  fetch("/pb/api/collections/...")
   ▼
Node.js :3000  ── /config.js · /healthz · file statis
   │  reverse proxy (same-origin, bebas CORS)
   ▼
PocketBase :8090 ── REST API · Auth · SQLite · Dashboard /_/
   └── pb_hooks/main.pb.js (nomor struk, stok otomatis, void)
```

Browser tidak pernah tahu URL PocketBase sebenarnya — semuanya lewat `/pb/*`
yang diteruskan server Node. Penjelasan lengkap: [`docs/01-ARSITEKTUR.md`](docs/01-ARSITEKTUR.md).

---

## 5. Keamanan & hak akses

Aturan akses ditegakkan di **server PocketBase** (API Rules), bukan hanya di UI:

| Koleksi | List | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `products`, `categories` | login | owner/admin | owner/admin | owner |
| `customers` | login | login | login | owner/admin |
| `sales`, `sale_items` | login | login | owner/admin | owner |
| `stock_moves` | login | login | owner/admin | owner |
| `shifts` | login | login | pemilik shift / owner / admin | owner |
| `settings` | publik | owner/admin | owner/admin | owner |
| `users` | owner/admin | **owner saja** | diri sendiri / owner | owner |

Kredensial superuser hanya dipakai skrip CLI (`scripts/seed.mjs`) dan
**tidak pernah** dikirim ke browser.

---

## 6. Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [`docs/00-RENCANA.md`](docs/00-RENCANA.md) | Rencana & keputusan awal proyek |
| [`docs/01-ARSITEKTUR.md`](docs/01-ARSITEKTUR.md) | Arsitektur, alur data, alasan pemilihan teknologi |
| [`docs/02-DATA-MODEL.md`](docs/02-DATA-MODEL.md) | 9 koleksi, relasi, dan aturan akses |
| [`docs/03-ROADMAP.md`](docs/03-ROADMAP.md) | Rencana pengembangan bertahap + TODO teknis |

---

## 7. Menuju produksi

1. Buat superuser sungguhan lalu hapus akun demo (`npm run pb:superuser -- ...`).
2. Set `DEV=0`, bind ke `0.0.0.0`, dan letakkan di belakang reverse proxy HTTPS (Caddy/Nginx).
3. Aktifkan backup berkala: Dashboard → Settings → Backups, atau `./pocketbase backup`.
4. Untuk volume tinggi, pindahkan pembuatan transaksi ke satu hook
   `POST /api/pos/checkout` agar benar-benar atomik (lihat TODO di ROADMAP).

---

## 8. Alternatif: Docker

```bash
docker compose up -d --build
docker compose exec pocketbase /pb/pocketbase superuser upsert admin@posgrade.local posgrade123
docker compose exec web node /app/scripts/seed.mjs   # opsional
# buka http://localhost:3000
```
