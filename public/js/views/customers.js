/**
 * views/customers.js - master data pelanggan / member.
 */
import { h } from "../lib/dom.js"
import { int } from "../lib/format.js"
import { quote } from "../lib/pb.js"
import { db } from "../api.js"
import { checkboxInput, field, numberInput, textInput, textareaInput } from "../components/form.js"
import { createCrudView } from "./crud.js"

export const CustomersView = createCrudView({
  title: "Pelanggan",
  subtitle: "Data member, nomor telepon, dan poin loyalitas.",
  collection: () => db.customers,
  sort: "name",
  searchFilter: (term) => `(name ~ ${quote(term)} || phone ~ ${quote(term)} || email ~ ${quote(term)})`,
  permissions: { write: "customer:write", delete: "manage:all" },
  labelOf: (record) => record.name,

  columns: [
    { key: "name", label: "Nama", render: (row) => h("b", {}, row.name) },
    { key: "phone", label: "Telepon", render: (row) => row.phone || h("span", { class: "muted" }, "—") },
    { key: "email", label: "Email", render: (row) => row.email || h("span", { class: "muted" }, "—") },
    {
      key: "points",
      label: "Poin",
      align: "num",
      render: (row) => h("span", { class: "badge badge--info" }, int(row.points)),
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

  formFields: (record) => [
    field({ label: "Nama pelanggan", input: textInput({ name: "name", value: record?.name, required: true }) }),
    field({ label: "No. telepon", input: textInput({ name: "phone", value: record?.phone, placeholder: "08xx" }) }),
    field({ label: "Email", input: textInput({ name: "email", type: "email", value: record?.email }) }),
    field({
      label: "Poin loyalitas",
      input: numberInput({ name: "points", value: record?.points ?? 0, min: 0, step: 1 }),
      hint: "Otomatis bertambah 1 poin setiap Rp10.000 belanja.",
    }),
    field({
      label: "Alamat",
      className: "span-2",
      input: textareaInput({ name: "address", value: record?.address }),
    }),
    field({ label: "Catatan", className: "span-2", input: textInput({ name: "notes", value: record?.notes }) }),
    h(
      "div",
      { class: "span-2" },
      checkboxInput({ name: "active", label: "Aktif", checked: record ? Boolean(record.active) : true })
    ),
  ],

  toPayload: (data) => ({
    name: String(data.name ?? "").trim(),
    phone: String(data.phone ?? "").trim(),
    email: String(data.email ?? "").trim(),
    address: String(data.address ?? "").trim(),
    notes: String(data.notes ?? "").trim(),
    points: Math.max(0, Math.round(Number(data.points) || 0)),
    active: Boolean(data.active),
  }),
})

export default CustomersView
