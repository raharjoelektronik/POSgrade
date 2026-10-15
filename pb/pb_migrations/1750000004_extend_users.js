/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000004_extend_users
 * Menambah field profil + `role` pada koleksi auth bawaan `users`.
 *
 * Peran (role):
 *   owner   - akses penuh, termasuk hapus data & ubah pengaturan
 *   admin   - kelola master data (produk, kategori, customer), lihat laporan
 *   cashier - hanya bisa transaksi di halaman kasir
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")

    users.fields.add(new Field({ type: "text", name: "full_name", max: 120 }))
    users.fields.add(new Field({ type: "text", name: "phone", max: 32 }))
    users.fields.add(
      new Field({
        type: "select",
        name: "role",
        values: ["owner", "admin", "cashier"],
        maxSelect: 1,
      })
    )
    users.fields.add(new Field({ type: "bool", name: "active" }))

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users")
    for (const name of ["full_name", "phone", "role", "active"]) {
      try {
        users.fields.removeByName(name)
      } catch {
        // field tidak ada, abaikan
      }
    }
    app.save(users)
  }
)
