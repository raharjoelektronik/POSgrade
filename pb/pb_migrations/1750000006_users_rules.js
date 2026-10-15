/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000006_users_rules
 * Mengamankan koleksi auth `users`.
 *
 * Bawaan PocketBase mengizinkan siapa saja mendaftar (createRule = "").
 * Untuk aplikasi POS, pendaftaran mandiri harus dimatikan: hanya `owner`
 * yang boleh membuat akun baru.
 *
 * Catatan penting: superuser pertama dibuat lewat CLI
 * (`./pocketbase superuser create ...`) lalu diberi `role = "owner"`.
 * Superuser selalu melewati semua rule di atas.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users")

    users.listRule = '@request.auth.role = "owner" || @request.auth.role = "admin"'
    // Semua user login boleh MELIHAT profil user lain agar relasi `cashier`
    // bisa di-expand (mis. nama kasir pada riwayat transaksi).
    users.viewRule = '@request.auth.id != ""'
    users.createRule = '@request.auth.role = "owner"'
    users.updateRule = 'id = @request.auth.id || @request.auth.role = "owner"'
    users.deleteRule = '@request.auth.role = "owner"'

    app.save(users)
  },
  (app) => {
    // Kembalikan ke perilaku bawaan PocketBase.
    const users = app.findCollectionByNameOrId("users")
    users.listRule = "id = @request.auth.id"
    users.viewRule = "id = @request.auth.id"
    users.createRule = ""
    users.updateRule = "id = @request.auth.id"
    users.deleteRule = "id = @request.auth.id"
    app.save(users)
  }
)
