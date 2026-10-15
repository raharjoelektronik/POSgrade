/**
 * views/products.js - master data produk (owner & admin).
 */
import { h } from "../lib/dom.js"
import { rupiah, int } from "../lib/format.js"
import { quote } from "../lib/pb.js"
import { db } from "../api.js"
import { loadCategories } from "../services.js"
import { checkboxInput, field, numberInput, selectInput, textInput, textareaInput } from "../components/form.js"
import { createCrudView } from "./crud.js"

export const ProductsView = createCrudView({
  title: "Produk",
  subtitle: "Kelola katalog barang beserta harga dan stok.",
  collection: () => db.products,
  sort: "name",
  expand: "category",
  searchFilter: (term) =>
    `(name ~ ${quote(term)} || sku ~ ${quote(term)} || barcode ~ ${quote(term)})`,
  permissions: { write: "product:write", delete: "manage:all" },
  labelOf: (record) => record.name,

  loadContext: async () => ({ categories: await loadCategories({ force: true }) }),

  columns: [
    { key: "sku", label: "SKU", render: (row) => h("span", { class: "mono xsmall" }, row.sku) },
    {
      key: "name",
      label: "Nama Produk",
      render: (row) =>
        h(
          "div",
          {},
          h("div", { style: { fontWeight: "600" } }, row.name),
          row.barcode ? h("div", { class: "xsmall muted mono" }, row.barcode) : null
        ),
    },
    {
      key: "category",
      label: "Kategori",
      render: (row) =>
        row.expand?.category?.name ?? h("span", { class: "muted" }, "—"),
    },
    { key: "price", label: "Harga Jual", align: "num", render: (row) => h("b", {}, rupiah(row.price)) },
    { key: "cost", label: "Modal", align: "num", render: (row) => rupiah(row.cost) },
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
    {
      key: "active",
      label: "Status",
      render: (row) =>
        h(
          "span",
          { class: ["badge", row.active ? "badge--success" : "badge--danger"] },
          row.active ? "Aktif" : "Nonaktif"
        ),
    },
  ],

  formFields: (record, ctx) => {
    const categories = ctx.categories ?? []
    return [
      field({ label: "SKU / Kode", input: textInput({ name: "sku", value: record?.sku, required: true, placeholder: "KOPI-001" }) }),
      field({ label: "Nama produk", input: textInput({ name: "name", value: record?.name, required: true }) }),
      field({
        label: "Kategori",
        input: selectInput({
          name: "category",
          value: record?.category ?? "",
          placeholder: "— tanpa kategori —",
          options: categories.map((category) => ({ value: category.id, label: category.name })),
        }),
      }),
      field({ label: "Barcode (opsional)", input: textInput({ name: "barcode", value: record?.barcode }) }),
      field({ label: "Harga jual (Rp)", input: numberInput({ name: "price", value: record?.price ?? 0, min: 0, step: 100 }) }),
      field({ label: "Harga modal (Rp)", input: numberInput({ name: "cost", value: record?.cost ?? 0, min: 0, step: 100 }) }),
      field({
        label: "Stok saat ini",
        input: numberInput({ name: "stock", value: record?.stock ?? 0, min: 0, step: "any" }),
        hint: "Perubahan stok di sini TIDAK tercatat sebagai mutasi. Gunakan halaman Stok untuk penyesuaian yang teraudit.",
      }),
      field({ label: "Stok minimum", input: numberInput({ name: "min_stock", value: record?.min_stock ?? 0, min: 0 }) }),
      field({ label: "Satuan", input: textInput({ name: "unit", value: record?.unit ?? "pcs", placeholder: "pcs / kg / botol" }) }),
      field({
        label: "Keterangan",
        className: "span-2",
        input: textareaInput({ name: "description", value: record?.description }),
      }),
      h(
        "div",
        { class: "span-2 row row--wrap" },
        checkboxInput({ name: "taxable", label: "Kena pajak", checked: record?.taxable ?? true }),
        checkboxInput({ name: "active", label: "Aktif dijual", checked: record ? Boolean(record.active) : true })
      ),
    ]
  },

  toPayload: (data) => {
    const payload = {
      sku: String(data.sku ?? "").trim(),
      name: String(data.name ?? "").trim(),
      barcode: String(data.barcode ?? "").trim(),
      price: Math.max(0, Math.round(Number(data.price) || 0)),
      cost: Math.max(0, Math.round(Number(data.cost) || 0)),
      stock: Math.max(0, Number(data.stock) || 0),
      min_stock: Math.max(0, Number(data.min_stock) || 0),
      unit: String(data.unit ?? "pcs").trim() || "pcs",
      description: String(data.description ?? "").trim(),
      taxable: Boolean(data.taxable),
      active: Boolean(data.active),
    }
    // Relasi opsional: kirim "" agar PocketBase mengosongkan relasi.
    payload.category = data.category || ""
    return payload
  },
})

export default ProductsView
