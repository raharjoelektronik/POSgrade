/**
 * views/dashboard.js - ringkasan performa toko (owner & admin).
 */
import { h, render } from "../lib/dom.js"
import { rupiah, int, formatTime, paymentLabel } from "../lib/format.js"
import { skeletonTable, dataTable } from "../components/table.js"
import { dailySummary, loadLowStockProducts, topProducts } from "../services.js"

export function DashboardView({ outlet }) {
  const summaryGrid = h("div", { class: "stat-grid" }, skeletonStats())
  const recentBody = h("section", { class: "card" }, skeletonTable(RECENT_COLUMNS))
  const topBody = h("section", { class: "card" }, skeletonTable(TOP_COLUMNS))
  const lowBody = h("section", { class: "card" }, skeletonTable(LOW_COLUMNS))

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
          h("h2", {}, "Ringkasan Hari Ini"),
          h(
            "p",
            { class: "page-head__meta" },
            new Intl.DateTimeFormat("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())
          )
        ),
        h(
          "div",
          { class: "page-head__actions" },
          h(
            "button",
            { class: "btn btn--primary", type: "button", onclick: () => (location.hash = "#/pos") },
            "Buka Kasir"
          )
        )
      ),
      summaryGrid,
      h("div", { class: "grid-2" }, recentBody, topBody),
      lowBody
    )
  )

  load()

  async function load() {
    try {
      const [summary, top, low] = await Promise.all([
        dailySummary(),
        topProducts({ from: null, to: null, limit: 8 }).catch(() => []),
        loadLowStockProducts().catch(() => []),
      ])

      summaryGrid.replaceChildren(...statCards(summary))

      recentBody.replaceChildren(
        ...cardWithHead(
          "Transaksi Terakhir",
          dataTable({
            columns: RECENT_COLUMNS,
            rows: summary.sales.slice(0, 8),
            empty: "Belum ada transaksi hari ini.",
          })
        )
      )

      topBody.replaceChildren(
        ...cardWithHead(
          "Produk Terlaris (semua waktu)",
          dataTable({
            columns: TOP_COLUMNS,
            rows: top,
            empty: "Belum ada data penjualan.",
          })
        )
      )

      lowBody.replaceChildren(
        ...cardWithHead(
          `Stok Menipis (${low.length})`,
          dataTable({
            columns: LOW_COLUMNS,
            rows: low.slice(0, 10),
            empty: "Semua stok dalam kondisi aman.",
          })
        )
      )
    } catch (error) {
      console.error("[dashboard] gagal memuat:", error)
    }
  }
}

const RECENT_COLUMNS = [
  { key: "receipt_no", label: "No. Struk", render: (row) => h("span", { class: "mono" }, row.receipt_no) },
  { key: "sold_at", label: "Waktu", render: (row) => formatTime(row.sold_at) },
  { key: "payment_method", label: "Bayar", render: (row) => paymentLabel(row.payment_method) },
  { key: "item_count", label: "Item", align: "num", render: (row) => int(row.item_count) },
  { key: "total", label: "Total", align: "num", render: (row) => h("b", {}, rupiah(row.total)) },
]

const TOP_COLUMNS = [
  { key: "name", label: "Produk" },
  { key: "qty", label: "Terjual", align: "num", render: (row) => int(row.qty) },
  { key: "revenue", label: "Omzet", align: "num", render: (row) => rupiah(row.revenue) },
]

const LOW_COLUMNS = [
  { key: "sku", label: "SKU", render: (row) => h("span", { class: "mono xsmall" }, row.sku) },
  { key: "name", label: "Produk" },
  { key: "stock", label: "Stok", align: "num", render: (row) => h("span", { class: "badge badge--danger" }, int(row.stock)) },
  { key: "min_stock", label: "Min", align: "num", render: (row) => int(row.min_stock) },
]

function skeletonStats() {
  return Array.from({ length: 4 }, () =>
    h("div", { class: "stat" }, h("div", { class: "skeleton", style: { height: "14px", width: "60%" } }),
      h("div", { class: "skeleton", style: { height: "24px", marginTop: "8px" } }))
  )
}

function statCards(summary) {
  const topMethod = Object.entries(summary.byMethod).sort((a, b) => b[1] - a[1])[0]

  return [
    stat("Omzet Hari Ini", rupiah(summary.revenue), `${summary.count} transaksi`, "primary"),
    stat("Barang Terjual", int(summary.items), "unit", "success"),
    stat("Rata-rata / Struk", rupiah(summary.average), "nilai transaksi", "warning"),
    stat(
      "Metode Terbanyak",
      topMethod ? paymentLabel(topMethod[0]) : "-",
      topMethod ? rupiah(topMethod[1]) : "belum ada data",
      "danger"
    ),
  ]
}

function stat(label, value, hint, tone) {
  return h(
    "div",
    { class: ["stat", `stat--${tone}`] },
    h("div", { class: "stat__label" }, label),
    h("div", { class: "stat__value" }, value),
    h("div", { class: "stat__hint" }, hint)
  )
}

function cardWithHead(title, content) {
  return [
    h("div", { class: "card__head" }, h("h2", { class: "card__title" }, title)),
    h("div", { class: "card__body card__body--tight" }, content),
  ]
}

export default DashboardView
