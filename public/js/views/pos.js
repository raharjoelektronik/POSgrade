/**
 * views/pos.js - halaman kasir (inti aplikasi).
 *
 * Alur: cari/klik produk -> keranjang -> Bayar -> struk.
 * Stok otomatis berkurang lewat hook PocketBase (pb/pb_hooks/main.pb.js).
 */
import { h, render, clear, debounce, setBusy, appendAll } from "../lib/dom.js"
import { icon } from "../lib/icons.js"
import { rupiah, int, parseNumber, paymentLabel, formatDateTime } from "../lib/format.js"
import { Cart } from "../lib/cart.js"
import { openModal } from "../lib/modal.js"
import { notify } from "../lib/toast.js"
import { appStore, effectiveSettings } from "../lib/store.js"
import { pb } from "../api.js"
import { renderReceipt, printReceipt } from "../lib/receipt.js"
import {
  addLoyaltyPoints,
  createSale,
  loadOpenShift,
  searchCustomers,
  searchProducts,
} from "../services.js"

const cart = new Cart()

export function PosView({ outlet, router }) {
  let products = []
  let activeCategory = ""
  let keyword = ""
  let controller = null

  const shiftBanner = h("div", { hidden: true })

  const searchInput = h("input", {
    class: "input",
    type: "search",
    placeholder: "Cari nama / SKU / barcode… (F2)",
    autocomplete: "off",
    oninput: debounce((event) => {
      keyword = event.target.value.trim()
      reload()
    }, 260),
    onkeydown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        const first = products[0]
        if (first) cart.add(first, 1)
      }
    },
  })

  const categoryBar = h("div", { class: "pos__cats" })
  const grid = h("div", { class: "product-grid" }, skeletonCards())
  const cartItems = h("div", { class: "cart__items" })
  const cartSummary = h("div", { class: "cart__summary" })

  const checkoutButton = h(
    "button",
    { class: "btn btn--primary btn--lg btn--block", type: "button", onclick: openCheckout },
    "Bayar (F9)"
  )
  const clearButton = h(
    "button",
    { class: "btn btn--block", type: "button", onclick: () => cart.clear() },
    "Kosongkan"
  )

  render(
    outlet,
    h(
      "div",
      { class: "pos" },
      h(
        "div",
        { class: "pos__catalog" },
        shiftBanner,
        h("div", { class: "pos__search" }, searchInput),
        categoryBar,
        grid
      ),
      h(
        "aside",
        { class: "cart" },
        h(
          "div",
          { class: "cart__head" },
          icon("cart", 18),
          h("span", {}, "Keranjang"),
          h("span", { class: "badge" }, "0 item")
        ),
        cartItems,
        cartSummary,
        h("div", { class: "cart__foot" }, checkoutButton, clearButton)
      )
    )
  )

  // --- Render ulang keranjang setiap ada perubahan -------------------------
  const unsubscribe = cart.subscribe(() => renderCart())

  // --- Pintasan papan ketik ------------------------------------------------
  function onKeydown(event) {
    if (event.key === "F2") {
      event.preventDefault()
      searchInput.focus()
      searchInput.select()
    }
    if (event.key === "F9") {
      event.preventDefault()
      if (!cart.isEmpty) openCheckout()
    }
  }
  document.addEventListener("keydown", onKeydown)

  // --- Bersihkan listener saat halaman ditinggalkan ------------------------
  window.addEventListener(
    "hashchange",
    () => {
      unsubscribe()
      document.removeEventListener("keydown", onKeydown)
      controller?.abort()
    },
    { once: true }
  )

  loadShift()
  loadCategories()
  reload()
  renderCart()

  // ------------------------------------------------------------- data loading
  async function loadShift() {
    const shift = await loadOpenShift(pb.user?.id).catch(() => null)
    if (shift) {
      shiftBanner.hidden = true
      return
    }
    clear(shiftBanner)
    shiftBanner.hidden = false
    shiftBanner.appendChild(
      h(
        "div",
        { class: "alert alert--info" },
        h("b", {}, "Shift belum dibuka. "),
        "Kasir sebaiknya membuka shift agar kas awal & akhir tercatat. ",
        h(
          "a",
          {
            href: "#/shifts",
            onclick: (event) => {
              event.preventDefault()
              router.navigate("/shifts")
            },
          },
          "Buka shift sekarang →"
        )
      )
    )
  }

  async function loadCategories() {
    const categories = appStore.pick("categories") ?? []
    clear(categoryBar)

    const chip = (label, value) =>
      h(
        "button",
        {
          class: ["chip", activeCategory === value && "is-active"],
          type: "button",
          onclick: () => {
            activeCategory = value
            loadCategories()
            reload()
          },
        },
        label
      )

    categoryBar.append(chip("Semua", ""))
    for (const category of categories) {
      categoryBar.append(chip(category.name, category.id))
    }
  }

  async function reload() {
    controller?.abort()
    controller = new AbortController()

    try {
      products = await searchProducts({
        search: keyword,
        categoryId: activeCategory,
        limit: 150,
      })
      if (controller.signal.aborted) return
      renderGrid()
    } catch (error) {
      if (error.name === "AbortError") return
      console.error("[pos] gagal memuat produk:", error)
    }
  }

  function renderGrid() {
    clear(grid)

    if (!products.length) {
      grid.appendChild(
        h(
          "div",
          { class: "empty" },
          keyword ? `Tidak ada produk cocok dengan "${keyword}".` : "Belum ada produk aktif."
        )
      )
      return
    }

    for (const product of products) {
      const stock = Number(product.stock) || 0
      grid.appendChild(
        h(
          "button",
          {
            class: "pcard",
            type: "button",
            disabled: stock <= 0,
            title: stock <= 0 ? "Stok habis" : `Tambah ${product.name}`,
            onclick: () => cart.add(product, 1),
          },
          h("span", { class: "pcard__name" }, product.name),
          h("span", { class: "pcard__price" }, rupiah(product.price)),
          h(
            "span",
            { class: "pcard__meta" },
            h("span", { class: "mono xsmall" }, product.sku ?? ""),
            h(
              "span",
              {
                class: [
                  "badge",
                  stock <= 0 ? "badge--danger" : stock <= 5 ? "badge--warning" : "badge--success",
                ],
              },
              stock <= 0 ? "Habis" : `Stok ${int(stock)}`
            )
          )
        )
      )
    }
  }

  // ------------------------------------------------------------------- cart
  function renderCart() {
    clear(cartItems)

    const countBadge = outlet.querySelector(".cart__head .badge")
    if (countBadge) countBadge.textContent = `${int(cart.itemCount)} item`

    if (cart.isEmpty) {
      cartItems.appendChild(h("div", { class: "empty small" }, "Keranjang masih kosong."))
    } else {
      for (const item of cart.items) {
        cartItems.appendChild(cartRow(item))
      }
    }

    renderSummary()
    checkoutButton.disabled = cart.isEmpty
    clearButton.disabled = cart.isEmpty
  }

  function renderSummary() {
    const totals = cart.totals(taxOptions())
    clear(cartSummary)
    appendAll(
      cartSummary,
      row("Subtotal", rupiah(totals.subtotal)),
      totals.discount ? row("Diskon", "-" + rupiah(totals.discount)) : null,
      totals.tax ? row(`Pajak (${taxOptions().taxPercent}%)`, rupiah(totals.tax), true) : null,
      h(
        "div",
        { class: "srow srow--total" },
        h("span", {}, "Total"),
        h("span", { class: "srow__value" }, rupiah(totals.total))
      )
    )
  }

  function row(label, value, muted = false) {
    return h(
      "div",
      { class: ["srow", muted && "srow--muted"] },
      h("span", {}, label),
      h("span", { class: "srow__value" }, value)
    )
  }

  function cartRow(item) {
    const quantity = h(
      "div",
      { class: "qty" },
      h(
        "button",
        { type: "button", "aria-label": "Kurangi", onclick: () => cart.increment(item.productId, -1) },
        "−"
      ),
      h("input", {
        type: "number",
        min: "1",
        value: String(item.qty),
        "data-type": "number",
        onchange: (event) => cart.setQty(item.productId, parseNumber(event.target.value)),
      }),
      h(
        "button",
        { type: "button", "aria-label": "Tambah", onclick: () => cart.increment(item.productId, 1) },
        "+"
      )
    )

    return h(
      "div",
      { class: "citem" },
      h("div", { class: "citem__name" }, item.name),
      h("div", { class: "citem__total" }, rupiah(cart.lineTotal(item))),
      h(
        "div",
        { class: "row" },
        quantity,
        h(
          "button",
          {
            class: "btn btn--ghost btn--sm",
            type: "button",
            "aria-label": `Hapus ${item.name}`,
            title: "Hapus item",
            onclick: () => cart.remove(item.productId),
          },
          icon("trash", 16)
        )
      ),
      h("div", { class: "citem__price" }, `${rupiah(item.price)} / ${item.unit ?? "pcs"}`)
    )
  }

  function taxOptions() {
    const settings = effectiveSettings()
    return {
      taxPercent: Number(settings.tax_percent) || 0,
      taxIncluded: Boolean(settings.tax_included),
      roundTo100: Boolean(settings.round_to_100),
      billDiscount: 0,
    }
  }

  // ---------------------------------------------------------------- checkout
  function openCheckout() {
    if (cart.isEmpty) return

    let billDiscount = 0
    let customerId = ""

    const totalsBox = h("div", { class: "cart__summary" })
    const changeBox = h("div", { class: "srow srow--total" })
    const customerSelect = h(
      "select",
      { class: "select", name: "customer" },
      h("option", { value: "" }, "Umum / tanpa member")
    )
    const methodSelect = h(
      "select",
      { class: "select", name: "payment_method" },
      ["cash", "qris", "transfer", "debit", "ewallet"].map((method) =>
        h("option", { value: method, selected: method === "cash" }, paymentLabel(method))
      )
    )
    const paidInput = h("input", {
      class: "input",
      type: "number",
      name: "paid",
      min: "0",
      step: "100",
      value: String(currentTotals().total),
      "data-type": "number",
      oninput: () => refreshTotals(),
    })

    const form = h(
      "form",
      { id: "checkout-form", onsubmit: (event) => submitCheckout(event) },
      h(
        "div",
        { class: "form-grid" },
        h(
          "label",
          { class: "field span-2" },
          h("span", { class: "field__label" }, "Pelanggan"),
          customerSelect
        ),
        h(
          "label",
          { class: "field" },
          h("span", { class: "field__label" }, "Diskon nota (Rp)"),
          h("input", {
            class: "input",
            type: "number",
            name: "discount",
            min: "0",
            step: "100",
            value: "0",
            "data-type": "number",
            oninput: (event) => {
              billDiscount = parseNumber(event.target.value)
              refreshTotals()
            },
          })
        ),
        h(
          "label",
          { class: "field" },
          h("span", { class: "field__label" }, "Metode bayar"),
          methodSelect
        ),
        h(
          "label",
          { class: "field span-2" },
          h("span", { class: "field__label" }, "Jumlah dibayar (Rp)"),
          paidInput
        )
      ),
      totalsBox,
      changeBox,
      h(
        "label",
        { class: "field mt-4" },
        h("span", { class: "field__label" }, "Catatan (opsional)"),
        h("input", { class: "input", name: "note", placeholder: "mis. pesanan meja 4" })
      )
    )

    const submitButton = h(
      "button",
      { class: "btn btn--primary", type: "submit", form: "checkout-form" },
      "Selesaikan Transaksi"
    )

    const modal = openModal({
      title: `Pembayaran · ${int(cart.itemCount)} item`,
      body: form,
      footer: [
        h("button", { class: "btn", type: "button", onclick: () => modal.close() }, "Batal"),
        submitButton,
      ],
    })

    customerSelect.addEventListener("change", () => {
      customerId = customerSelect.value
    })

    loadCustomerOptions()
    refreshTotals()

    function currentTotals() {
      return cart.totals({ ...taxOptions(), billDiscount })
    }

    function refreshTotals() {
      const totals = currentTotals()
      const paid = parseNumber(paidInput.value)

      clear(totalsBox)
      appendAll(
        totalsBox,
        row("Subtotal", rupiah(totals.subtotal)),
        totals.discount ? row("Diskon", "-" + rupiah(totals.discount)) : null,
        totals.tax ? row(`Pajak (${taxOptions().taxPercent}%)`, rupiah(totals.tax), true) : null,
        row("Total", rupiah(totals.total))
      )

      const change = paid - totals.total
      changeBox.replaceChildren(
        h("span", {}, change >= 0 ? "Kembalian" : "Kurang bayar"),
        h(
          "span",
          {
            class: "srow__value",
            style: { color: change >= 0 ? "var(--c-success)" : "var(--c-danger)" },
          },
          rupiah(Math.abs(change))
        )
      )
      submitButton.disabled = paid < totals.total
    }

    async function loadCustomerOptions() {
      try {
        const customers = await searchCustomers("", 200)
        for (const customer of customers) {
          customerSelect.appendChild(
            h(
              "option",
              { value: customer.id },
              `${customer.name}${customer.phone ? " · " + customer.phone : ""}`
            )
          )
        }
      } catch {
        /* daftar pelanggan bersifat opsional */
      }
    }

    async function submitCheckout(event) {
      event.preventDefault()

      const totals = currentTotals()
      const paid = parseNumber(paidInput.value)

      if (paid < totals.total) {
        notify.error("Jumlah bayar kurang dari total.")
        return
      }

      setBusy(submitButton, true, "Menyimpan…")

      try {
        const payload = {
          cashier: pb.user?.id,
          item_count: cart.itemCount,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          paid,
          change: paid - totals.total,
          payment_method: methodSelect.value,
          status: "completed",
          note: form.elements.note.value.trim(),
        }
        if (customerId) payload.customer = customerId
        if (appStore.pick("shift")?.id) payload.shift = appStore.pick("shift").id

        const { sale } = await createSale(payload, cart.toPayload())
        const lines = cart.toReceiptLines()

        // Poin loyalitas: 1 poin per Rp10.000.
        if (customerId) {
          addLoyaltyPoints(customerId, Math.floor(totals.total / 10000)).catch(() => {})
        }

        cart.clear()
        modal.close()
        showReceipt({ ...sale, expand: { cashier: pb.user } }, lines)
        notify.success(`Transaksi ${sale.receipt_no} tersimpan.`)
        reload()
      } catch (error) {
        console.error("[pos] gagal menyimpan transaksi:", error)
      } finally {
        setBusy(submitButton, false)
      }
    }
  }

  /** Tampilkan struk setelah transaksi berhasil. */
  function showReceipt(sale, lines) {
    const settings = effectiveSettings()
    const wrapper = h("div", { html: renderReceipt(sale, lines, settings) })

    const receiptModal = openModal({
      title: "Transaksi Berhasil",
      body: h(
        "div",
        {},
        h(
          "p",
          { class: "row", style: { justifyContent: "center", marginBottom: "1rem" } },
          h("span", { class: "badge badge--success" }, "✓ " + sale.receipt_no),
          h("span", { class: "badge badge--info" }, formatDateTime(sale.sold_at))
        ),
        wrapper
      ),
      footer: [
        h("button", { class: "btn", type: "button", onclick: () => receiptModal.close() }, "Transaksi Baru"),
        h(
          "button",
          {
            class: "btn btn--primary",
            type: "button",
            onclick: () => printReceipt(wrapper.querySelector(".receipt")),
          },
          "Cetak Struk"
        ),
      ],
    })
  }
}

function skeletonCards() {
  return Array.from({ length: 12 }, () =>
    h(
      "div",
      { class: "pcard" },
      h("div", { class: "skeleton", style: { height: "32px" } }),
      h("div", { class: "skeleton", style: { height: "14px", width: "50%" } })
    )
  )
}

export default PosView
