/**
 * format.js - format angka, mata uang, dan tanggal (locale Indonesia).
 */

const NUMBER_FORMATTER = new Intl.NumberFormat("id-ID")
const DECIMAL_FORMATTER = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 })
const DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})
const DATETIME_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
const TIME_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

/** 12345 -> "12.345" */
export function int(value) {
  return NUMBER_FORMATTER.format(Math.round(Number(value) || 0))
}

/** 1234.5 -> "1.234,5" */
export function decimal(value) {
  return DECIMAL_FORMATTER.format(Number(value) || 0)
}

/** 15000 -> "Rp15.000" */
export function rupiah(value) {
  return "Rp" + int(value)
}

/** Ubah input pengguna ("15.000", "15000") menjadi angka. */
export function parseNumber(value) {
  if (typeof value === "number") return value
  if (!value) return 0
  const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function toDate(value) {
  if (!value) return null
  // PocketBase mengirim "2026-10-15 07:09:08.123Z" -> jadikan ISO valid.
  const normalized = String(value).includes("T") ? value : String(value).replace(" ", "T")
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "2026-10-15 ..." -> "15 Okt 2026" */
export function formatDate(value) {
  const date = toDate(value)
  return date ? DATE_FORMATTER.format(date) : "-"
}

/** "2026-10-15 ..." -> "15 Okt 2026 14.05" */
export function formatDateTime(value) {
  const date = toDate(value)
  return date ? DATETIME_FORMATTER.format(date) : "-"
}

/** "2026-10-15 ..." -> "14.05" */
export function formatTime(value) {
  const date = toDate(value)
  return date ? TIME_FORMATTER.format(date) : "-"
}

/** Tanggal hari ini sebagai "YYYY-MM-DD" (waktu lokal). */
export function todayISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Format tanggal yang dipahami filter PocketBase: "YYYY-MM-DD 00:00:00". */
export function pbDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** Rentang hari ini dalam format filter PocketBase. */
export function todayRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start: pbDateTime(start), end: pbDateTime(end) }
}

/** Rentang N hari terakhir (termasuk hari ini). */
export function lastDaysRange(days = 7, date = new Date()) {
  const start = new Date(date)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start: pbDateTime(start), end: pbDateTime(end) }
}

/** Inisial untuk avatar: "Budi Santoso" -> "BS" */
export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Label peran dalam bahasa Indonesia. */
export const ROLE_LABELS = {
  owner: "Pemilik",
  admin: "Admin",
  cashier: "Kasir",
}

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? "Tanpa peran"
}

/** Label metode pembayaran. */
export const PAYMENT_LABELS = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  debit: "Kartu Debit",
  ewallet: "E-Wallet",
}

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] ?? method ?? "-"
}

/** Label status struk. */
export const STATUS_LABELS = {
  completed: "Selesai",
  refunded: "Refund",
  void: "Dibatalkan",
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? "-"
}
