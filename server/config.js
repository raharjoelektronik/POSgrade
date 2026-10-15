/**
 * Konfigurasi server POSgrade.
 * Sumber nilai (prioritas): process.env > file .env > default.
 * Ditulis tanpa dependency agar proyek tetap 100% native.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Parser .env sederhana: KEY=VALUE per baris, mendukung komentar `#`
 * dan tanda kutip pembungkus.
 */
function parseDotEnv(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const eq = line.indexOf("=")
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const fileEnv = parseDotEnv(path.join(ROOT_DIR, ".env"))

/** Ambil nilai dari process.env lalu file .env, dengan fallback. */
function env(key, fallback) {
  const value = process.env[key] ?? fileEnv[key]
  return value === undefined || value === "" ? fallback : value
}

function bool(value) {
  return value === true || value === "1" || value === "true" || value === "yes"
}

export const config = {
  host: env("HOST", "127.0.0.1"),
  port: Number(env("PORT", "3000")),
  dev: bool(env("DEV", "1")),

  /** Base URL PocketBase, tanpa trailing slash. */
  pbUrl: String(env("PB_URL", "http://127.0.0.1:8090")).replace(/\/+$/, ""),

  /** Direktori aset frontend yang disajikan apa adanya. */
  publicDir: path.join(ROOT_DIR, "public"),

  /** Prefix URL proxy menuju PocketBase (frontend memakai prefix ini). */
  proxyPrefix: "/pb",
}

export default config
