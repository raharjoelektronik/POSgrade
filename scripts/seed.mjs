#!/usr/bin/env node
/**
 * seed.mjs - isi data contoh (idempotent, aman dijalankan berulang).
 *
 * Prasyarat:
 *   1. PocketBase sudah berjalan  -> npm run pb
 *   2. Superuser sudah dibuat      -> npm run pb:superuser -- <email> <password>
 *
 * Jalankan: npm run pb:seed
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// ---------------------------------------------------------------- konfigurasi
function loadEnv() {
  const file = path.join(ROOT, ".env")
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

const env = { ...loadEnv(), ...process.env }
const PB_URL = String(env.PB_URL ?? "http://127.0.0.1:8090").replace(/\/+$/, "")
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("✖ PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD belum diisi di file .env")
  process.exit(1)
}

let token = ""

async function api(pathname, { method = "GET", body, query } = {}) {
  const url = new URL(PB_URL + pathname)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
  }

  const headers = { Accept: "application/json" }
  if (token) headers.Authorization = token
  if (body) headers["Content-Type"] = "application/json"

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const error = new Error(payload?.message ?? `HTTP ${response.status}`)
    error.status = response.status
    error.data = payload?.data
    throw error
  }
  return payload
}

/** Cari record pertama berdasarkan filter, atau null. */
async function findOne(collection, filter) {
  const result = await api(`/api/collections/${collection}/records`, { query: { filter, perPage: 1 } })
  return result.items[0] ?? null
}

/** Buat record hanya bila belum ada (berdasarkan filter unik). */
async function upsert(collection, filter, data, label) {
  const existing = await findOne(collection, filter)
  if (existing) {
    console.log(`  • ${label} — sudah ada, dilewati`)
    return existing
  }
  const created = await api(`/api/collections/${collection}/records`, { method: "POST", body: data })
  console.log(`  ✓ ${label}`)
  return created
}

async function main() {
  console.log(`\n→ Menghubungi PocketBase di ${PB_URL}`)

  const auth = await api("/api/collections/_superusers/auth-with-password", {
    method: "POST",
    body: { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  token = auth.token
  console.log(`→ Login superuser sebagai ${ADMIN_EMAIL}\n`)

  // ------------------------------------------------------------------ pengguna
  console.log("Pengguna:")
  const users = [
    { email: "owner@posgrade.local", full_name: "Budi Pemilik", role: "owner" },
    { email: "admin@posgrade.local", full_name: "Sari Admin", role: "admin" },
    { email: "kasir@posgrade.local", full_name: "Dewi Kasir", role: "cashier" },
  ]
  for (const user of users) {
    await upsert(
      "users",
      `email = "${user.email}"`,
      {
        email: user.email,
        password: "posgrade123",
        passwordConfirm: "posgrade123",
        full_name: user.full_name,
        role: user.role,
        active: true,
        verified: true,
      },
      `${user.email} (${user.role}) — sandi: posgrade123`
    )
  }

  // ----------------------------------------------------------------- kategori
  console.log("\nKategori:")
  const categories = {}
  const categorySeed = [
    { name: "Minuman", sort_order: 1 },
    { name: "Makanan", sort_order: 2 },
    { name: "Snack", sort_order: 3 },
    { name: "Sembako", sort_order: 4 },
  ]
  for (const category of categorySeed) {
    categories[category.name] = await upsert(
      "categories",
      `name = "${category.name}"`,
      { ...category, active: true },
      category.name
    )
  }

  // ------------------------------------------------------------------- produk
  console.log("\nProduk:")
  const products = [
    ["KOPI-001", "Kopi Susu Gula Aren", "Minuman", 18000, 9000, 60, "pcs"],
    ["KOPI-002", "Americano Dingin", "Minuman", 15000, 7000, 40, "pcs"],
    ["TEH-001", "Es Teh Manis", "Minuman", 8000, 2500, 80, "pcs"],
    ["AIR-001", "Air Mineral 600ml", "Minuman", 4000, 2200, 120, "botol"],
    ["MKN-001", "Nasi Goreng Spesial", "Makanan", 25000, 13000, 25, "porsi"],
    ["MKN-002", "Mie Ayam Bakso", "Makanan", 22000, 11000, 20, "porsi"],
    ["SNK-001", "Keripik Kentang 60g", "Snack", 12000, 8000, 35, "pcs"],
    ["SNK-002", "Biskuit Cokelat", "Snack", 9500, 6000, 8, "pcs"],
    ["SNK-003", "Kacang Atom 100g", "Snack", 7000, 4500, 4, "pcs"],
    ["SBK-001", "Beras Premium 5kg", "Sembako", 78000, 68000, 15, "karung"],
    ["SBK-002", "Minyak Goreng 1L", "Sembako", 19000, 16000, 30, "botol"],
    ["SBK-003", "Gula Pasir 1kg", "Sembako", 17000, 14500, 3, "pcs"],
  ]

  for (const [sku, name, categoryName, price, cost, stock, unit] of products) {
    await upsert(
      "products",
      `sku = "${sku}"`,
      {
        sku,
        name,
        category: categories[categoryName]?.id ?? "",
        price,
        cost,
        stock,
        min_stock: 5,
        unit,
        taxable: true,
        active: true,
      },
      `${sku} · ${name}`
    )
  }

  // ---------------------------------------------------------------- pelanggan
  console.log("\nPelanggan:")
  const customers = [
    { name: "Umum", phone: "", points: 0 },
    { name: "Andi Wijaya", phone: "081234567890", points: 25 },
    { name: "Rina Kartika", phone: "089876543210", points: 12 },
  ]
  for (const customer of customers) {
    await upsert(
      "customers",
      `name = "${customer.name}"`,
      { ...customer, active: true },
      customer.name
    )
  }

  console.log("\n✅ Seed selesai. Login dengan owner@posgrade.local / posgrade123\n")
}

main().catch((error) => {
  console.error("\n✖ Seed gagal:", error.message)
  if (error.data) console.error(JSON.stringify(error.data, null, 2))
  if (error.status === 401) {
    console.error("  Petunjuk: pastikan PocketBase berjalan dan superuser sudah dibuat.")
    console.error("  Jalankan: npm run pb:superuser -- admin@posgrade.local posgrade123")
  }
  process.exit(1)
})
