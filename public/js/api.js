/**
 * api.js - satu-satunya tempat membuat instance PocketBase.
 *
 * Konfigurasi runtime datang dari `window.__POS_CONFIG__` yang disuntikkan
 * oleh server Node (lihat server/index.js -> GET /config.js).
 */
import PocketBase from "./lib/pb.js"

export const cfg = {
  apiBase: "/pb",
  appName: "POSgrade",
  version: "0.1.0",
  dev: false,
  ...(window.__POS_CONFIG__ ?? {}),
}

/** Instance PocketBase tunggal untuk seluruh aplikasi. */
export const pb = new PocketBase(cfg.apiBase)

/** Pintasan koleksi supaya tidak salah ketik nama. */
export const db = {
  users: pb.collection("users"),
  categories: pb.collection("categories"),
  products: pb.collection("products"),
  customers: pb.collection("customers"),
  sales: pb.collection("sales"),
  saleItems: pb.collection("sale_items"),
  stockMoves: pb.collection("stock_moves"),
  shifts: pb.collection("shifts"),
  settings: pb.collection("settings"),
}

export default pb
