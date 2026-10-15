/**
 * pb.js - klien PocketBase minimal untuk browser.
 *
 * Dibuat manual di atas `fetch()` supaya proyek tetap 100% native:
 * tidak ada SDK npm, tidak ada build step, tidak ada bundler.
 *
 * Pemetaan URL: `${baseUrl}/api/collections/{nama}/records`
 * dengan baseUrl default "/pb" (di-proxy oleh server Node ke PocketBase).
 */
import { notify } from "./toast.js"

const STORAGE_KEY = "posgrade.auth.v1"
const PAGE_SIZE = 500

/** Error kaya informasi dari PocketBase. */
export class ApiError extends Error {
  constructor(status, message, data) {
    super(message || `HTTP ${status}`)
    this.name = "ApiError"
    this.status = status
    this.data = data ?? {}
  }

  /** Pesan validasi per-field dalam bahasa yang mudah dibaca. */
  get fieldErrors() {
    const out = {}
    for (const [field, detail] of Object.entries(this.data ?? {})) {
      out[field] = detail?.message ?? String(detail)
    }
    return out
  }
}

/** Aturan hak akses per peran - dipakai untuk menyembunyikan menu/aksi. */
const PERMISSIONS = {
  owner: ["manage:all"],
  admin: [
    "product:write",
    "category:write",
    "customer:write",
    "stock:write",
    "sale:void",
    "settings:write",
    "report:read",
  ],
  cashier: ["sale:create", "customer:write", "shift:manage"],
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: "", record: null }
    const parsed = JSON.parse(raw)
    return { token: parsed.token ?? "", record: parsed.record ?? null }
  } catch {
    return { token: "", record: null }
  }
}

export class PocketBase {
  /** @param {string} baseUrl contoh: "/pb" */
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl ?? "").replace(/\/+$/, "")
    const stored = loadAuth()
    this._token = stored.token
    this._record = stored.record
    this._listeners = new Set()
  }

  // ------------------------------------------------------------- state auth
  get token() {
    return this._token
  }

  get user() {
    return this._record
  }

  get isAuthenticated() {
    return Boolean(this._token)
  }

  get role() {
    return this._record?.role ?? ""
  }

  get displayName() {
    return this._record?.full_name || this._record?.email || "Pengguna"
  }

  /** Cek izin: pb.can("product:write") */
  can(permission) {
    if (!this.isAuthenticated) return false
    if (permission === null || permission === undefined) return true
    const granted = PERMISSIONS[this.role] ?? []
    return granted.includes("manage:all") || granted.includes(permission)
  }

  /** Berlangganan perubahan status login. */
  onAuthChange(listener) {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  _emit() {
    for (const listener of this._listeners) listener(this._record)
  }

  _persist() {
    if (!this._token) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: this._token, record: this._record }))
  }

  setAuth(token, record) {
    this._token = token ?? ""
    this._record = record ?? null
    this._persist()
    this._emit()
  }

  clearAuth() {
    this._token = ""
    this._record = null
    this._persist()
    this._emit()
  }

  // -------------------------------------------------------------- transport
  /**
   * Request generik ke PocketBase.
   * @param {string} path contoh: "/api/collections/products/records"
   * @param {{ method?:string, body?:any, query?:Record<string,any>,
   *           signal?:AbortSignal, silent?:boolean }} [options]
   */
  async request(path, options = {}) {
    const { method = "GET", body, query, signal, silent = false } = options

    const url = new URL(this.baseUrl + path, window.location.origin)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") continue
      url.searchParams.set(key, String(value))
    }

    const headers = { Accept: "application/json" }
    if (this._token) headers.Authorization = this._token

    const init = { method, headers, signal }

    if (body instanceof FormData) {
      init.body = body // browser mengatur Content-Type multipart sendiri
    } else if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json"
      init.body = JSON.stringify(body)
    }

    let response
    try {
      response = await fetch(url, init)
    } catch (error) {
      if (error.name === "AbortError") throw error
      const networkError = new ApiError(0, "Tidak dapat menghubungi server PocketBase.")
      if (!silent) notify.error(networkError.message)
      throw networkError
    }

    const text = await response.text()
    let payload = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { message: text }
      }
    }

    if (!response.ok) {
      const error = new ApiError(
        response.status,
        payload?.message || `Permintaan gagal (HTTP ${response.status})`,
        payload?.data
      )
      // Token kedaluwarsa / dicabut -> bersihkan sesi.
      if (response.status === 401) this.clearAuth()
      if (!silent) notify.error(error.message)
      throw error
    }

    return payload
  }

  /** Akses koleksi: pb.collection("products").getFullList() */
  collection(name) {
    return new CollectionService(this, name)
  }

  // ------------------------------------------------------------------ auth
  /** Login dengan email/username + password. */
  async authWithPassword(identity, password, collection = "users") {
    const data = await this.request(`/api/collections/${collection}/auth-with-password`, {
      method: "POST",
      body: { identity, password },
      silent: true,
    })
    this.setAuth(data.token, data.record)
    return data
  }

  /** Perbarui token + data user; dipakai untuk memvalidasi sesi tersimpan. */
  async authRefresh(collection = "users") {
    const data = await this.request(`/api/collections/${collection}/auth-refresh`, {
      method: "POST",
      silent: true,
    })
    this.setAuth(data.token, data.record)
    return data
  }

  logout() {
    this.clearAuth()
  }

  /** URL file/lampiran PocketBase. */
  fileUrl(record, filename, thumb = "") {
    if (!record || !filename) return ""
    const suffix = thumb ? `?thumb=${encodeURIComponent(thumb)}` : ""
    return `${this.baseUrl}/api/files/${record.collectionId}/${record.id}/${filename}${suffix}`
  }
}

