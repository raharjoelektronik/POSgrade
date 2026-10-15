/**
 * icons.js - ikon SVG inline.
 *
 * Sengaja memakai SVG, bukan emoji: emoji bergantung pada font yang terpasang
 * di perangkat pengguna. Pada PC kasir/tablet yang tidak punya font emoji,
 * ikon emoji tampil sebagai kotak kosong (□). SVG selalu tampil sama.
 */
const NS = "http://www.w3.org/2000/svg"

/** Kumpulan path ikon (viewBox 24x24, garis, memakai currentColor). */
const PATHS = {
  cart: "M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h7.7a1 1 0 0 0 1-.8L19 7H6M9 20h.01M17 20h.01",
  chart: "M4 19V9M9 19V5M14 19v-7M19 19V11",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  box: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
  tag: "M3 12l9-9h8v8l-9 9zM16.5 8h.01",
  inbox: "M4 4h16v16H4zM4 14h4l2 3h4l2-3h4",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.7-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M18.5 20c0-2.2-.8-4-2.2-5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  key: "M15 9a4 4 0 1 0-3.5 4L10 15H8v2H6v2H3v-3l7.5-7.5A4 4 0 0 1 15 9z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6",
  menu: "M4 7h16M4 12h16M4 17h16",
  store: "M4 10v10h16V10M3 10l2-6h14l2 6M9 20v-6h6v6",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4",
  plus: "M12 5v14M5 12h14",
  logout: "M15 17l5-5-5-5M20 12H9M12 20H5V4h7",
}

/**
 * Buat elemen <svg> ikon.
 * @param {keyof typeof PATHS} name
 * @param {number} size ukuran dalam piksel
 * @returns {SVGElement}
 */
export function icon(name, size = 18) {
  const svg = document.createElementNS(NS, "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.7")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute("aria-hidden", "true")
  svg.style.flex = "0 0 auto"

  const path = document.createElementNS(NS, "path")
  path.setAttribute("d", PATHS[name] ?? PATHS.box)
  svg.appendChild(path)

  return svg
}

export default icon
