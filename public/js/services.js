/**
 * services.js - operasi domain POS yang dipakai banyak halaman.
 *
 * Semua logika bisnis yang lebih dari sekadar CRUD mentah diletakkan di sini,
 * supaya view tetap tipis dan mudah dibaca.
 */
import { db, pb } from "./api.js"
import { appStore, effectiveSettings } from "./lib/store.js"
import { buildFilter, quote } from "./lib/pb.js"
import { todayRange, pbDateTime } from "./lib/format.js"

// ---------------------------------------------------------------- pengaturan
/** Muat pengaturan toko (koleksi singleton `settings`) ke appStore. */
export async function loadSettings({ force = false } = {}) {
  if (!force && appStore.pick("settings")) return appStore.pick("settings")

  const record = await db.settings
    .getFirst("", { sort: "-created", silent: true })
    .catch(() => null)
  appStore.set({ settings: record })
  return record
}

/** Simpan pengaturan toko. */
export async function saveSettings(patch) {
  const current = await loadSettings()
  const record = current
    ? await db.settings.update(current.id, patch)
    : await db.settings.create(patch)
  appStore.set({ settings: record })
  return record
}

// ------------------------------------------------------------------ kategori
export async function loadCategories({ force = false } = {}) {
  if (!force && appStore.pick("categories")?.length) return appStore.pick("categories")
  const items = await db.categories.getFullList({ sort: "sort_order,name" })
  appStore.set({ categories: items })
  return items
}

// -------------------------------------------------------------------- produk
/**
 * Cari produk untuk halaman kasir (server-side search + filter kategori).
 * @param {{ search?:string, categoryId?:string, limit?:number }} [options]
 */
export function searchProducts(options = {}) {
  const { search = "", categoryId = "", limit = 120 } = options

  const filter = buildFilter(
    "active = true",
    categoryId ? `category = ${quote(categoryId)}` : "",
    search
      ? `(name ~ ${quote(search)} || sku ~ ${quote(search)} || barcode ~ ${quote(search)})`
      : ""
  )

  return db.products.getFullList({ filter, sort: "name", maxItems: limit, expand: "category" })
}

/** Produk dengan stok di bawah/atau sama dengan ambang minimum. */
export async function loadLowStockProducts() {
  const { low_stock_threshold: threshold = 5 } = effectiveSettings()
  const items = await db.products.getFullList({
    filter: `active = true && stock <= ${Number(threshold) || 0}`,
    sort: "stock",
    maxItems: 500,
  })
  appStore.set({ lowStockCount: items.length })
  return items
}

// -------------------------------------------------------------- shift kasir
/** Shift terbuka milik user yang sedang login (atau null). */
export async function loadOpenShift(userId) {
  if (!userId) return null
  const shift = await db.shifts
    .getFirst(`cashier = ${quote(userId)} && status = "open"`, {
      sort: "-opened_at",
      silent: true,
    })
    .catch(() => null)
  appStore.set({ shift })
  return shift
}

/** Buka shift baru. */
export async function openShift(userId, openingCash, note = "") {
  const shift = await db.shifts.create({
    cashier: userId,
    opened_at: pbDateTime(),
    opening_cash: Math.round(Number(openingCash) || 0),
    cash_sales: 0,
    non_cash_sales: 0,
    status: "open",
    note,
  })
  appStore.set({ shift })
  return shift
}

/**
 * Tutup shift: hitung penjualan tunai/non-tunai lalu simpan selisih kas.
 * @param {object} shift
 * @param {number} closingCash
 * @param {string} [note]
 */
export async function closeShift(shift, closingCash, note = "") {
  const { cash, nonCash } = await shiftSalesTotals(shift.id)
  const expected = (Number(shift.opening_cash) || 0) + cash
  const actual = Math.round(Number(closingCash) || 0)

  const record = await db.shifts.update(shift.id, {
    closed_at: pbDateTime(),
    cash_sales: cash,
    non_cash_sales: nonCash,
    expected_cash: expected,
    closing_cash: actual,
    difference: actual - expected,
    status: "closed",
    note,
  })
  appStore.set({ shift: null })
  return record
}

/** Total penjualan pada satu shift, dipisah tunai vs non-tunai. */
export async function shiftSalesTotals(shiftId) {
  const sales = await db.sales.getFullList({
    filter: `shift = ${quote(shiftId)} && status = "completed"`,
    fields: "id,total,payment_method",
    maxItems: 5000,
  })

  let cash = 0
  let nonCash = 0
  for (const sale of sales) {
    if (sale.payment_method === "cash") cash += Number(sale.total) || 0
    else nonCash += Number(sale.total) || 0
  }
  return { cash, nonCash, count: sales.length }
}

// ----------------------------------------------------------------- penjualan
/**
 * Simpan transaksi lengkap (header + item) secara berurutan.
 * Catatan: PocketBase tidak punya endpoint batch, jadi bila pembuatan salah
 * satu item gagal, header dihapus kembali (rollback manual).
 *
 * @param {object} payload data header `sales`
 * @param {Array} items   payload `sale_items` (dari Cart.toPayload)
 */
