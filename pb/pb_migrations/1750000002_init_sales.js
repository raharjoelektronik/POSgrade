/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000002_init_sales
 * Membuat koleksi transaksi: `sales` (header) + `sale_items` (baris item).
 *
 * Strategi: setiap penjualan menyimpan SNAPSHOT (nama, harga, diskon) supaya
 * riwayat struk tidak berubah saat harga produk diperbarui di kemudian hari.
 */
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id
    const customersId = app.findCollectionByNameOrId("customers").id
    const shiftsId = app.findCollectionByNameOrId("shifts").id
    const productsId = app.findCollectionByNameOrId("products").id

    // --------------------------------------------------------------------- sales
    const sales = new Collection({
      type: "base",
      name: "sales",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      // Kasir boleh membuat transaksi baru...
      createRule: '@request.auth.id != ""',
      // ...tapi hanya owner/admin yang boleh mengubah (void/refund).
      updateRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "owner"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        { type: "text", name: "receipt_no", required: true, max: 40 },
        {
          type: "relation",
          name: "cashier",
          collectionId: usersId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          displayFields: ["full_name", "email"],
        },
        {
          type: "relation",
          name: "customer",
          collectionId: customersId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          displayFields: ["name"],
        },
        {
          type: "relation",
          name: "shift",
          collectionId: shiftsId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        },
        { type: "number", name: "item_count", noDecimal: true, min: 0 },
        { type: "number", name: "subtotal", noDecimal: true, min: 0 },
        { type: "number", name: "discount", noDecimal: true, min: 0 },
        { type: "number", name: "tax", noDecimal: true, min: 0 },
        { type: "number", name: "total", noDecimal: true, min: 0 },
        { type: "number", name: "paid", noDecimal: true, min: 0 },
        { type: "number", name: "change", noDecimal: true },
        {
          type: "select",
          name: "payment_method",
          values: ["cash", "qris", "transfer", "debit", "ewallet"],
          maxSelect: 1,
          required: true,
        },
        {
          type: "select",
          name: "status",
          values: ["completed", "refunded", "void"],
          maxSelect: 1,
          required: true,
        },
        { type: "date", name: "sold_at" },
        { type: "text", name: "note", max: 300 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_sales_receipt_no` ON `sales` (`receipt_no`)",
        "CREATE INDEX `idx_sales_sold_at` ON `sales` (`sold_at`)",
        "CREATE INDEX `idx_sales_cashier` ON `sales` (`cashier`)",
        "CREATE INDEX `idx_sales_status` ON `sales` (`status`)",
      ],
    })
    app.save(sales)

    const salesId = sales.id

    // ---------------------------------------------------------------- sale_items
    const saleItems = new Collection({
      type: "base",
      name: "sale_items",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "owner"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        {
          type: "relation",
          name: "sale",
          required: true,
          collectionId: salesId,
          cascadeDelete: true, // hapus struk => item ikut terhapus
          minSelect: 1,
          maxSelect: 1,
        },
        {
          type: "relation",
          name: "product",
          collectionId: productsId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          displayFields: ["name", "sku"],
        },
        // snapshot data produk pada saat transaksi
        { type: "text", name: "product_name", required: true, max: 160 },
        { type: "text", name: "sku", max: 40 },
        { type: "number", name: "price", noDecimal: true, min: 0 },
        { type: "number", name: "qty", min: 0 },
        { type: "number", name: "discount", noDecimal: true, min: 0 },
        { type: "number", name: "subtotal", noDecimal: true, min: 0 },
      ],
      indexes: ["CREATE INDEX `idx_sale_items_sale` ON `sale_items` (`sale`)"],
    })
    app.save(saleItems)
  },
  (app) => {
    for (const name of ["sale_items", "sales"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // sudah terhapus, abaikan
      }
    }
  }
)
