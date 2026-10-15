/**
 * views/stock.js - pemantauan & penyesuaian stok (dengan jejak audit).
 */
import { h, render, clear, debounce, setBusy, readForm } from "../lib/dom.js"
import { rupiah, int, formatDateTime } from "../lib/format.js"
import { dataTable, skeletonTable, tableCard } from "../components/table.js"
import { field, numberInput, selectInput, textInput } from "../components/form.js"
import { openModal } from "../lib/modal.js"
import { notify } from "../lib/toast.js"
import { pb, db } from "../api.js"
import { quote } from "../lib/pb.js"
import { adjustStock, loadLowStockProducts, loadStockMoves } from "../services.js"

const MOVE_TYPES = [
  { value: "in", label: "Stok masuk (pembelian)" },
  { value: "out", label: "Stok keluar (rusak/hilang)" },
  { value: "adjustment", label: "Penyesuaian" },
  { value: "opname", label: "Hasil stok opname" },
  { value: "return", label: "Retur dari pelanggan" },
]

export function StockView({ outlet }) {
  const state = { search: "", onlyLow: false, page: 1, totalPages: 1, totalItems: 0 }

  const stats = h("div", { class: "stat-grid" })
  const productHost = h("div", { class: "card__body card__body--tight" }, skeletonTable(PRODUCT_COLUMNS))
  const movesHost = h("div", { class: "card__body card__body--tight" }, skeletonTable(MOVE_COLUMNS))
  const pagination = h("div", { class: "row row--between mt-4" })

  const searchInput = h("input", {
    class: "input",
    type: "search",
    placeholder: "Cari produk…",
    oninput: debounce((event) => {
      state.search = event.target.value.trim()
      state.page = 1
      loadProducts()
    }, 280),
  })

  const lowToggle = h("button", { class: "btn btn--sm", type: "button", onclick: toggleLow }, "Hanya stok menipis")

  render(
    outlet,
    h(
      "div",
      { class: "page" },
      h(
        "div",
        { class: "page-head" },
        h("div", {}, h("h2", {}, "Stok"), h("p", { class: "page-head__meta" }, "Penyesuaian stok dicatat sebagai mutasi sehingga bisa diaudit.")),
        h("div", { class: "page-head__actions" })
      ),
      stats,
      tableCard({
        title: "Stok Produk",
        actions: [
          h("div", { style: { width: "240px" } }, searchInput),
          lowToggle,
          h("button", { class: "btn btn--sm", type: "button", onclick: () => loadAll() }, "⟳"),
        ],
        table: productHost,
      }),
      pagination,
      tableCard({ title: "Mutasi Stok Terakhir", table: movesHost })
    )
  )

  loadAll()

  function toggleLow() {
    state.onlyLow = !state.onlyLow
    state.page = 1
    lowToggle.classList.toggle("btn--primary", state.onlyLow)
    loadProducts()
  }

  async function loadAll() {
    await Promise.all([loadProducts(), loadMoves(), loadStats()])
  }

  async function loadStats() {
    try {
      const [total, low, moves] = await Promise.all([
        db.products.count(""),
        loadLowStockProducts(),
        db.stockMoves.getFullList({ fields: "id,qty", maxItems: 5000 }),
      ])

      clear(stats)
      stats.append(
        tile("Total Produk", int(total), "primary"),
        tile("Stok Menipis", int(low.length), low.length ? "danger" : "success"),
        tile("Total Mutasi Tercatat", int(moves.length), "warning")
      )
    } catch (error) {
      console.error("[stock] gagal memuat statistik:", error)
    }
  }

  async function loadProducts() {
    try {
      const filterParts = []
      if (state.search) filterParts.push(`(name ~ ${quote(state.search)} || sku ~ ${quote(state.search)})`)
      if (state.onlyLow) filterParts.push("stock <= min_stock")

      const result = await db.products.getList(state.page, 25, {
        filter: filterParts.join(" && "),
        sort: "stock",
        expand: "category",
      })

      state.totalPages = result.totalPages || 1
      state.totalItems = result.totalItems || 0

      clear(productHost)
      productHost.appendChild(
        dataTable({
          columns: [
            ...PRODUCT_COLUMNS,
            {
              key: "__actions",
              label: "",
              align: "num",
              render: (row) =>
                pb.can("stock:write")
                  ? h(
                      "button",
                      { class: "btn btn--sm btn--primary", type: "button", onclick: () => openAdjust(row) },
                      "Sesuaikan"
                    )
                  : null,
            },
          ],
          rows: result.items,
          empty: "Tidak ada produk.",
        })
      )

      clear(pagination)
      pagination.append(
        h("span", { class: "small muted" }, `${state.totalItems} produk`),
        h(
          "div",
          { class: "row" },
          h(
            "button",
            { class: "btn btn--sm", type: "button", disabled: state.page <= 1, onclick: () => { state.page -= 1; loadProducts() } },
            "‹ Sebelumnya"
          ),
          h("span", { class: "small nowrap" }, `Hal. ${state.page} / ${state.totalPages}`),
          h(
            "button",
            { class: "btn btn--sm", type: "button", disabled: state.page >= state.totalPages, onclick: () => { state.page += 1; loadProducts() } },
            "Berikutnya ›"
          )
        )
      )
    } catch (error) {
      console.error("[stock] gagal memuat produk:", error)
    }
  }

  async function loadMoves() {
    try {
      const moves = await loadStockMoves({ limit: 50 })
      clear(movesHost)
      movesHost.appendChild(
        dataTable({
          columns: MOVE_COLUMNS,
          rows: moves,
          empty: "Belum ada mutasi stok.",
        })
      )
    } catch (error) {
      console.error("[stock] gagal memuat mutasi:", error)
    }
  }

  // ------------------------------------------------- penyesuaian stok manual
  function openAdjust(product) {
    const before = Number(product.stock) || 0
    const preview = h("div", { class: "srow" })

    const stockInput = numberInput({ name: "stock", value: before, min: 0, step: "any" })
    const typeInput = selectInput({ name: "type", value: "adjustment", options: MOVE_TYPES })
    const noteInput = textInput({ name: "note", placeholder: "mis. hasil stok opname bulanan" })

    const form = h(
      "form",
      { id: "stock-form", onsubmit: (event) => save(event) },
      h(
        "div",
        { class: "card__body--tight" },
        h("p", { class: "small" }, `${product.name} · SKU `, h("span", { class: "mono" }, product.sku)),
        h("p", { class: "small muted" }, `Stok tercatat saat ini: ${int(before)} ${product.unit ?? "pcs"}`)
      ),
      h(
        "div",
        { class: "form-grid" },
        field({ label: "Stok baru", input: stockInput, hint: "Isi jumlah fisik hasil hitung ulang." }),
        field({ label: "Jenis mutasi", input: typeInput }),
        field({ label: "Catatan", className: "span-2", input: noteInput }),
        h("div", { class: "span-2" }, preview)
      )
    )

    const submitButton = h(
      "button",
      { class: "btn btn--primary", type: "submit", form: "stock-form" },
      "Simpan Penyesuaian"
    )

    const modal = openModal({
      title: "Sesuaikan Stok",
      body: form,
      footer: [
        h("button", { class: "btn", type: "button", onclick: () => modal.close() }, "Batal"),
        submitButton,
      ],
    })

    stockInput.addEventListener("input", refreshPreview)
    refreshPreview()

    function refreshPreview() {
      const after = Number(stockInput.value) || 0
      const delta = after - before
      preview.replaceChildren(
        h("span", { class: "muted" }, "Perubahan"),
        h(
          "span",
          {
            class: "srow__value",
            style: { color: delta >= 0 ? "var(--c-success)" : "var(--c-danger)" },
          },
          `${delta >= 0 ? "+" : ""}${int(delta)} ${product.unit ?? "pcs"}`
        )
      )
    }

    async function save(event) {
      event.preventDefault()
      const data = readForm(form)

      setBusy(submitButton, true, "Menyimpan…")
      try {
        const result = await adjustStock(product, data.stock, {
          type: data.type,
          note: data.note,
          userId: pb.user?.id,
        })

        if (result.move) {
          notify.success(`Stok ${product.name} disesuaikan (${result.delta > 0 ? "+" : ""}${result.delta}).`)
        } else {
          notify.info("Tidak ada perubahan stok.")
        }
        modal.close()
        loadAll()
      } catch (error) {
        console.error("[stock] gagal menyesuaikan stok:", error)
      } finally {
        setBusy(submitButton, false)
      }
    }
  }
}

