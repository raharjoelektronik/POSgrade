/**
 * Reverse proxy transparan:  Node.js  ->  PocketBase
 *
 * Tujuan:
 *  1. Menghindari CORS sepenuhnya (frontend & API jadi same-origin).
 *  2. Port/URL PocketBase tidak perlu diekspos ke browser.
 *  3. Streaming tetap jalan (realtime SSE PocketBase di /api/realtime).
 *
 * Pemetaan:  /pb<anything>  ->  ${pbUrl}<anything>
 */
import http from "node:http"
import https from "node:https"
import { URL } from "node:url"

/** Header hop-by-hop yang tidak boleh diteruskan. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} targetBase  contoh: "http://127.0.0.1:8090"
 * @param {{ prefix?: string, dev?: boolean, timeoutMs?: number }} [opts]
 */
export function proxyRequest(req, res, targetBase, opts = {}) {
  const { prefix = "/pb", dev = false, timeoutMs = 30_000 } = opts

  const base = new URL(targetBase)
  const incoming = new URL(req.url, "http://localhost")
  const forwardedPath = incoming.pathname.slice(prefix.length) || "/"

  const isTls = base.protocol === "https:"
  const client = isTls ? https : http

  // Susun header baru: buang hop-by-hop + host lama, lalu set host target.
  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    headers[key] = value
  }
  headers.host = base.host
  headers["x-forwarded-host"] = req.headers.host ?? ""
  headers["x-forwarded-proto"] = isTls ? "https" : "http"

  const upstream = client.request(
    {
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port || (isTls ? 443 : 80),
      method: req.method,
      path: forwardedPath + incoming.search,
      headers,
    },
    (upstreamRes) => {
      const responseHeaders = {}
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (HOP_BY_HOP.has(key.toLowerCase())) continue
        responseHeaders[key] = value
      }
      res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders)

      // pipe() menangani SSE/streaming sekaligus backpressure.
      upstreamRes.pipe(res)

      upstreamRes.on("error", () => res.destroy())
    }
  )

  upstream.setTimeout(timeoutMs, () => {
    upstream.destroy(new Error(`Upstream timeout after ${timeoutMs}ms`))
  })

  upstream.on("error", (error) => {
    if (dev) console.error("[proxy] error:", error.message)

    if (res.headersSent) {
      res.destroy()
      return
    }
    // Backend belum jalan -> beri pesan yang jelas ke developer.
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" })
    res.end(
      JSON.stringify({
        status: 502,
        message: "Tidak dapat terhubung ke PocketBase.",
        hint: `Pastikan PocketBase berjalan di ${targetBase} (jalankan: npm run pb).`,
        error: dev ? error.message : undefined,
      })
    )
  })

  // Teruskan body request (POST/PATCH multipart dsb.).
  req.pipe(upstream)

  req.on("aborted", () => upstream.destroy())
}

export default proxyRequest
