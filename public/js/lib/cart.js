/**
 * cart.js - state keranjang belanja halaman kasir.
 *
 * Disimpan di localStorage supaya keranjang tidak hilang saat halaman
 * di-refresh atau kasir tidak sengaja menutup browser.
 */

const STORAGE_KEY = "posgrade.cart.v1"

export class Cart {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey
    this.items = this._load()
    this.listeners = new Set()
  }

  // --------------------------------------------------------------- persistence
  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items))
    } catch {
      /* storage penuh / private mode: abaikan, keranjang tetap jalan di memori */
    }
  }

  // -------------------------------------------------------------- pub/sub API
  subscribe(listener) {
    this.listeners.add(listener)
    listener(this)
    return () => this.listeners.delete(listener)
  }

  _emit() {
    this._save()
    for (const listener of this.listeners) listener(this)
  }

  // ------------------------------------------------------------------ operasi
  /**
   * Tambah produk ke keranjang (atau tambah qty bila sudah ada).
   * @param {object} product record produk dari PocketBase
   * @param {number} qty
   */
  add(product, qty = 1) {
    const existing = this.items.find((item) => item.productId === product.id)

    if (existing) {
      existing.qty += qty
    } else {
      this.items.push({
        productId: product.id,
        name: product.name,
        sku: product.sku ?? "",
        unit: product.unit ?? "pcs",
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0,
        taxable: Boolean(product.taxable),
        discount: 0,
        qty,
      })
    }
    this._emit()
  }

  setQty(productId, qty) {
    const item = this.items.find((entry) => entry.productId === productId)
    if (!item) return

    const next = Math.floor(Number(qty) || 0)
    if (next <= 0) {
      this.remove(productId)
      return
    }
    item.qty = next
    this._emit()
  }

  setDiscount(productId, discount) {
    const item = this.items.find((entry) => entry.productId === productId)
    if (!item) return
    item.discount = Math.max(0, Number(discount) || 0)
    this._emit()
  }

  increment(productId, delta = 1) {
    const item = this.items.find((entry) => entry.productId === productId)
    if (!item) return
    this.setQty(productId, item.qty + delta)
  }

  remove(productId) {
    this.items = this.items.filter((item) => item.productId !== productId)
    this._emit()
  }

  clear() {
    this.items = []
    this._emit()
  }

  find(productId) {
    return this.items.find((item) => item.productId === productId) ?? null
  }

  // ------------------------------------------------------------------ hitungan
  get isEmpty() {
    return this.items.length === 0
  }

  /** Total jumlah barang (bukan jenis). */
  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.qty, 0)
  }

  /** Subtotal baris: (harga x qty) - diskon baris. */
  lineTotal(item) {
    return Math.max(0, item.price * item.qty - (item.discount || 0))
  }

  get subtotal() {
    return this.items.reduce((sum, item) => sum + this.lineTotal(item), 0)
  }

  get itemDiscountTotal() {
    return this.items.reduce((sum, item) => sum + (item.discount || 0), 0)
  }

  /**
   * Hitung ringkasan transaksi.
   * @param {{ taxPercent?:number, taxIncluded?:boolean, billDiscount?:number,
   *           roundTo100?:boolean }} [options]
   */
  totals(options = {}) {
    const {
      taxPercent = 0,
      taxIncluded = true,
      billDiscount = 0,
      roundTo100 = false,
    } = options

    const gross = this.subtotal
    const discount = Math.max(0, Number(billDiscount) || 0)
    const net = Math.max(0, gross - discount)

    let tax = 0
    let total = net

    if (taxPercent > 0) {
      if (taxIncluded) {
        // Harga sudah termasuk pajak -> pajak hanya untuk informasi.
        tax = Math.round((net * taxPercent) / (100 + taxPercent))
      } else {
        tax = Math.round((net * taxPercent) / 100)
        total = net + tax
      }
    }

    let rounded = total
    if (roundTo100) {
      rounded = Math.round(total / 100) * 100
    }

    return {
      subtotal: gross,
      discount,
      net,
      tax,
      total: rounded,
      rounding: rounded - total,
      taxIncluded,
    }
  }

  /** Payload untuk dikirim ke PocketBase (koleksi `sale_items`). */
  toPayload(saleId) {
    return this.items.map((item) => ({
      sale: saleId,
      product: item.productId,
      product_name: item.name,
      sku: item.sku,
      price: item.price,
      qty: item.qty,
      discount: item.discount || 0,
      subtotal: this.lineTotal(item),
    }))
  }

  /** Baris ringkas untuk ditampilkan di struk. */
  toReceiptLines() {
    return this.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      discount: item.discount || 0,
      total: this.lineTotal(item),
    }))
  }
}

export default Cart
