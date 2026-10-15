/**
 * views/sales.js - riwayat transaksi + detail struk + void.
 */
import { h, render, clear, debounce } from "../lib/dom.js"
import {
  rupiah,
  int,
  formatDateTime,
  paymentLabel,
  statusLabel,
  todayRange,
  lastDaysRange,
} from "../lib/format.js"
import { dataTable, skeletonTable, tableCard } from "../components/table.js"
import { openModal, confirmDialog } from "../lib/modal.js"
import { notify } from "../lib/toast.js"
import { pb, db } from "../api.js"
import { buildFilter, quote } from "../lib/pb.js"
import { effectiveSettings } from "../lib/store.js"
import { loadSaleDetail, voidSale } from "../services.js"
import { printReceipt, renderReceipt } from "../lib/receipt.js"

const PER_PAGE = 25

const RANGES = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "30d", label: "30 hari terakhir" },
  { value: "all", label: "Semua" },
]

/**
 * Filter rentang tanggal untuk riwayat transaksi.
 *
 * Memakai helper yang sama dengan Dashboard (`todayRange` / `lastDaysRange`)
 * agar rentang "Hari ini" berarti 00:00–23:59, bukan "sampai detik ini".
 * Sebelumnya dua tempat ini punya logika sendiri-sendiri dan hasilnya berbeda.
 */
function rangeFilter(range) {
  if (range === "all") return ""

  const { start, end } = range === "today" ? todayRange() : lastDaysRange(range === "7d" ? 7 : 30)
  return `sold_at >= ${quote(start)} && sold_at <= ${quote(end)}`
}

