/**
 * modal.js - dialog, konfirmasi, dan form modal berbasis <dialog>-less overlay.
 * Semua modal dirender ke #modal-root agar tidak mengganggu layout halaman.
 */
import { h, render, clear } from "./dom.js"

function getRoot() {
  let root = document.getElementById("modal-root")
  if (!root) {
    root = h("div", { id: "modal-root" })
    document.body.appendChild(root)
  }
  return root
}

/**
 * Buka modal.
 * @param {{ title?:string, body?:Node|string, footer?:Node|Node[]|string,
 *           size?:"md"|"lg", closable?:boolean, onClose?:Function }} options
 * @returns {{ element:HTMLElement, body:HTMLElement, close:Function, setTitle:Function }}
 */
export function openModal(options = {}) {
  const {
    title = "",
    body = "",
    footer = null,
    size = "md",
    closable = true,
    onClose = null,
  } = options

  const bodyEl = h("div", { class: "modal__body" })
  const titleEl = h("h2", { class: "modal__title" }, title)

  const closeButton = h(
    "button",
    {
      class: "modal__close",
      type: "button",
      "aria-label": "Tutup",
      onclick: () => close(),
    },
    "×"
  )

  const modal = h(
    "div",
    {
      class: ["modal", size === "lg" && "modal--lg"],
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title || "Dialog",
    },
    h(
      "div",
      { class: "modal__head" },
      titleEl,
      closable ? closeButton : null
    ),
    bodyEl,
    footer ? h("div", { class: "modal__foot" }, footer) : null
  )

  const backdrop = h("div", { class: "modal-backdrop" }, modal)

  let closed = false

  function onKeydown(event) {
    if (event.key === "Escape" && closable) {
      event.preventDefault()
      close()
    }
  }

  function close() {
    if (closed) return
    closed = true
    document.removeEventListener("keydown", onKeydown)
    backdrop.remove()
    if (typeof onClose === "function") onClose()
  }

  if (closable) {
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) close()
    })
  }

  document.addEventListener("keydown", onKeydown)

  // Isi body setelah elemen terpasang supaya input bisa langsung difokuskan.
  if (body instanceof Node) render(bodyEl, body)
  else bodyEl.innerHTML = String(body ?? "")

  getRoot().appendChild(backdrop)

  const focusable = modal.querySelector(
    "input:not([type=hidden]), select, textarea, button:not(.modal__close)"
  )
  if (focusable) setTimeout(() => focusable.focus(), 30)

  return {
    element: modal,
    body: bodyEl,
    close,
    setTitle: (value) => {
      titleEl.textContent = value
    },
  }
}

/**
 * Dialog konfirmasi.
 * @param {{ title?:string, message:string, confirmText?:string,
 *           cancelText?:string, danger?:boolean }} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options = {}) {
  const {
    title = "Konfirmasi",
    message = "Lanjutkan?",
    confirmText = "Ya, lanjutkan",
    cancelText = "Batal",
    danger = false,
  } = options

  return new Promise((resolve) => {
    let decided = false

    const dialog = openModal({
      title,
      body: h("p", { class: "small" }, message),
      footer: [
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: () => {
              decided = true
              dialog.close()
              resolve(false)
            },
          },
          cancelText
        ),
        h(
          "button",
          {
            class: ["btn", danger ? "btn--danger" : "btn--primary"],
            type: "button",
            onclick: () => {
              decided = true
              dialog.close()
              resolve(true)
            },
          },
          confirmText
        ),
      ],
      onClose: () => {
        if (!decided) resolve(false)
      },
    })
  })
}

/** Modal yang isinya bisa diganti-ulang (mis. hasil cetak struk). */
export function replaceModalBody(modal, ...children) {
  clear(modal.body)
  for (const child of children) {
    if (child === null || child === undefined) continue
    modal.body.appendChild(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return modal.body
}

export default openModal
