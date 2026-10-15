# 02 · Model Data POSgrade

Semua koleksi dibuat lewat migration di `pb/pb_migrations/`. Nama file migration
memakai prefix timestamp unix agar PocketBase menerapkannya berurutan.

> **Catatan penting:** pada PocketBase v0.40, koleksi baru hanya mendapat field
> `id` secara otomatis. Field `created` dan `updated` (tipe `autodate`) **harus
> dideklarasikan manual**, kalau tidak kolomnya tidak akan ada di SQLite.

---

## 1. Diagram relasi

```
                        ┌──────────────┐
                        │    users     │ (auth, bawaan PocketBase)
                        │  + role      │
                        └──┬───┬───┬───┘
              cashier ─────┘   │   └───── user (audit stok)
                               │
   ┌──────────────┐      ┌─────▼──────┐        ┌──────────────┐
   │  categories  │◄─────┤  products  │        │  customers   │
   └──────────────┘ 1..n └─────┬──────┘        └──────┬───────┘
                               │                      │
                               │ product              │ customer
                               ▼                      ▼
   ┌──────────────┐     ┌─────────────┐        ┌─────────────┐
   │ stock_moves  │     │ sale_items  │◄───────┤    sales    │
   └──────────────┘     └─────────────┘  n..1  └──────┬──────┘
                                                     │ shift
                                              ┌──────▼──────┐
                                              │   shifts    │
                                              └─────────────┘

   ┌──────────────┐
   │   settings   │  (singleton, 1 record)
   └──────────────┘
```

## 2. Ringkasan koleksi

| Koleksi | Jenis | Migration | Fungsi |
| --- | --- | --- | --- |
| `users` | auth (bawaan) | `...004_extend_users`, `...006_users_rules` | Akun login + `role`, `full_name`, `phone`, `active` |
| `categories` | base | `...000_init_categories_products` | Pengelompokan produk |
| `products` | base | `...000_init_categories_products` | Katalog barang, harga, stok |
| `customers` | base | `...001_init_customers_shifts` | Data pelanggan / member |
| `shifts` | base | `...001_init_customers_shifts` | Sesi kasir (buka/tutup) |
| `sales` | base | `...002_init_sales` | Header struk |
| `sale_items` | base | `...002_init_sales` | Baris item struk (snapshot) |
| `stock_moves` | base | `...003_init_stock_moves_settings` | Audit trail mutasi stok |
| `settings` | base | `...003_init_stock_moves_settings` | Pengaturan toko (singleton) |

## 3. Detail field

### 3.1 `users` (auth)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `email` | email | Bawaan PocketBase, identitas login |
| `password` | password | Bawaan |
| `full_name` | text (120) | **Tambahan** — nama tampil di topbar & struk |
| `phone` | text (32) | **Tambahan** |
| `role` | select | **Tambahan** — `owner` \| `admin` \| `cashier` |
| `active` | bool | **Tambahan** — akun nonaktif ditolak saat login |

### 3.2 `categories`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `name` | text (80), required | **Unique index** |
| `description` | text (300) | |
| `sort_order` | number (int) | Urutan tampil di kasir |
| `active` | bool | |
| `created`, `updated` | autodate | |

### 3.3 `products`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `sku` | text (40), required | **Unique index** |
| `barcode` | text (64) | Ikut dicari di halaman kasir |
| `name` | text (160), required | |
| `description` | text (500) | |
| `category` | relation → `categories` (1) | `cascadeDelete: false` |
| `price` | number (int, min 0) | Harga jual — **integer**, tanpa sen |
| `cost` | number (int, min 0) | Harga modal (untuk nilai stok) |
| `stock` | number (desimal) | Boleh pecahan (mis. 0,5 kg) |
| `min_stock` | number | Ambang peringatan stok menipis |
| `unit` | text (16) | `pcs`, `botol`, `kg`, ... |
| `taxable` | bool | Menandai produk kena pajak |
| `active` | bool | Produk nonaktif tidak muncul di kasir |
| `image` | file (1, maks 2 MB) | Thumbnail `120x120` |
| `created`, `updated` | autodate | |

### 3.4 `customers`

`name` (120, required), `phone` (32), `email`, `address` (300), `points` (int),
`notes` (300), `active` (bool), `created`, `updated`.

Indeks: `phone`, `name`.

### 3.5 `shifts`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `cashier` | relation → `users` (1, required) | Pemilik shift |
| `opened_at` / `closed_at` | date | |
| `opening_cash` | number (int) | Kas awal |
| `cash_sales` | number (int) | Total penjualan tunai pada shift |
| `non_cash_sales` | number (int) | Total non-tunai |
| `expected_cash` | number (int) | `opening_cash + cash_sales` |
| `closing_cash` | number (int) | Kas fisik hasil hitung |
| `difference` | number (int) | `closing_cash - expected_cash` |
| `status` | select | `open` \| `closed` |
| `note` | text (300) | |

