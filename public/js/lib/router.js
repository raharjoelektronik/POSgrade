/**
 * router.js - router berbasis hash (tanpa dependency, tanpa server rewrite).
 *
 * Contoh:
 *   const router = new Router([
 *     { path: "/login", view: LoginView, public: true },
 *     { path: "/pos", view: PosView, title: "Kasir" },
 *     { path: "/sales/:id", view: SaleDetailView },
 *   ], { fallback: "/pos", notFound: NotFoundView })
 *   router.start()
 */
import { notify } from "./toast.js"

export class Router {
  /**
   * @param {Array<{path:string, view:Function, title?:string, roles?:string[],
   *                public?:boolean, hideChrome?:boolean, badge?:Function}>} routes
   * @param {{ fallback?: string, notFound?: Function, resolveAuth?: Function }} [options]
   */
  constructor(routes, options = {}) {
    this.routes = routes
    this.fallback = options.fallback ?? "/"
    this.notFound = options.notFound ?? null
    this.resolveAuth = options.resolveAuth ?? (() => true)
    this.current = null
    this.listeners = new Set()

    this.handleHashChange = this.handleHashChange.bind(this)
  }

  /** Mulai mendengarkan perubahan hash. */
  start() {
    window.addEventListener("hashchange", this.handleHashChange)
    this.handleHashChange()
    return this
  }

  stop() {
    window.removeEventListener("hashchange", this.handleHashChange)
  }

  /** Daftarkan callback setiap navigasi sukses: (route, params) => void */
  onChange(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Pindah halaman. */
  navigate(path, { replace = false } = {}) {
    const target = "#" + path
    if (window.location.hash === target) {
      this.handleHashChange()
      return
    }
    if (replace) {
      window.history.replaceState(null, "", target)
      this.handleHashChange()
    } else {
      window.location.hash = target
    }
  }

  /** Path saat ini tanpa tanda "#". */
  get path() {
    return decodeURI(window.location.hash.replace(/^#/, "")) || this.fallback
  }

  handleHashChange() {
    const raw = this.path
    const [pathname, search] = raw.split("?")
    const query = Object.fromEntries(new URLSearchParams(search ?? ""))

    // Normalisasi: buang trailing slash (kecuali root).
    const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname

    const match = this.match(clean)
    if (!match) {
      if (this.notFound) {
        this.redirectDepth = 0
        this.current = { route: { path: clean }, params: {}, query }
        this.notFound({ router: this, params: {}, query, path: clean })
        return
      }
      this._redirect(this.fallback)
      return
    }

    const { route, params } = match
    const auth = this.resolveAuth()

    // --- Guard: halaman privat saat belum login -------------------------
    if (!route.public && !auth.isAuthenticated) {
      this._redirect("/login")
      return
    }

    // --- Guard: sudah login tapi membuka halaman publik (login) ---------
    if (route.public && auth.isAuthenticated) {
      this._redirect(this.fallback)
      return
    }

    // --- Guard: peran pengguna -----------------------------------------
    if (route.roles && !route.roles.includes(auth.role)) {
      notify.error("Anda tidak memiliki akses ke halaman tersebut.")
      this._redirect(this.fallback)
      return
    }

    this.redirectDepth = 0
    this.current = { route, params, query }

    try {
      route.view({ router: this, params, query, route })
    } catch (error) {
      console.error("[router] view error:", error)
      notify.error("Terjadi kesalahan saat membuka halaman: " + error.message)
    }

    for (const listener of this.listeners) {
      listener(route, params, query)
    }
  }

  /**
   * Alihkan halaman dengan perlindungan loop.
   *
   * Tanpa ini, fallback yang juga ditolak guard (mis. pengguna tanpa `role`
   * yang selalu diarahkan ke halaman khusus owner/admin) akan memicu
   * rekursi tanpa henti dan membekukan browser.
   */
  _redirect(path) {
    this.redirectDepth = (this.redirectDepth ?? 0) + 1

    if (this.redirectDepth > 3) {
      console.error(
        `[router] pengalihan berulang terdeteksi menuju "${path}". ` +
          "Periksa peran (role) pengguna atau konfigurasi guard route."
      )
      this.redirectDepth = 0
      return
    }

    this.navigate(path, { replace: true })
  }

  /** Cocokkan path dengan daftar route; mendukung segmen dinamis ":id". */
  match(pathname) {
    const segments = pathname.split("/").filter(Boolean)

    for (const route of this.routes) {
      const routeSegments = route.path.split("/").filter(Boolean)
      if (routeSegments.length !== segments.length) continue

      const params = {}
      let ok = true

      for (let i = 0; i < routeSegments.length; i += 1) {
        const pattern = routeSegments[i]
        if (pattern.startsWith(":")) {
          params[pattern.slice(1)] = segments[i]
        } else if (pattern !== segments[i]) {
          ok = false
          break
        }
      }

      if (ok) return { route, params }
    }
    return null
  }
}

export default Router
