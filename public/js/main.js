/**
 * main.js - entry point aplikasi POSgrade.
 *
 * Alur bootstrap:
 *   1. Validasi sesi tersimpan (authRefresh).
 *   2. Muat data bersama (pengaturan toko, kategori, shift aktif).
 *   3. Bangun router + render kerangka layout.
 */
import { pb, cfg } from "./api.js"
import { Router } from "./lib/router.js"
import { renderLayout } from "./components/layout.js"
import { notify } from "./lib/toast.js"
import { loadCategories, loadLowStockProducts, loadOpenShift, loadSettings } from "./services.js"

import { LoginView } from "./views/login.js"
import { DashboardView } from "./views/dashboard.js"
import { PosView } from "./views/pos.js"
import { ProductsView } from "./views/products.js"
import { CategoriesView } from "./views/categories.js"
import { CustomersView } from "./views/customers.js"
import { SalesView } from "./views/sales.js"
import { StockView } from "./views/stock.js"
import { ShiftsView } from "./views/shifts.js"
import { UsersView } from "./views/users.js"
import { SettingsView } from "./views/settings.js"

const app = document.getElementById("app")

/** Halaman default per peran. */
function homeFor(role) {
  return role === "cashier" ? "/pos" : "/dashboard"
}

const routes = [
  { path: "/login", view: LoginView, public: true },
  { path: "/pos", view: PosView },
  { path: "/dashboard", view: DashboardView, roles: ["owner", "admin"] },
  { path: "/sales", view: SalesView },
  { path: "/products", view: ProductsView, roles: ["owner", "admin"] },
  { path: "/categories", view: CategoriesView, roles: ["owner", "admin"] },
  { path: "/stock", view: StockView, roles: ["owner", "admin"] },
  { path: "/customers", view: CustomersView },
  { path: "/shifts", view: ShiftsView },
  { path: "/users", view: UsersView, roles: ["owner"] },
  { path: "/settings", view: SettingsView, roles: ["owner", "admin"] },
]

let router = null

async function bootstrap() {
  // --- 1. Validasi sesi tersimpan ---------------------------------------
  if (pb.isAuthenticated) {
    try {
      await pb.authRefresh()
    } catch {
      pb.clearAuth()
      notify.warning("Sesi berakhir, silakan masuk kembali.")
    }
  }

  // --- 2. Data bersama --------------------------------------------------
  if (pb.isAuthenticated) {
    await preloadSharedData()
  }

  // --- 3. Router + layout ----------------------------------------------
  router = new Router(routes, {
    fallback: homeFor(pb.role),
    resolveAuth: () => pb,
    notFound: (ctx) => {
      const outlet = mountShell(ctx.path, "Tidak ditemukan")
      outlet.appendChild(
        renderNotFound(ctx.path, () => router.navigate(homeFor(pb.role), { replace: true }))
      )
    },
  })

  router.onChange((route, params, query) => {
    // Sinkronkan judul dokumen.
    document.title = `${route.title ?? titleFor(router.path)} · ${cfg.appName}`
  })

  // Pantau perubahan sesi (mis. token dicabut server).
  pb.onAuthChange((user) => {
    if (!user && !router.current?.route?.public) {
      router.navigate("/login", { replace: true })
    }
  })

  router.start()
}

/** Render kerangka layout dan kembalikan outlet konten. */
function mountShell(pathname, title) {
  if (!pb.isAuthenticated) {
    app.replaceChildren()
    return app
  }
  const { outlet } = renderLayout(app, {
    user: pb.user,
    role: pb.role,
    activePath: pathname,
    title,
    onLogout: () => {
      pb.logout()
      router.navigate("/login", { replace: true })
    },
  })
  return outlet
}

/** Nama halaman untuk judul dokumen. */
function titleFor(pathname) {
  const clean = pathname.replace(/^\//, "")
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : cfg.appName
}

function renderNotFound(pathname, onHome) {
  const wrap = document.createElement("div")
  wrap.className = "page"
  wrap.innerHTML = `
    <section class="card">
      <div class="card__body">
        <h2 class="card__title">Halaman tidak ditemukan</h2>
        <p class="muted small mt-4">Rute <code class="mono">${pathname}</code> tidak terdaftar.</p>
        <p class="mt-4"><button class="btn btn--primary" type="button">Kembali ke halaman utama</button></p>
      </div>
    </section>`
  wrap.querySelector("button")?.addEventListener("click", onHome)
  return wrap
}

/** Muat data yang dipakai hampir semua halaman. */
export async function preloadSharedData() {
  const tasks = [loadSettings(), loadCategories().catch(() => []), loadLowStockProducts().catch(() => [])]
  if (pb.user?.id) tasks.push(loadOpenShift(pb.user.id).catch(() => null))
  await Promise.all(tasks)
}

bootstrap().catch((error) => {
  console.error("[posgrade] gagal bootstrap:", error)
  app.replaceChildren()
  const box = document.createElement("div")
  box.className = "page"
  box.innerHTML = `<div class="alert">Gagal memuat aplikasi: ${error.message}</div>`
  app.appendChild(box)
})

// Ekspor helper agar bisa dipakai dari console saat development.
window.POSgrade = { pb, cfg, getRouter: () => router, mountShell, preloadSharedData }
