/**
 * table.js - tabel data generik.
 *
 * @example
 *   dataTable({
 *     columns: [
 *       { key: "name", label: "Nama" },
 *       { key: "price", label: "Harga", align: "num", render: (row) => rupiah(row.price) },
 *     ],
 *     rows: products,
 *     empty: "Belum ada produk.",
 *   })
 */
import { h } from "../lib/dom.js"

/**
 * @param {{ columns:Array<{key:string,label:string,align?:string,className?:string,
 *            render?:(row:any)=>any}>, rows:Array<any>, empty?:string,
 *            onRowClick?:(row:any)=>void, rowKey?:(row:any)=>string }} options
 * @returns {HTMLElement}
 */
export function dataTable(options) {
  const { columns, rows = [], empty = "Tidak ada data.", onRowClick = null, rowKey } = options

  const head = h(
    "thead",
    {},
    h(
      "tr",
      {},
      columns.map((column) =>
        h("th", { class: [column.align === "num" && "num", column.className] }, column.label)
      )
    )
  )

  const body = h(
    "tbody",
    {},
    rows.length
      ? rows.map((row, index) =>
          h(
            "tr",
            {
              key: rowKey ? rowKey(row) : index,
              onclick: onRowClick ? () => onRowClick(row) : null,
              style: onRowClick ? { cursor: "pointer" } : null,
            },
            columns.map((column) =>
              h(
                "td",
                { class: [column.align === "num" && "num", column.className] },
                column.render ? column.render(row) : (row[column.key] ?? "-")
              )
            )
          )
        )
      : [
          h(
            "tr",
            {},
            h("td", { colSpan: columns.length, class: "empty" }, empty)
          ),
        ]
  )

  return h("div", { class: "table-wrap" }, h("table", { class: "table" }, head, body))
}

/** Tabel dengan baris skeleton saat data sedang dimuat. */
export function skeletonTable(columns, rows = 5) {
  const head = h(
    "thead",
    {},
    h("tr", {}, columns.map((column) => h("th", {}, column.label)))
  )
  const body = h(
    "tbody",
    {},
    Array.from({ length: rows }, () =>
      h(
        "tr",
        {},
        columns.map(() => h("td", {}, h("div", { class: "skeleton", style: { height: "16px" } })))
      )
    )
  )
  return h("div", { class: "table-wrap" }, h("table", { class: "table" }, head, body))
}

/** Kartu pembungkus tabel dengan judul & aksi opsional. */
export function tableCard({ title, actions = [], table, bodyClass = "" }) {
  return h(
    "section",
    { class: "card" },
    title || actions.length
      ? h(
          "div",
          { class: "card__head" },
          title ? h("h2", { class: "card__title" }, title) : null,
          actions.length ? h("div", { class: "card__actions" }, ...actions) : null
        )
      : null,
    h("div", { class: ["card__body", bodyClass] }, table)
  )
}
