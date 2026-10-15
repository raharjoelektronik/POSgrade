/**
 * dom.js - helper pembuat elemen DOM.
 * Alternatif mini dari hyperscript/JSX, tanpa dependency & tanpa build step.
 *
 * Contoh:
 *   h("button", { class: "btn btn--primary", onclick: save }, "Simpan")
 *   h("div", { class: "row" }, h("span", {}, "Total"), h("b", {}, "Rp10.000"))
 */

/** Atribut HTML yang namanya berbeda dari properti DOM-nya. */
const ATTR_ALIASES = {
  class: "className",
  for: "htmlFor",
  maxlength: "maxLength",
  minlength: "minLength",
  readonly: "readOnly",
  colspan: "colSpan",
  rowspan: "rowSpan",
  tabindex: "tabIndex",
  contenteditable: "contentEditable",
}

/** Properti boolean yang cukup di-set true/false. */
const BOOLEAN_PROPS = new Set([
  "checked",
  "disabled",
  "required",
  "readOnly",
  "multiple",
  "selected",
  "hidden",
  "autofocus",
  "open",
])

function applyProp(node, key, value) {
  if (key === "class" || key === "className") {
    node.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value)
    return
  }
  if (key === "dataset") {
    Object.assign(node.dataset, value)
    return
  }
  if (key === "style" && typeof value === "object") {
    Object.assign(node.style, value)
    return
  }
  if (key === "html") {
    node.innerHTML = String(value)
    return
  }
  if (key === "text") {
    node.textContent = String(value)
    return
  }
  if (key === "ref" && typeof value === "function") {
    value(node)
    return
  }
  if (key.startsWith("on") && typeof value === "function") {
    node.addEventListener(key.slice(2).toLowerCase(), value)
    return
  }

  const prop = ATTR_ALIASES[key] ?? key

  if (BOOLEAN_PROPS.has(prop)) {
    node[prop] = Boolean(value)
    return
  }

  // Gunakan properti DOM bila ada (value, type, name, placeholder, min, ...).
  if (prop in node && typeof node[prop] !== "object") {
    try {
      node[prop] = value
      return
    } catch {
      /* lanjut ke setAttribute */
    }
  }

  node.setAttribute(key, value === true ? "" : String(value))
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue
    if (Array.isArray(child)) {
      appendChildren(node, child)
    } else if (child instanceof Node) {
      node.appendChild(child)
    } else {
      node.appendChild(document.createTextNode(String(child)))
    }
  }
}

/** Buat elemen HTML: h(tag, props?, ...children) */
export function h(tag, props, ...children) {
  const node = document.createElement(tag)
  if (props instanceof Node || typeof props === "string" || typeof props === "number") {
    children.unshift(props)
  } else if (props && typeof props === "object") {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue
      applyProp(node, key, value)
    }
  }
  appendChildren(node, children)
  return node
}

/** DocumentFragment dari beberapa node. */
export function frag(...children) {
  const fragment = document.createDocumentFragment()
  appendChildren(fragment, children)
  return fragment
}

/** querySelector singkat. */
export function qs(selector, root = document) {
  return root.querySelector(selector)
}

/** querySelectorAll sebagai Array. */
export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector))
}

/** Kosongkan isi sebuah node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
  return node
}

/** Ganti seluruh isi node. */
export function render(node, ...children) {
  clear(node)
  appendChildren(node, children)
  return node
}

/**
 * Event delegation: satu listener untuk banyak elemen dinamis.
 * Contoh: on(root, "click", "[data-action='edit']", (event, el) => ...)
 * @returns {() => void} fungsi untuk melepas listener
 */
export function on(root, type, selector, handler) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null
    if (target && root.contains(target)) handler(event, target)
  }
  root.addEventListener(type, listener)
  return () => root.removeEventListener(type, listener)
}

/** Escape untuk dipakai pada innerHTML (mis. cetak struk). */
export function escapeHtml(value) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
  return String(value ?? "").replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Baca <form> menjadi objek biasa.
 * Konversi tipe ditentukan atribut `data-type` pada input:
 *   data-type="number" -> Number, data-type="bool" -> Boolean
 */
export function readForm(form) {
  const data = {}
  for (const field of Array.from(form.elements)) {
    const name = field.name
    if (!name || field.disabled) continue

    if (field.type === "checkbox") {
      data[name] = field.checked
      continue
    }
    if (field.type === "radio") {
      if (field.checked) data[name] = field.value
      continue
    }
    if (field.type === "file") {
      if (field.files?.length) data[name] = field.files[0]
      continue
    }

    const type = field.dataset.type ?? "string"
    const raw = field.value

    if (type === "number") data[name] = raw === "" ? 0 : Number(raw)
    else if (type === "bool") data[name] = raw === "true" || raw === "1"
    else data[name] = raw
  }
  return data
}

/** Debounce sederhana. */
export function debounce(fn, wait = 250) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

/** Set tombol ke mode loading sambil menyimpan label aslinya. */
export function setBusy(button, busy, busyLabel = "Memproses…") {
  if (!button) return
  if (busy) {
    button.dataset.label = button.textContent
    button.textContent = busyLabel
    button.disabled = true
  } else {
    button.textContent = button.dataset.label ?? button.textContent
    button.disabled = false
  }
}