/**
 * Wrapper operasi CRUD untuk satu koleksi.
 * Semua method mengembalikan payload JSON mentah dari PocketBase.
 */
export class CollectionService {
  constructor(pb, name) {
    this.pb = pb
    this.name = name
    this.path = `/api/collections/${encodeURIComponent(name)}/records`
  }

  /**
   * Daftar terpaginasi.
   * @param {number} page
   * @param {number} perPage
   * @param {{sort?:string, filter?:string, expand?:string, fields?:string,
   *          signal?:AbortSignal, silent?:boolean}} [options]
   */
  getList(page = 1, perPage = 30, options = {}) {
    const { sort, filter, expand, fields, signal, silent } = options
    return this.pb.request(this.path, {
      query: { page, perPage, sort, filter, expand, fields },
      signal,
      silent,
    })
  }

  /**
   * Ambil SEMUA record (loop otomatis per 500 baris).
   * @param {{maxItems?:number}} & opsi getList [options]
   */
  async getFullList(options = {}) {
    const { maxItems = 5000, ...rest } = options
    const all = []
    let page = 1

    while (all.length < maxItems) {
      const result = await this.getList(page, PAGE_SIZE, rest)
      all.push(...result.items)
      if (result.items.length < PAGE_SIZE) break
      page += 1
    }
    return all.slice(0, maxItems)
  }

  getOne(id, options = {}) {
    return this.pb.request(`${this.path}/${encodeURIComponent(id)}`, {
      query: { expand: options.expand, fields: options.fields },
      signal: options.signal,
      silent: options.silent,
    })
  }

  /** Record pertama yang cocok dengan filter (atau null bila tidak ada). */
  async getFirst(filter, options = {}) {
    const result = await this.getList(1, 1, { ...options, filter })
    return result.items[0] ?? null
  }

  /** Jumlah record yang cocok dengan filter (tanpa mengambil datanya). */
  async count(filter = "") {
    const result = await this.getList(1, 1, { filter, fields: "id" })
    return result.totalItems
  }

  create(data, options = {}) {
    return this.pb.request(this.path, {
      method: "POST",
      body: data,
      query: { expand: options.expand },
      signal: options.signal,
      silent: options.silent,
    })
  }

  update(id, data, options = {}) {
    return this.pb.request(`${this.path}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
      query: { expand: options.expand },
      signal: options.signal,
      silent: options.silent,
    })
  }

  remove(id, options = {}) {
    return this.pb.request(`${this.path}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: options.signal,
      silent: options.silent,
    })
  }
}

/** Gabungkan potongan filter opsional menjadi satu ekspresi PocketBase. */
export function buildFilter(...parts) {
  const active = parts.filter((part) => part && String(part).trim())
  if (!active.length) return ""
  return active.length === 1 ? String(active[0]) : active.map((p) => `(${p})`).join(" && ")
}

/** Escape string agar aman dimasukkan ke ekspresi filter PocketBase. */
export function quote(value) {
  return `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

export default PocketBase
