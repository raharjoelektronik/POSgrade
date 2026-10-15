/**
 * form.js - pembuat field form yang konsisten.
 * Dipakai oleh semua halaman CRUD agar markup & gaya seragam.
 */
import { h } from "../lib/dom.js"

/** Bungkus input dengan label, hint, dan slot pesan error. */
export function field({ label, input, hint, className = "" }) {
  return h(
    "label",
    { class: ["field", className] },
    label ? h("span", { class: "field__label" }, label) : null,
    input,
    hint ? h("span", { class: "field__hint" }, hint) : null,
    h("span", { class: "field__error" })
  )
}

/** Input teks. */
export function textInput({ name, value = "", type = "text", placeholder = "", ...rest }) {
  return h("input", { class: "input", type, name, value: value ?? "", placeholder, ...rest })
}

/** Input angka (nilai mentah, bukan diformat). */
export function numberInput({ name, value = 0, min, max, step = "any", placeholder = "", ...rest }) {
  return h("input", {
    class: "input",
    type: "number",
    name,
    value: value ?? 0,
    min,
    max,
    step,
    placeholder,
    "data-type": "number",
    ...rest,
  })
}

/** Textarea. */
export function textareaInput({ name, value = "", rows = 3, placeholder = "", ...rest }) {
  return h("textarea", { class: "textarea", name, rows, placeholder, ...rest }, value ?? "")
}

/**
 * Select.
 * @param {{ name:string, value?:string, options:Array<{value:string,label:string}> }} props
 */
export function selectInput({ name, value = "", options = [], placeholder = "", ...rest }) {
  return h(
    "select",
    { class: "select", name, ...rest },
    placeholder ? h("option", { value: "" }, placeholder) : null,
    options.map((option) =>
      h("option", { value: option.value, selected: String(option.value) === String(value) }, option.label)
    )
  )
}

/** Checkbox dengan label inline. */
export function checkboxInput({ name, label, checked = false, ...rest }) {
  return h(
    "label",
    { class: "checkbox" },
    h("input", { type: "checkbox", name, checked: Boolean(checked), ...rest }),
    h("span", {}, label)
  )
}

/** Grid responsif untuk field-field form. */
export function formGrid(...children) {
  return h("div", { class: "form-grid" }, ...children)
}

/** Tombol submit + batal standar untuk modal form. */
export function formActions({ submitLabel = "Simpan", cancelLabel = "Batal", onCancel }) {
  return [
    h("button", { class: "btn", type: "button", onclick: onCancel }, cancelLabel),
    h("button", { class: "btn btn--primary", type: "submit" }, submitLabel),
  ]
}

/**
 * Bantu menampilkan error validasi PocketBase pada field yang tepat.
 * @param {HTMLFormElement} form
 * @param {Record<string,string>} errors
 */
export function showFieldErrors(form, errors) {
  for (const wrapper of form.querySelectorAll(".field__error")) {
    wrapper.textContent = ""
  }
  for (const [name, message] of Object.entries(errors ?? {})) {
    const input = form.elements[name]
    const wrapper = input?.closest(".field")?.querySelector(".field__error")
    if (wrapper) wrapper.textContent = message
  }
}
