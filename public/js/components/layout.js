/**
 * layout.js - kerangka halaman: sidebar, topbar, dan outlet konten.
 * Dipanggil ulang setiap navigasi oleh main.js.
 */
import { h } from "../lib/dom.js"
import { icon } from "../lib/icons.js"
import { initials, roleLabel } from "../lib/format.js"
import { appStore, effectiveSettings } from "../lib/store.js"
import { cfg } from "../api.js"

/** Struktur menu. `roles` menentukan siapa yang boleh melihat menu tersebut. */
export const NAV_GROUPS = [
  {
    group: "Operasional",
    items: [
      { path: "/pos", label: "Kasir", icon: "cart", roles: ["owner", "admin", "cashier"] },
      { path: "/dashboard", label: "Dashboard", icon: "chart", roles: ["owner", "admin"] },
      { path: "/sales", label: "Transaksi", icon: "receipt", roles: ["owner", "admin", "cashier"] },
    ],
  },
  {
    group: "Master Data",
    items: [
      { path: "/products", label: "Produk", icon: "box", roles: ["owner", "admin"] },
      { path: "/categories", label: "Kategori", icon: "tag", roles: ["owner", "admin"] },
      { path: "/stock", label: "Stok", icon: "inbox", roles: ["owner", "admin"] },
      { path: "/customers", label: "Pelanggan", icon: "users", roles: ["owner", "admin", "cashier"] },
    ],
  },
  {
    group: "Sistem",
    items: [
      { path: "/shifts", label: "Shift Kasir", icon: "clock", roles: ["owner", "admin", "cashier"] },
      { path: "/users", label: "Pengguna", icon: "key", roles: ["owner"] },
      { path: "/settings", label: "Pengaturan", icon: "settings", roles: ["owner", "admin"] },
    ],
  },
]

/** Semua route yang butuh shell (untuk menentukan judul halaman). */
export function findNavItem(pathname) {
  const base = "/" + pathname.split("/").filter(Boolean).slice(0, 1).join("/")
  for (const group of NAV_GROUPS) {
    const found = group.items.find((item) => item.path === base)
    if (found) return found
  }
  return null
}

function navLink(item, activePath, onNavigate) {
  const isActive = activePath === item.path || activePath.startsWith(item.path + "/")
  const badge =
    item.path === "/stock" && appStore.pick("lowStockCount") > 0
      ? h("span", { class: "navlink__badge" }, String(appStore.pick("lowStockCount")))
      : null

  return h(
    "a",
    {
      class: ["navlink", isActive && "is-active"],
      href: "#" + item.path,
      onclick: () => onNavigate?.(item.path),
    },
    h("span", { class: "navlink__icon" }, icon(item.icon, 18)),
    h("span", { class: "grow" }, item.label),
    badge
  )
}

/**
 * Render kerangka aplikasi.
 * @param {HTMLElement} root elemen #app
 * @param {{ user:object, role:string, activePath:string, onLogout:Function,
 *           onNavigate?:Function, title?:string }} options
 * @returns {{ outlet:HTMLElement, shell:HTMLElement }}
 */
export function renderLayout(root, options) {
  const { user, role, activePath = "/pos", onLogout, onNavigate, title } = options
  const settings = effectiveSettings()

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length)

  const sidebar = h(
    "aside",
    { class: "sidebar", id: "sidebar" },
    h(
      "div",
      { class: "sidebar__brand" },
      h("span", { class: "sidebar__logo", "aria-hidden": "true" }, icon("store", 18)),
      h("span", {}, settings.store_name || cfg.appName)
    ),
    h(
      "nav",
      { class: "sidebar__nav" },
      visibleGroups.map((group) =>
        h(
          "div",
          {},
          h("div", { class: "sidebar__group" }, group.group),
          group.items.map((item) => navLink(item, activePath, onNavigate))
        )
      )
    ),
    h(
      "div",
      { class: "sidebar__foot" },
      h("div", {}, `${cfg.appName} v${cfg.version}`),
      h("div", {}, "Native HTML · Node.js · PocketBase")
    )
  )

  const activeItem = findNavItem(activePath)
  const pageTitle = title ?? activeItem?.label ?? cfg.appName

  const topbar = h(
    "header",
    { class: "topbar" },
    h(
      "button",
      {
        class: "btn btn--ghost nav-toggle",
        type: "button",
        "aria-label": "Buka menu",
        onclick: () => document.querySelector(".shell")?.classList.toggle("nav-open"),
      },
      icon("menu", 20)
    ),
    h("h1", { class: "topbar__title" }, pageTitle),
    h("div", { class: "topbar__spacer" }),
    h("div", { class: "topbar__user" }, userBadge(user, role)),
    h(
      "button",
      { class: "btn btn--sm", type: "button", onclick: () => onLogout?.() },
      "Keluar"
    )
  )

  const outlet = h("div", { class: "view-outlet", id: "view-outlet" })

  const shell = h(
    "div",
    { class: "shell" },
    sidebar,
    h("div", { class: "main" }, topbar, outlet)
  )

  root.replaceChildren(shell)
  return { outlet, shell }
}

function userBadge(user, role) {
  const name = user?.full_name || user?.email || "Pengguna"
  return h(
    "div",
    { class: "row" },
    h("span", { class: "avatar", "aria-hidden": "true" }, initials(name)),
    h(
      "div",
      { style: { lineHeight: "1.2" } },
      h("div", { style: { fontWeight: "600" } }, name),
      h("div", { class: "xsmall muted" }, roleLabel(role))
    )
  )
}

export default renderLayout
