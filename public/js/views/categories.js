/**
 * views/categories.js - master data kategori (owner & admin).
 */
import { h } from "../lib/dom.js"
import { int } from "../lib/format.js"
import { quote } from "../lib/pb.js"
import { db } from "../api.js"
import { checkboxInput, field, numberInput, textInput, textareaInput } from "../components/form.js"
import { createCrudView } from "./crud.js"

export const CategoriesView = createCrudView({
  title: "Kategori",
  subtitle: "Kelompokkan produk agar pencarian di kasir lebih cepat.",
  collection: () => db.categories,
  sort: "sort_order,name",
  searchFilter: (term) => `(name ~ ${quote(term)} || description ~ ${quote(term)})`,
  permissions: { write: "category:write", delete: "manage:all" },
  labelOf: (record) => record.name,

  columns: [
    { key: "name", label: "Nama Kategori", render: (row) => h("b", {}, row.name) },
    {
      key: "description",
      label: "Keterangan",
      render: (row) => row.description || h("span", { class: "muted" }, "—"),
    },
    { key: "sort_order", label: "Urutan", align: "num", render: (row) => int(row.sort_order) },
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

  formFields: (record) => [
    field({ label: "Nama kategori", input: textInput({ name: "name", value: record?.name, required: true }) }),
    field({
      label: "Urutan tampil",
      input: numberInput({ name: "sort_order", value: record?.sort_order ?? 0, min: 0, step: 1 }),
      hint: "Angka lebih kecil tampil lebih dulu.",
    }),
    field({
      label: "Keterangan",
      className: "span-2",
      input: textareaInput({ name: "description", value: record?.description }),
    }),
    h(
      "div",
      { class: "span-2" },
      checkboxInput({ name: "active", label: "Aktif", checked: record ? Boolean(record.active) : true })
    ),
  ],

  toPayload: (data) => ({
    name: String(data.name ?? "").trim(),
    description: String(data.description ?? "").trim(),
    sort_order: Math.max(0, Math.round(Number(data.sort_order) || 0)),
    active: Boolean(data.active),
  }),
})

export default CategoriesView
