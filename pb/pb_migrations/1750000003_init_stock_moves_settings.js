/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000003_init_stock_moves_settings
 * `stock_moves`  : audit trail mutasi stok (masuk / keluar / penyesuaian).
 * `settings`     : pengaturan toko (sengaja singleton, hanya 1 record).
 */
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id
    const productsId = app.findCollectionByNameOrId("products").id

    // --------------------------------------------------------------- stock_moves
    const stockMoves = new Collection({
      type: "base",
      name: "stock_moves",
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
          name: "product",
          required: true,
          collectionId: productsId,
          cascadeDelete: false,
          minSelect: 1,
          maxSelect: 1,
          displayFields: ["name", "sku"],
        },
        // qty bertanda: positif = stok masuk, negatif = stok keluar
        { type: "number", name: "qty" },
        {
          type: "select",
          name: "type",
          values: ["in", "out", "sale", "return", "adjustment", "opname"],
          maxSelect: 1,
          required: true,
        },
        { type: "number", name: "stock_before" },
        { type: "number", name: "stock_after" },
        { type: "text", name: "reference", max: 60 },
        { type: "text", name: "note", max: 300 },
        {
          type: "relation",
          name: "user",
          collectionId: usersId,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          displayFields: ["full_name", "email"],
        },
      ],
      indexes: [
        "CREATE INDEX `idx_stock_moves_product` ON `stock_moves` (`product`)",
        "CREATE INDEX `idx_stock_moves_created` ON `stock_moves` (`created`)",
      ],
    })
    app.save(stockMoves)

    // ------------------------------------------------------------------ settings
    const settings = new Collection({
      type: "base",
      name: "settings",
      // Publik boleh membaca supaya halaman login bisa menampilkan nama toko.
      listRule: "",
      viewRule: "",
      createRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      updateRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "owner"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        { type: "text", name: "store_name", max: 120 },
        { type: "text", name: "address", max: 300 },
        { type: "text", name: "phone", max: 32 },
        { type: "text", name: "currency", max: 8 },
        { type: "number", name: "tax_percent", min: 0, max: 100 },
        { type: "bool", name: "tax_included" },
        { type: "bool", name: "round_to_100" },
        { type: "text", name: "receipt_footer", max: 300 },
        { type: "number", name: "low_stock_threshold", min: 0 },
        {
          type: "file",
          name: "logo",
          maxSelect: 1,
          maxSize: 1048576, // 1 MB
          mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
        },
      ],
      indexes: [],
    })
    app.save(settings)
  },
  (app) => {
    for (const name of ["settings", "stock_moves"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // sudah terhapus, abaikan
      }
    }
  }
)
