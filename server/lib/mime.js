/**
 * Peta ekstensi -> Content-Type.
 * Hanya yang diperlukan aplikasi; default fallback: application/octet-stream.
 */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
}

/** Kembalikan Content-Type berdasarkan ekstensi path. */
export function contentTypeFor(filePath) {
  const dot = filePath.lastIndexOf(".")
  if (dot === -1) return "application/octet-stream"
  return TYPES[filePath.slice(dot).toLowerCase()] ?? "application/octet-stream"
}

export default contentTypeFor