export function SalesView({ outlet }) {
  const state = { page: 1, totalPages: 1, totalItems: 0, range: "today", search: "" }

  const tableHost = h("div", { class: "card__body card__body--tight" }, skeletonTable(COLUMNS))
  const pagination = h("div", { class: "row row--between mt-4" })
  const summaryBar = h("div", { class: "stat-grid" })

  const rangeSelect = h(
    "select",
    {
      class: "select",
      onchange: (event) => {
        state.range = event.target.value
        state.page = 1
        reload()
      },
    },
    RANGES.map((range) => h("option", { value: range.value }, range.label))
  )

  const searchInput = h("input", {
    class: "input",
    type: "search",
    placeholder: "Cari no. struk…",
    oninput: debounce((event) => {
      state.search = event.target.value.trim()
      state.page = 1
      reload()
    }, 280),
  })

  render(
    outlet,
    h(
      "div",
      { class: "page" },
      h(
        "div",
        { class: "page-head" },
        h("div", {}, h("h2", {}, "Riwayat Transaksi"), h("p", { class: "page-head__meta" }, "Semua struk yang tersimpan di PocketBase.")),
        h("div", { class: "page-head__actions" })
      ),
      summaryBar,
      tableCard({
        title: "Daftar Struk",
        actions: [
          h("div", { style: { width: "170px" } }, rangeSelect),
          h("div", { style: { width: "220px" } }, searchInput),
          h("button", { class: "btn btn--sm", type: "button", onclick: () => reload() }, "⟳"),
        ],
        table: tableHost,
      }),
      pagination
    )
  )

  reload()

  async function reload() {
    try {
      const filter = buildFilter(
        rangeFilter(state.range),
        state.search ? `receipt_no ~ ${quote(state.search)}` : ""
      )

      const result = await db.sales.getList(state.page, PER_PAGE, {
        filter,
        sort: "-sold_at",
        expand: "cashier,customer",
      })

      state.totalPages = result.totalPages || 1
      state.totalItems = result.totalItems || 0

      const revenue = result.items.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)

      clear(summaryBar)
      summaryBar.append(
        statTile("Transaksi (halaman ini)", int(result.items.length), "success"),
        statTile("Omzet (halaman ini)", rupiah(revenue), "primary"),
        statTile("Total struk tersimpan", int(state.totalItems), "warning"),
        statTile("Rata-rata / struk", rupiah(result.items.length ? revenue / result.items.length : 0), "danger")
      )

      clear(tableHost)
      tableHost.appendChild(
        dataTable({
          columns: [
            ...COLUMNS,
            {
              key: "__actions",
              label: "",
              align: "num",
              render: (row) =>
                h(
                  "button",
                  { class: "btn btn--sm", type: "button", onclick: () => showDetail(row.id) },
                  "Detail"
                ),
            },
          ],
          rows: result.items,
          empty: "Tidak ada transaksi pada rentang ini.",
        })
      )

      renderPagination()
    } catch (error) {
      console.error("[sales] gagal memuat riwayat:", error)
    }
  }

  function renderPagination() {
    clear(pagination)
    const from = state.totalItems === 0 ? 0 : (state.page - 1) * PER_PAGE + 1
    const to = Math.min(state.page * PER_PAGE, state.totalItems)

    pagination.append(
      h("span", { class: "small muted" }, `Menampilkan ${from}–${to} dari ${state.totalItems} struk`),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "btn btn--sm",
            type: "button",
            disabled: state.page <= 1,
            onclick: () => {
              state.page -= 1
              reload()
            },
          },
          "‹ Sebelumnya"
        ),
        h("span", { class: "small nowrap" }, `Hal. ${state.page} / ${state.totalPages}`),
        h(
          "button",
          {
            class: "btn btn--sm",
            type: "button",
            disabled: state.page >= state.totalPages,
            onclick: () => {
              state.page += 1
              reload()
            },
          },
          "Berikutnya ›"
        )
      )
    )
  }

  // ------------------------------------------------------------ detail struk
  async function showDetail(saleId) {
    const body = h("div", {}, h("div", { class: "skeleton", style: { height: "200px" } }))
    const footerHost = h("div", { class: "row" })

    const modal = openModal({
      title: "Detail Transaksi",
      size: "lg",
      body,
      footer: footerHost,
    })

    try {
      const { sale, items } = await loadSaleDetail(saleId)

      const lines = items.map((item) => ({
        name: item.product_name,
        qty: item.qty,
        unit: "pcs",
        price: item.price,
        discount: item.discount,
        total: item.subtotal,
      }))

      const itemsTable = dataTable({
        columns: [
          { key: "product_name", label: "Produk" },
          { key: "sku", label: "SKU", render: (row) => h("span", { class: "mono xsmall" }, row.sku) },
          { key: "price", label: "Harga", align: "num", render: (row) => rupiah(row.price) },
          { key: "qty", label: "Qty", align: "num", render: (row) => int(row.qty) },
          { key: "discount", label: "Diskon", align: "num", render: (row) => rupiah(row.discount) },
          { key: "subtotal", label: "Subtotal", align: "num", render: (row) => h("b", {}, rupiah(row.subtotal)) },
        ],
        rows: items,
        empty: "Tidak ada item.",
      })

      const infoRows = [
        ["No. Struk", sale.receipt_no],
        ["Waktu", formatDateTime(sale.sold_at)],
        ["Kasir", sale.expand?.cashier?.full_name || sale.expand?.cashier?.email || "-"],
        ["Pelanggan", sale.expand?.customer?.name || "Umum"],
        ["Metode", paymentLabel(sale.payment_method)],
        ["Status", statusLabel(sale.status)],
        ["Total", rupiah(sale.total)],
        ["Dibayar", rupiah(sale.paid)],
        ["Kembali", rupiah(sale.change)],
      ]

      clear(body)
      body.append(
        h(
          "div",
          { class: "grid-2" },
          h(
            "div",
            { class: "card" },
            h("div", { class: "card__head" }, h("h3", { class: "card__title" }, "Informasi")),
            h(
              "div",
              { class: "card__body" },
              infoRows.map(([label, value]) =>
                h(
                  "div",
                  { class: "srow" },
                  h("span", { class: "muted" }, label),
                  h("span", { class: "srow__value" }, String(value ?? "-"))
                )
              ),
              sale.note ? h("p", { class: "small muted mt-4" }, "Catatan: " + sale.note) : null
            )
          ),
          h(
            "div",
            { class: "card" },
            h("div", { class: "card__head" }, h("h3", { class: "card__title" }, "Struk")),
            h("div", { class: "card__body" }, h("div", { html: renderReceipt(sale, lines, effectiveSettings()) }))
          )
        ),
        h("div", { class: "card mt-4" }, h("div", { class: "card__body card__body--tight" }, itemsTable))
      )

      const receiptEl = body.querySelector(".receipt")

      clear(footerHost)
      footerHost.append(
        h("button", { class: "btn", type: "button", onclick: () => modal.close() }, "Tutup"),
        pb.can("sale:void") && sale.status === "completed"
          ? h(
              "button",
              { class: "btn btn--danger", type: "button", onclick: () => doVoid(sale) },
              "Batalkan (Void)"
            )
          : null,
        h(
          "button",
          { class: "btn btn--primary", type: "button", onclick: () => printReceipt(receiptEl) },
          "Cetak Ulang"
        )
      )
    } catch (error) {
      clear(body)
      body.appendChild(h("div", { class: "alert" }, "Gagal memuat detail: " + error.message))
    }

    async function doVoid(sale) {
      const confirmed = await confirmDialog({
        title: "Batalkan Transaksi",
        message: `Struk ${sale.receipt_no} akan dibatalkan dan stok produk dikembalikan. Lanjutkan?`,
        confirmText: "Ya, batalkan",
        danger: true,
      })
      if (!confirmed) return

      try {
        await voidSale(sale.id, "Dibatalkan dari halaman riwayat")
        notify.success("Transaksi dibatalkan & stok dikembalikan.")
        modal.close()
        reload()
      } catch (error) {
        console.error("[sales] gagal void:", error)
      }
    }
  }
}

const COLUMNS = [
  {
    key: "receipt_no",
    label: "No. Struk",
    render: (row) => h("span", { class: "mono small" }, row.receipt_no),
  },
  { key: "sold_at", label: "Waktu", render: (row) => formatDateTime(row.sold_at) },
  {
    key: "cashier",
    label: "Kasir",
    render: (row) => row.expand?.cashier?.full_name || row.expand?.cashier?.email || "-",
  },
  {
    key: "customer",
    label: "Pelanggan",
    render: (row) => row.expand?.customer?.name || h("span", { class: "muted" }, "Umum"),
  },
  { key: "item_count", label: "Item", align: "num", render: (row) => int(row.item_count) },
  { key: "total", label: "Total", align: "num", render: (row) => h("b", {}, rupiah(row.total)) },
  { key: "payment_method", label: "Metode", render: (row) => paymentLabel(row.payment_method) },
  {
    key: "status",
    label: "Status",
    render: (row) => {
      const tone = row.status === "completed" ? "success" : row.status === "void" ? "danger" : "warning"
      return h("span", { class: `badge badge--${tone}` }, statusLabel(row.status))
    },
  },
]

function statTile(label, value, tone) {
  return h(
    "div",
    { class: ["stat", `stat--${tone}`] },
    h("div", { class: "stat__label" }, label),
    h("div", { class: "stat__value" }, value)
  )
}

export default SalesView
