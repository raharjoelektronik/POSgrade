/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000000_init_categories_products
 * Membuat koleksi `categories` dan `products`.
 *
 * Catatan: PocketBase hanya menambahkan field `id` secara otomatis pada koleksi
 * baru. Field `created`/`updated` (tipe autodate) HARUS dideklarasikan manual,
 * kalau tidak, kolomnya tidak akan ada di tabel SQLite.
 */
migrate(
  (app) => {
    // ---------------------------------------------------------------- categories
    const categories = new Collection({
      type: "base",
      name: "categories",
      // Semua user yang login boleh membaca, hanya owner/admin boleh mengubah.
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        { type: "text", name: "name", required: true, max: 80 },
        { type: "text", name: "description", max: 300 },
        { type: "number", name: "sort_order", noDecimal: true, min: 0 },
        { type: "bool", name: "active" },
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_categories_name` ON `categories` (`name`)"],
    })
    app.save(categories)

    // ------------------------------------------------------------------ products
    const categoriesId = app.findCollectionByNameOrId("categories").id

    const products = new Collection({
      type: "base",
      name: "products",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "owner"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        { type: "text", name: "sku", required: true, max: 40 },
        { type: "text", name: "barcode", max: 64 },
        { type: "text", name: "name", required: true, max: 160 },
        { type: "text", name: "description", max: 500 },
        {
          type: "relation",
          name: "category",
          collectionId: categoriesId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          displayFields: ["name"],
        },
        // Harga & biaya disimpan sebagai bilangan bulat (rupiah tanpa sen).
        { type: "number", name: "price", noDecimal: true, min: 0 },
        { type: "number", name: "cost", noDecimal: true, min: 0 },
        // Stok boleh desimal (mis. 0.5 kg).
        { type: "number", name: "stock", min: 0 },
        { type: "number", name: "min_stock", min: 0 },
        { type: "text", name: "unit", max: 16 },
        { type: "bool", name: "taxable" },
        { type: "bool", name: "active" },
        {
          type: "file",
          name: "image",
          maxSelect: 1,
          maxSize: 2097152, // 2 MB
          mimeTypes: ["image/jpeg", "image/png", "image/webp"],
          thumbs: ["120x120"],
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_products_sku` ON `products` (`sku`)",
        "CREATE INDEX `idx_products_category` ON `products` (`category`)",
        "CREATE INDEX `idx_products_active` ON `products` (`active`)",
      ],
    })
    app.save(products)
  },
  (app) => {
    // Rollback: hapus products lebih dulu (dia yang punya relasi ke categories).
    for (const name of ["products", "categories"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // sudah terhapus, abaikan
      }
    }
  }
)
