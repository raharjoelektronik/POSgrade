/**
 * Penyaji file statis untuk folder `public/`.
 *
 * Keamanan: path di-normalisasi dan diverifikasi tetap berada di dalam rootDir,
 * sehingga request seperti `/../../etc/passwd` tidak akan pernah lolos.
 */
import fs from "node:fs"
import path from "node:path"
import { contentTypeFor } from "./mime.js"

/**
 * @param {string} rootDir   Direktori akar (absolut).
 * @param {string} urlPath   Pathname dari URL request.
 * @param {import('node:http').ServerResponse} res
 * @param {{ dev?: boolean, spaFallback?: boolean }} [opts]
 * @returns {boolean} true bila file ditemukan & sudah dikirim.
 */
export function serveStatic(rootDir, urlPath, res, opts = {}) {
  const { dev = false, spaFallback = false } = opts

  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Bad request: malformed URL")
    return true
  }

  // Normalisasi + cegah directory traversal.
  const relative = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "")
  let filePath = path.join(rootDir, relative)

  if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Forbidden")
    return true
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html")
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // SPA fallback: semua route tak dikenal dikembalikan ke index.html.
    if (spaFallback) {
      const indexFile = path.join(rootDir, "index.html")
      if (fs.existsSync(indexFile)) {
        sendFile(indexFile, res, dev)
        return true
      }
    }
    return false
  }

  sendFile(filePath, res, dev)
  return true
}

function sendFile(filePath, res, dev) {
  const headers = {
    "Content-Type": contentTypeFor(filePath),
    "Cache-Control": dev ? "no-store" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  }
  res.writeHead(200, headers)
  fs.createReadStream(filePath).pipe(res)
}

export default serveStatic