### 3.6 `sales` (header struk)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `receipt_no` | text (40), required | **Unique index**, dibuat hook: `INV-YYYYMMDD-XXXX` |
| `cashier` | relation → `users` (1) | Diisi hook dari token login |
| `customer` | relation → `customers` (1) | Opsional (umum) |
| `shift` | relation → `shifts` (1) | Opsional |
| `item_count` | number (int) | Total qty (bukan jenis barang) |
| `subtotal` | number (int) | Sebelum diskon & pajak |
| `discount` | number (int) | Diskon nota |
| `tax` | number (int) | Nilai pajak |
| `total` | number (int) | Nilai akhir yang dibayar |
| `paid` | number (int) | |
| `change` | number (int) | |
| `payment_method` | select | `cash` \| `qris` \| `transfer` \| `debit` \| `ewallet` |
| `status` | select | `completed` \| `refunded` \| `void` |
| `sold_at` | date | Diisi hook bila kosong |
| `note` | text (300) | |

### 3.7 `sale_items` (baris struk)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `sale` | relation → `sales` (1, required) | **`cascadeDelete: true`** |
| `product` | relation → `products` (1) | Boleh kosong bila produk dihapus |
| `product_name` | text (160), required | **Snapshot** nama saat terjual |
| `sku` | text (40) | Snapshot |
| `price` | number (int) | **Snapshot** harga saat terjual |
| `qty` | number | |
| `discount` | number (int) | Diskon baris |
| `subtotal` | number (int) | `price × qty − discount` |

> Snapshot dipakai agar mengubah harga produk **tidak mengubah riwayat struk**.

### 3.8 `stock_moves` (audit stok)

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `product` | relation → `products` (1, required) | |
| `qty` | number | **Bertanda**: positif masuk, negatif keluar |
| `type` | select | `in` \| `out` \| `sale` \| `return` \| `adjustment` \| `opname` |
| `stock_before` / `stock_after` | number | Stok sebelum & sesudah |
| `reference` | text (60) | ID struk, atau `MANUAL` |
| `note` | text (300) | |
| `user` | relation → `users` (1) | Pelaku perubahan |

### 3.9 `settings` (singleton)

`store_name` (120), `address` (300), `phone` (32), `currency` (8),
`tax_percent` (0–100), `tax_included` (bool), `round_to_100` (bool),
`receipt_footer` (300), `low_stock_threshold` (number), `logo` (file, maks 1 MB).

Record default dibuat oleh migration `1750000005_default_settings.js`.

## 4. Aturan akses (API Rules)

| Koleksi | listRule | viewRule | createRule | updateRule | deleteRule |
| --- | --- | --- | --- | --- | --- |
| `categories` | login | login | owner/admin | owner/admin | owner/admin |
| `products` | login | login | owner/admin | owner/admin | **owner** |
| `customers` | login | login | login | login | owner/admin |
| `shifts` | login | login | login | pemilik shift / owner / admin | owner |
| `sales` | login | login | login | owner/admin | owner |
| `sale_items` | login | login | login | owner/admin | owner |
| `stock_moves` | login | login | login | owner/admin | owner |
| `settings` | **publik** | **publik** | owner/admin | owner/admin | owner |
| `users` | owner/admin | login | **owner** | diri sendiri / owner | owner |

`settings` sengaja publik untuk `list`/`view` agar halaman login bisa menampilkan
nama toko sebelum pengguna masuk; field-nya tidak sensitif.

`users.viewRule = login` diperlukan agar relasi `cashier` dapat di-*expand*
(nama kasir muncul di riwayat transaksi). `users.listRule` tetap terbatas pada
owner/admin, jadi kasir tidak bisa mengunduh daftar akun.

## 5. Index yang dibuat

| Koleksi | Index |
| --- | --- |
| `categories` | UNIQUE `name` |
| `products` | UNIQUE `sku`, `category`, `active` |
| `customers` | `phone`, `name` |
| `shifts` | `status` |
| `sales` | UNIQUE `receipt_no`, `sold_at`, `cashier`, `status` |
| `sale_items` | `sale` |
| `stock_moves` | `product`, `created` |

## 6. Konvensi penamaan & tipe

- Nama koleksi & field: `snake_case` (kompatibel dengan ekspresi filter PocketBase).
- Uang: `number` dengan `noDecimal: true` → integer rupiah.
- Kuantitas stok: `number` tanpa `noDecimal` → boleh pecahan.
- Tanggal: tipe `date`, dikirim `"YYYY-MM-DD HH:MM:SS"` (`pbDateTime()` di `lib/format.js`).
- Snapshot riwayat: nama field meniru field aslinya (`product_name`, `price`, `sku`).
