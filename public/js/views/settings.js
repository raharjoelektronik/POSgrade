/**
 * views/settings.js - pengaturan toko (koleksi singleton `settings`).
 */
import { h, render, readForm, setBusy } from "../lib/dom.js"
import { checkboxInput, field, numberInput, showFieldErrors, textInput, textareaInput } from "../components/form.js"
import { notify } from "../lib/toast.js"
import { appStore } from "../lib/store.js"
import { loadSettings, saveSettings } from "../services.js"

export function SettingsView({ outlet }) {
  const formHost = h(
    "div",
    { class: "card" },
    h("div", { class: "card__body" }, h("div", { class: "skeleton", style: { height: "220px" } }))
  )

  render(
    outlet,
    h(
      "div",
      { class: "page" },
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          {},
          h("h2", {}, "Pengaturan Toko"),
          h("p", { class: "page-head__meta" }, "Nama toko, pajak, pembulatan, dan footer struk.")
        ),
        h("div", { class: "page-head__actions" })
      ),
      formHost
    )
  )

  load()

  async function load() {
    const settings = (await loadSettings({ force: true })) ?? {}

    const form = h(
      "form",
      { id: "settings-form", onsubmit: submit },
      h("div", { class: "card__head" }, h("h3", { class: "card__title" }, "Identitas Toko")),
      h(
        "div",
        { class: "card__body" },
        h(
          "div",
          { class: "form-grid" },
          field({
            label: "Nama toko",
            className: "span-2",
            input: textInput({ name: "store_name", value: settings.store_name }),
          }),
          field({
            label: "Alamat",
            className: "span-2",
            input: textareaInput({ name: "address", value: settings.address, rows: 2 }),
          }),
          field({ label: "Telepon", input: textInput({ name: "phone", value: settings.phone }) }),
          field({
            label: "Mata uang",
            input: textInput({ name: "currency", value: settings.currency ?? "IDR" }),
          })
        )
      ),
      h("div", { class: "card__head" }, h("h3", { class: "card__title" }, "Pajak & Pembulatan")),
      h(
        "div",
        { class: "card__body" },
        h(
          "div",
          { class: "form-grid" },
          field({
            label: "Persentase pajak (%)",
            input: numberInput({ name: "tax_percent", value: settings.tax_percent ?? 0, min: 0, max: 100, step: "0.1" }),
            hint: "Isi 0 bila toko tidak memungut pajak.",
          }),
          field({
            label: "Ambang stok menipis",
            input: numberInput({ name: "low_stock_threshold", value: settings.low_stock_threshold ?? 5, min: 0 }),
          }),
          h(
            "div",
            { class: "span-2 row row--wrap" },
            checkboxInput({
              name: "tax_included",
              label: "Harga produk sudah termasuk pajak",
              checked: settings.tax_included ?? true,
            }),
            checkboxInput({
              name: "round_to_100",
              label: "Bulatkan total ke ratusan terdekat",
              checked: settings.round_to_100 ?? true,
            })
          )
        )
      ),
      h("div", { class: "card__head" }, h("h3", { class: "card__title" }, "Struk")),
      h(
        "div",
        { class: "card__body" },
        h(
          "div",
          { class: "form-grid" },
          field({
            label: "Footer struk",
            className: "span-2",
            input: textareaInput({ name: "receipt_footer", value: settings.receipt_footer, rows: 2 }),
            hint: "Mis. ucapan terima kasih atau info kontak.",
          })
        ),
        h(
          "div",
          { class: "mt-4" },
          h("button", { class: "btn btn--primary", type: "submit" }, "Simpan Pengaturan")
        )
      )
    )

    formHost.replaceChildren(form)

    async function submit(event) {
      event.preventDefault()
      const button = form.querySelector("button[type=submit]")
      const data = readForm(form)

      setBusy(button, true, "Menyimpan…")
      try {
        await saveSettings({
          store_name: String(data.store_name ?? "").trim(),
          address: String(data.address ?? "").trim(),
          phone: String(data.phone ?? "").trim(),
          currency: String(data.currency ?? "IDR").trim() || "IDR",
          tax_percent: Number(data.tax_percent) || 0,
          tax_included: Boolean(data.tax_included),
          round_to_100: Boolean(data.round_to_100),
          receipt_footer: String(data.receipt_footer ?? "").trim(),
          low_stock_threshold: Math.max(0, Number(data.low_stock_threshold) || 0),
        })
        notify.success("Pengaturan tersimpan. Muat ulang halaman bila nama toko belum berubah.")
        appStore.set({ settings: appStore.pick("settings") })
      } catch (error) {
        showFieldErrors(form, error.fieldErrors ?? {})
        console.error("[settings] gagal menyimpan:", error)
      } finally {
        setBusy(button, false)
      }
    }
  }
}

export default SettingsView
