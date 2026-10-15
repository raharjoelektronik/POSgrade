/// <reference path="../pb_data/types.d.ts" />
/**
 * 1750000005_default_settings
 * Membuat 1 record pengaturan default (koleksi `settings` bersifat singleton).
 * Data demo (produk, user kasir, dsb.) TIDAK ditaruh di sini agar schema tetap
 * bersih; gunakan `npm run pb:seed` untuk mengisi data contoh.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("settings")

    const record = new Record(collection)
    record.set("store_name", "POSgrade Store")
    record.set("address", "Jl. Contoh No. 1, Jakarta")
    record.set("phone", "021-0000000")
    record.set("currency", "IDR")
    record.set("tax_percent", 11)
    record.set("tax_included", true)
    record.set("round_to_100", true)
    record.set("receipt_footer", "Terima kasih telah berbelanja!")
    record.set("low_stock_threshold", 5)
    app.save(record)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("settings")
      const records = app.findAllRecords(collection)
      for (const record of records) {
        app.delete(record)
      }
    } catch {
      // koleksi sudah terhapus, abaikan
    }
  }
)
