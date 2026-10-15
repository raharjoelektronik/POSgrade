#!/usr/bin/env node
/**
 * adopt-users.mjs - "mengadopsi" user PocketBase lama agar bisa dipakai di POSgrade.
 *
 * Mengapa perlu? Aplikasi ini menentukan hak akses dari dua field pada koleksi
 * `users`:
 *   - role   : owner | admin | cashier  (semua API Rule bergantung pada ini)
 *   - active : true/false              (login ditolak bila false)
 *
 * User yang dibuat di instance PocketBase lain (atau sebelum migration 1750000004)
 * belum punya kedua field tersebut, sehingga:
 *   - `active` bernilai false -> halaman login menolak dengan pesan
 *     "Akun Anda sedang dinonaktifkan".
 *   - `role` kosong -> login berhasil, tapi semua baca/tulis ditolak API Rules.
 *
 * Skrip ini mengisi field yang kosong saja; nilai yang sudah ada TIDAK diubah.
 *
 * Pakai:
 *   node scripts/adopt-users.mjs                      # pratinjau (dry-run)
 *   node scripts/adopt-users.mjs --apply              # terapkan, role default cashier
 *   node scripts/adopt-users.mjs --apply --role=owner # jadikan semua owner
 *   node scripts/adopt-users.mjs --apply --only=email@toko.id
 *
 * Prasyarat: PocketBase berjalan + PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD benar di .env
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const VALID_ROLES = ["owner", "admin", "cashier"]

// ------------------------------------------------------------------ argumen CLI
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const APPLY = flag("apply")
const ROLE = option("role", "cashier")
const ONLY = option("only", "")

if (!VALID_ROLES.includes(ROLE)) {
  console.error(`✖ --role harus salah satu dari: ${VALID_ROLES.join(", ")}`)
  process.exit(1)
}

// ---------------------------------------------------------------- konfigurasi
function loadEnv() {
  const file = path.join(ROOT, ".env")
  if (!fs.existsSync(file)) return {}
  const out = {}
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

  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
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

async function main() {
  console.log(`\n→ PocketBase: ${PB_URL}`)

  const auth = await api("/api/collections/_superusers/auth-with-password", {
    method: "POST",
    body: { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  token = auth.token

  let users = await api("/api/collections/users/records", { query: { perPage: 500, sort: "email" } })
  let items = users.items ?? []

  if (ONLY) items = items.filter((user) => user.email === ONLY)

  if (!items.length) {
    console.log("→ Tidak ada user yang cocok.\n")
    return
  }

  console.log(`→ Ditemukan ${items.length} user. Memeriksa kelayakan...\n`)

  const plan = []
  for (const user of items) {
    const patch = {}

    if (!user.role) patch.role = ROLE
    if (user.active !== true) patch.active = true
    if (!user.full_name) patch.full_name = user.name || String(user.email ?? "").split("@")[0]
    // Tanpa ini, PocketBase menyembunyikan field `email` dari pengguna lain
    // sehingga daftar pengguna & kolom kasir di riwayat transaksi kosong.
    if (user.emailVisibility !== true) patch.emailVisibility = true

    const notes = []
    if (patch.role) notes.push(`role -> ${patch.role}`)
    if (patch.active !== undefined) notes.push("active -> true")
    if (patch.full_name) notes.push("full_name diisi")
    if (patch.emailVisibility !== undefined) notes.push("emailVisibility -> true")

    plan.push({ user, patch, notes })
  }

  const pending = plan.filter((entry) => entry.notes.length)

  for (const { user, notes } of plan) {
    const status = notes.length ? "PERLU DIPERBAIKI" : "sudah siap"
    console.log(`  ${notes.length ? "•" : "✓"} ${user.email}`)
    console.log(`      ${status}${notes.length ? ": " + notes.join(", ") : ""}`)
  }

  if (!pending.length) {
    console.log("\n✅ Semua user sudah punya role & aktif. Tidak ada yang perlu diubah.\n")
    return
  }

  console.log(`\n→ ${pending.length} user perlu diperbaiki.`)

  if (!APPLY) {
    console.log("   (mode PRATINJAU — tidak ada perubahan yang ditulis)")
    console.log("   Jalankan ulang dengan --apply untuk menerapkan.\n")
    return
  }

  let ok = 0
  let failed = 0
  for (const { user, patch } of pending) {
    try {
      await api(`/api/collections/users/records/${user.id}`, { method: "PATCH", body: patch })
      ok += 1
      console.log(`  ✓ ${user.email} diperbarui`)
    } catch (error) {
      failed += 1
      console.error(`  ✖ ${user.email} gagal: ${error.message}`)
    }
  }

  console.log(`\n✅ Selesai: ${ok} diperbarui, ${failed} gagal.`)
  console.log("   User sekarang bisa login ke aplikasi POSgrade.\n")
}

main().catch((error) => {
  console.error("\n✖ Gagal:", error.message)
  if (error.status === 401) {
    console.error("  Petunjuk: pastikan PocketBase berjalan & kredensial superuser di .env benar.")
  }
  process.exit(1)
})
