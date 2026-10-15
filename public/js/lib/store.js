/**
 * store.js - state aplikasi bersama (pengaturan toko, kategori, shift aktif).
 *
 * Store sangat sederhana: satu objek state + daftar subscriber.
 * Cukup untuk aplikasi sebesar POSgrade tanpa menarik library state management.
 */

export class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState }
    this.listeners = new Set()
  }

  get() {
    return this.state
  }

  /** Ambil satu key. */
  pick(key) {
    return this.state[key]
  }

  /** Gabungkan perubahan (shallow merge) lalu beri tahu subscriber. */
  set(patch) {
    const previous = this.state
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state, previous)
    return this.state
  }

  subscribe(listener, { immediate = false } = {}) {
    this.listeners.add(listener)
    if (immediate) listener(this.state)
    return () => this.listeners.delete(listener)
  }
}

/** State global aplikasi. */
export const appStore = new Store({
  /** Record pengaturan toko (koleksi `settings`). */
  settings: null,
  /** Daftar kategori (untuk filter & form produk). */
  categories: [],
  /** Shift kasir yang sedang terbuka milik user login. */
  shift: null,
  /** Ringkasan stok menipis, dipakai untuk badge di sidebar. */
  lowStockCount: 0,
})

/** Nilai default bila record `settings` belum ada. */
export const DEFAULT_SETTINGS = {
  store_name: "POSgrade Store",
  address: "",
  phone: "",
  currency: "IDR",
  tax_percent: 0,
  tax_included: true,
  round_to_100: true,
  receipt_footer: "Terima kasih telah berbelanja!",
  low_stock_threshold: 5,
}

/** Pengaturan efektif (record settings + default). */
export function effectiveSettings() {
  return { ...DEFAULT_SETTINGS, ...(appStore.pick("settings") ?? {}) }
}

export default appStore