export async function createSale(payload, items) {
  const sale = await db.sales.create(payload, { expand: "cashier,customer" })

  try {
    const created = []
    for (const item of items) {
      created.push(await db.saleItems.create({ ...item, sale: sale.id }))
    }
    return { sale, items: created }
  } catch (error) {
    // Rollback manual: hapus header (item ikut terhapus karena cascadeDelete).
    await db.sales.remove(sale.id, { silent: true }).catch(() => {})
    throw error
  }
}

/** Ambil 1 struk lengkap beserta item & relasinya. */
export async function loadSaleDetail(saleId) {
  const sale = await db.sales.getOne(saleId, { expand: "cashier,customer,shift" })
  const items = await db.saleItems.getFullList({
    filter: `sale = ${quote(saleId)}`,
    sort: "created",
    maxItems: 500,
  })
  return { sale, items }
}

/** Batalkan (void) sebuah struk. */
export function voidSale(saleId, reason = "") {
  return db.sales.update(saleId, {
    status: "void",
    note: reason || "Dibatalkan oleh pengguna",
  })
}

/** Ringkasan penjualan harian untuk dashboard. */
export async function dailySummary(date = new Date()) {
  const { start, end } = todayRange(date)
  const filter = `status = "completed" && sold_at >= ${quote(start)} && sold_at <= ${quote(end)}`

  const sales = await db.sales.getFullList({
    filter,
    sort: "-sold_at",
    maxItems: 2000,
    fields: "id,receipt_no,total,item_count,payment_method,sold_at,cashier",
  })

  const revenue = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)
  const items = sales.reduce((sum, sale) => sum + (Number(sale.item_count) || 0), 0)
  const average = sales.length ? Math.round(revenue / sales.length) : 0

  const byMethod = {}
  for (const sale of sales) {
    const key = sale.payment_method ?? "lainnya"
    byMethod[key] = (byMethod[key] ?? 0) + (Number(sale.total) || 0)
  }

  return { sales, revenue, items, average, count: sales.length, byMethod, range: { start, end } }
}

/** Produk terlaris dalam rentang tanggal tertentu. */
export async function topProducts({ from, to, limit = 8 } = {}) {
  const sales = await db.sales.getFullList({
    filter: buildFilter(
      'status = "completed"',
      from ? `sold_at >= ${quote(from)}` : "",
      to ? `sold_at <= ${quote(to)}` : ""
    ),
    fields: "id",
    maxItems: 5000,
  })

  if (!sales.length) return []

  const ids = sales.map((sale) => sale.id)
  const items = await db.saleItems.getFullList({
    filter: ids.map((id) => `sale = ${quote(id)}`).join(" || "),
    fields: "product_name,qty,subtotal",
    maxItems: 20000,
  })

  const grouped = new Map()
  for (const item of items) {
    const key = item.product_name ?? "-"
    const entry = grouped.get(key) ?? { name: key, qty: 0, revenue: 0 }
    entry.qty += Number(item.qty) || 0
    entry.revenue += Number(item.subtotal) || 0
    grouped.set(key, entry)
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
}

// --------------------------------------------------------------------- stok
/**
 * Sesuaikan stok produk secara manual + catat mutasi.
 * @param {object} product
 * @param {number} newStock nilai stok baru
 * @param {{ type?:string, note?:string, userId?:string }} [options]
 */
export async function adjustStock(product, newStock, options = {}) {
  const { type = "adjustment", note = "", userId = "" } = options
  const before = Number(product.stock) || 0
  const after = Number(newStock) || 0
  const delta = after - before

  if (delta === 0) return { product, move: null, delta }

  const updated = await db.products.update(product.id, { stock: after })

  const payload = {
    product: product.id,
    qty: delta,
    type,
    stock_before: before,
    stock_after: after,
    reference: "MANUAL",
    note: note || "Penyesuaian stok manual",
  }
  if (userId) payload.user = userId

  const move = await db.stockMoves.create(payload)
  return { product: updated, move, delta }
}

/** Mutasi stok terbaru (untuk halaman Stok). */
export function loadStockMoves({ productId = "", limit = 200 } = {}) {
  return db.stockMoves.getFullList({
    filter: productId ? `product = ${quote(productId)}` : "",
    sort: "-created",
    expand: "product,user",
    maxItems: limit,
  })
}

// ----------------------------------------------------------------- pelanggan
export function searchCustomers(term, limit = 30) {
  return db.customers.getFullList({
    filter: term ? `(name ~ ${quote(term)} || phone ~ ${quote(term)})` : "",
    sort: "name",
    maxItems: limit,
  })
}

/** Tambah poin loyalitas (dipanggil setelah transaksi selesai). */
export async function addLoyaltyPoints(customerId, points) {
  if (!customerId || !points) return null
  const customer = await db.customers.getOne(customerId, { silent: true })
  return db.customers.update(customerId, {
    points: (Number(customer.points) || 0) + Math.round(points),
  })
}

export { effectiveSettings, pb }
export default {
  loadSettings,
  saveSettings,
  loadCategories,
  searchProducts,
  createSale,
  loadSaleDetail,
  voidSale,
  dailySummary,
  topProducts,
  adjustStock,
  openShift,
  closeShift,
}
