/**
 * views/login.js - halaman masuk (publik, tanpa shell sidebar).
 */
import { h, render, setBusy } from "../lib/dom.js"
import { pb, cfg } from "../api.js"
import { notify } from "../lib/toast.js"
import { effectiveSettings } from "../lib/store.js"
import { loadCategories, loadLowStockProducts, loadOpenShift, loadSettings } from "../services.js"

export function LoginView({ root, router }) {
  const settings = effectiveSettings()

  const errorBox = h("div", { class: "alert", hidden: true })
  const submitButton = h("button", { class: "btn btn--primary btn--lg btn--block", type: "submit" }, "Masuk")

  const form = h(
    "form",
    { class: "login__card", onsubmit: onSubmit },
    h(
      "div",
      { class: "login__brand" },
      h("span", { class: "sidebar__logo", "aria-hidden": "true" }, "₪"),
      h("span", {}, settings.store_name || cfg.appName)
    ),
    h("p", { class: "login__sub" }, "Masuk untuk mulai melayani transaksi."),
    errorBox,
    h(
      "label",
      { class: "field" },
      h("span", { class: "field__label" }, "Email"),
      h("input", {
        class: "input",
        type: "email",
        name: "identity",
        placeholder: "kasir@toko.id",
        autocomplete: "username",
        required: true,
        autofocus: true,
      })
    ),
    h(
      "label",
      { class: "field" },
      h("span", { class: "field__label" }, "Kata sandi"),
      h("input", {
        class: "input",
        type: "password",
        name: "password",
        placeholder: "••••••••",
        autocomplete: "current-password",
        required: true,
      })
    ),
    submitButton,
    h(
      "p",
      { class: "xsmall muted", style: { textAlign: "center" } },
      "Kelola pengguna lewat dashboard PocketBase: ",
      h("a", { href: "/pb/_/", target: "_blank", rel: "noopener" }, "/pb/_/")
    )
  )

  render(root, h("div", { class: "login" }, form))

  async function onSubmit(event) {
    event.preventDefault()
    const data = new FormData(form)
    const identity = String(data.get("identity") ?? "").trim()
    const password = String(data.get("password") ?? "")

    if (!identity || !password) return

    errorBox.hidden = true
    setBusy(submitButton, true, "Memeriksa…")

    try {
      await pb.authWithPassword(identity, password)

      if (pb.user?.active === false) {
        pb.logout()
        throw new Error("Akun Anda sedang dinonaktifkan. Hubungi pemilik toko.")
      }

      // Muat data bersama sebelum masuk supaya halaman pertama sudah siap.
      await Promise.all([
        loadSettings({ force: true }),
        loadCategories({ force: true }).catch(() => []),
        loadLowStockProducts().catch(() => []),
        loadOpenShift(pb.user?.id).catch(() => null),
      ])

      notify.success(`Selamat bekerja, ${pb.displayName}!`)
      router.navigate(pb.role === "cashier" ? "/pos" : "/dashboard", { replace: true })
    } catch (error) {
      errorBox.textContent =
        error.status === 400 || error.status === 0
          ? "Email atau kata sandi salah."
          : error.message
      errorBox.hidden = false
    } finally {
      setBusy(submitButton, false)
    }
  }
}

export default LoginView
