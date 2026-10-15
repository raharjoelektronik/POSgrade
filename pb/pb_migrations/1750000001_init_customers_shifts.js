/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000001_init_customers_shifts
 * Membuat koleksi `customers` (member/loyalty) dan `shifts` (buka/tutup kasir).
 */
migrate(
  (app) => {
    // ----------------------------------------------------------------- customers
    const customers = new Collection({
      type: "base",
      name: "customers",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.role = "owner" || @request.auth.role = "admin"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        { type: "text", name: "name", required: true, max: 120 },
        { type: "text", name: "phone", max: 32 },
        { type: "email", name: "email" },
        { type: "text", name: "address", max: 300 },
        { type: "number", name: "points", noDecimal: true, min: 0 },
        { type: "text", name: "notes", max: 300 },
        { type: "bool", name: "active" },
      ],
      indexes: [
        "CREATE INDEX `idx_customers_phone` ON `customers` (`phone`)",
        "CREATE INDEX `idx_customers_name` ON `customers` (`name`)",
      ],
    })
    app.save(customers)

    // -------------------------------------------------------------------- shifts
    const usersId = app.findCollectionByNameOrId("users").id

    const shifts = new Collection({
      type: "base",
      name: "shifts",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      // Kasir hanya bisa menutup shift miliknya sendiri; owner/admin bisa apa saja.
      updateRule:
        'cashier = @request.auth.id || @request.auth.role = "owner" || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "owner"',
      fields: [
        // Field autodate wajib dideklarasikan eksplisit pada koleksi baru:
        // PocketBase tidak menambahkannya otomatis (hanya `id`).
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
        {
          type: "relation",
          name: "cashier",
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          minSelect: 1,
          maxSelect: 1,
          displayFields: ["full_name", "email"],
        },
        { type: "date", name: "opened_at" },
        { type: "date", name: "closed_at" },
        { type: "number", name: "opening_cash", noDecimal: true, min: 0 },
        { type: "number", name: "cash_sales", noDecimal: true, min: 0 },
        { type: "number", name: "non_cash_sales", noDecimal: true, min: 0 },
        { type: "number", name: "expected_cash", noDecimal: true, min: 0 },
        { type: "number", name: "closing_cash", noDecimal: true, min: 0 },
        { type: "number", name: "difference", noDecimal: true },
        {
          type: "select",
          name: "status",
          values: ["open", "closed"],
          maxSelect: 1,
          required: true,
        },
        { type: "text", name: "note", max: 300 },
      ],
      indexes: ["CREATE INDEX `idx_shifts_status` ON `shifts` (`status`)"],
    })
    app.save(shifts)
  },
  (app) => {
    for (const name of ["shifts", "customers"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // sudah terhapus, abaikan
      }
    }
  }
)
