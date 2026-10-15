/**
 * POSgrade - web server Node.js (zero dependency).
 *
 * Tugasnya hanya 4:
 *   1. Menyajikan file statis dari `public/` (HTML/CSS/JS native, tanpa build).
 *   2. Menyuntikkan konfigurasi runtime ke browser lewat `GET /config.js`.
 *   3. Menjadi reverse proxy `/pb/*` -> PocketBase (bebas CORS, port backend aman).
 *   4. Menyediakan `GET /healthz` untuk memantau status PocketBase.
 *
 * Jalankan:  node server/index.js   (atau: npm start)
 */
import http from "node:http"
import { config } from "./config.js"
import { serveStatic } from "./lib/static.js"
import { proxyRequest } from "./lib/proxy.js"

const { host, port, dev, pbUrl, publicDir, proxyPrefix } = config

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname

  if (dev) {
    console.log(`${req.method} ${req.url}`)
  }

  // ------------------------------------------------ 1. konfigurasi runtime klien
  if (pathname === "/config.js") {
    const runtime = {
      apiBase: proxyPrefix, // frontend memanggil: /pb/api/collections/...
      appName: "POSgrade",
      version: "0.1.0",
      dev,
    }
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    })
    res.end(`window.__POS_CONFIG__ = ${JSON.stringify(runtime, null, 2)};\n`)
    return
  }

  // ------------------------------------------------------------ 2. health check
  if (pathname === "/healthz") {
    probePocketBase(pbUrl).then((ok) => {
      const body = JSON.stringify({ app: "posgrade", pocketbase: ok ? "up" : "down", pbUrl })
      res.writeHead(ok ? 200 : 503, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      })
      res.end(body)
    })
    return
  }

  // ------------------------------------------------------- 3. proxy ke PocketBase
  if (pathname === proxyPrefix || pathname.startsWith(proxyPrefix + "/")) {
    proxyRequest(req, res, pbUrl, { prefix: proxyPrefix, dev })
    return
  }

  // --------------------------------------------------------------- 4. file statis
  const sent = serveStatic(publicDir, pathname === "/" ? "/index.html" : pathname, res, {
    dev,
    spaFallback: true, // semua route frontend dikembalikan ke index.html
  })

  if (!sent) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("404 - Not Found")
  }
})

server.listen(port, host, () => {
  console.log("")
  console.log("  POSgrade siap 🚀")
  console.log(`  ├─ Aplikasi     : http://${host}:${port}`)
  console.log(`  ├─ PocketBase   : ${pbUrl}  (dashboard: ${pbUrl}/_/)`)
  console.log(`  ├─ Proxy API    : http://${host}:${port}${proxyPrefix}/*  ->  ${pbUrl}/*`)
  console.log(`  └─ Mode         : ${dev ? "development (cache off, log on)" : "production"}`)
  console.log("")
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n  ✖ Port ${port} sudah dipakai proses lain.`)
    console.error(`    Ubah PORT di file .env atau hentikan proses tersebut.\n`)
  } else {
    console.error("\n  ✖ Server gagal start:", error.message, "\n")
  }
  process.exit(1)
})

/** Cek apakah PocketBase merespons endpoint health-nya. */
function probePocketBase(base) {
  return new Promise((resolve) => {
    const request = http.get(`${base}/api/health`, (response) => {
      response.resume()
      resolve(response.statusCode === 200)
    })
    request.setTimeout(1500, () => request.destroy())
    request.on("error", () => resolve(false))
  })
}

// Matikan dengan rapi saat Ctrl+C / container dihentikan.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n  Menerima ${signal}, menutup server...`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