const PRODUCT_COLUMNS = [
  { key: "sku", label: "SKU", render: (row) => h("span", { class: "mono xsmall" }, row.sku) },
  { key: "name", label: "Produk", render: (row) => h("b", {}, row.name) },
  { key: "category", label: "Kategori", render: (row) => row.expand?.category?.name ?? "—" },
  {
    key: "stock",
    label: "Stok",
    align: "num",
    render: (row) => {
      const stock = Number(row.stock) || 0
      const min = Number(row.min_stock) || 0
      const tone = stock <= 0 ? "danger" : stock <= min ? "warning" : "success"
      return h("span", { class: `badge badge--${tone}` }, `${int(stock)} ${row.unit ?? "pcs"}`)
    },
  },
  { key: "min_stock", label: "Min", align: "num", render: (row) => int(row.min_stock) },
  {
    key: "value",
    label: "Nilai Stok",
    align: "num",
    render: (row) => rupiah((Number(row.stock) || 0) * (Number(row.cost) || 0)),
  },
]

const MOVE_COLUMNS = [
  { key: "created", label: "Waktu", render: (row) => formatDateTime(row.created) },
  {
    key: "product",
    label: "Produk",
    render: (row) => row.expand?.product?.name ?? row.product_name ?? "-",
  },
  {
    key: "type",
    label: "Jenis",
    render: (row) => {
      const labels = { in: "Masuk", out: "Keluar", sale: "Penjualan", return: "Retur", adjustment: "Penyesuaian", opname: "Opname" }
      const tone = Number(row.qty) >= 0 ? "success" : "danger"
      return h("span", { class: `badge badge--${tone}` }, labels[row.type] ?? row.type)
    },
  },
  {
    key: "qty",
    label: "Qty",
    align: "num",
    render: (row) => h("b", {}, `${Number(row.qty) > 0 ? "+" : ""}${int(row.qty)}`),
  },
  { key: "stock_after", label: "Stok Akhir", align: "num", render: (row) => int(row.stock_after) },
  {
    key: "user",
    label: "Oleh",
    render: (row) => row.expand?.user?.full_name || row.expand?.user?.email || "sistem",
  },
  { key: "note", label: "Catatan", render: (row) => h("span", { class: "small muted" }, row.note || "-") },
]

function tile(label, value, tone) {
  return h(
    "div",
    { class: ["stat", `stat--${tone}`] },
    h("div", { class: "stat__label" }, label),
    h("div", { class: "stat__value" }, value)
  )
}

export default StockView
