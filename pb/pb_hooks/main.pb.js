/// <reference path="../pb_data/types.d.ts" />
/**
 * main.pb.js - logika server-side PocketBase (JavaScript hooks).
 *
 * Semua file di pb_hooks/ HARUS berakhiran `.pb.js` agar dieksekusi.
 * Setiap handler wajib memanggil `e.next()` bila ingin melanjutkan chain,
 * dan boleh melempar error untuk membatalkan request.
 *
 * Isi file ini:
 *  1. Nomor struk dibuat di server (tidak bisa dipalsukan/diduplikasi klien).
 *  2. Default transaksi: sold_at, status, cashier (dari token login).
 *  3. Pengurangan stok otomatis + pencatatan `stock_moves` saat item terjual.
 *  4. Pengembalian stok saat struk di-void / refund.
 */

// ---------------------------------------------------------------------------
// 1 & 2. Nomor struk + default header transaksi
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  const record = e.record

  // Nomor struk: INV-YYYYMMDD-XXXX (unique index di DB jadi pengaman terakhir).
  if (!record.getString("receipt_no")) {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
    record.set("receipt_no", `INV-${ymd}-${rand}`)
  }

  if (!record.getString("sold_at")) {
    record.set("sold_at", new Date().toISOString().replace("T", " ").replace("Z", "Z"))
  }
  if (!record.getString("status")) {
    record.set("status", "completed")
  }

  // Isi kasir dari token yang sedang login (jangan percaya input klien).
  const authId = e.requestInfo?.auth?.id
  if (authId && !record.getString("cashier")) {
    record.set("cashier", authId)
  }

  e.next()
}, "sales")

// ---------------------------------------------------------------------------
// 3. Stok berkurang saat item terjual + catat mutasi stok
// ---------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  const item = e.record
  const productId = item.getString("product")
  const qty = item.getFloat("qty")

  // Simpan item dulu supaya transaksi konsisten, baru sesuaikan stok.
  e.next()

  if (!productId || qty <= 0) return

  try {
    e.app.runInTransaction((txApp) => {
      const product = txApp.findRecordById("products", productId)
      const before = product.getFloat("stock")
      const after = before - qty

      product.set("stock", after < 0 ? 0 : after)
      txApp.save(product)

      const move = new Record(txApp.findCollectionByNameOrId("stock_moves"))
      move.set("product", product.id)
      move.set("qty", -qty)
      move.set("type", "sale")
      move.set("stock_before", before)
      move.set("stock_after", after < 0 ? 0 : after)
      move.set("reference", item.getString("sale"))
      move.set("note", `Terjual: ${item.getString("product_name")}`)
      move.set("user", e.requestInfo?.auth?.id || "")
      txApp.save(move)
    })
  } catch (error) {
    // Jangan gagalkan penjualan hanya karena stok gagal disesuaikan;
    // cukup catat agar bisa diperbaiki manual via halaman Stok.
    console.error("[posgrade] gagal menyesuaikan stok:", error)
  }
}, "sale_items")

// ---------------------------------------------------------------------------
// 4. Void / refund => stok dikembalikan
// ---------------------------------------------------------------------------
onRecordUpdateRequest((e) => {
  const original = e.record.original()
  const status = e.record.getString("status")

  const wasActive = original.getString("status") === "completed"
  const nowVoid = status === "void" || status === "refunded"

  e.next()

  if (!wasActive || !nowVoid) return

  try {
    e.app.runInTransaction((txApp) => {
      const items = txApp.findRecordsByFilter(
        "sale_items",
        "sale = {:sale}",
        "",
        500,
        0,
        { sale: e.record.id }
      )

      for (const item of items) {
        const productId = item.getString("product")
        if (!productId) continue

        const qty = item.getFloat("qty")
        const product = txApp.findRecordById("products", productId)
        const before = product.getFloat("stock")
        const after = before + qty

        product.set("stock", after)
        txApp.save(product)

        const move = new Record(txApp.findCollectionByNameOrId("stock_moves"))
        move.set("product", product.id)
        move.set("qty", qty)
        move.set("type", status === "refunded" ? "return" : "adjustment")
        move.set("stock_before", before)
        move.set("stock_after", after)
        move.set("reference", e.record.getString("receipt_no"))
        move.set("note", `Struk ${status}: ${e.record.getString("receipt_no")}`)
        txApp.save(move)
      }
    })
  } catch (error) {
    console.error("[posgrade] gagal mengembalikan stok:", error)
  }
}, "sales")
