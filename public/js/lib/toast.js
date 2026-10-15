/**
 * toast.js - notifikasi ringan (non-blocking).
 */

const DEFAULT_TIMEOUT = 3500
const ICONS = {
  info: "ℹ",
  success: "✓",
  error: "✕",
  warning: "⚠",
}

/**
 * @param {string} message
 * @param {"info"|"success"|"error"|"warning"} [type]
 * @param {number} [timeout] ms; 0 = tidak auto-close
 */
export function toast(message, type = "info", timeout = DEFAULT_TIMEOUT) {
  const root = document.getElementById("toasts")
  if (!root) return () => {}

  const element = document.createElement("div")
  element.className = `toast toast--${type}`
  element.setAttribute("role", type === "error" ? "alert" : "status")

  const icon = document.createElement("span")
  icon.textContent = ICONS[type] ?? ICONS.info
  icon.setAttribute("aria-hidden", "true")

  const text = document.createElement("span")
  text.className = "grow"
  text.textContent = String(message)

  const close = document.createElement("button")
  close.className = "modal__close"
  close.type = "button"
  close.textContent = "×"
  close.setAttribute("aria-label", "Tutup notifikasi")

  element.append(icon, text, close)
  root.appendChild(element)

  let timer
  const dismiss = () => {
    clearTimeout(timer)
    element.remove()
  }

  close.addEventListener("click", dismiss)
  if (timeout > 0) timer = setTimeout(dismiss, timeout)

  return dismiss
}

export const notify = {
  info: (message) => toast(message, "info"),
  success: (message) => toast(message, "success"),
  error: (message) => toast(message, "error", 6000),
  warning: (message) => toast(message, "warning", 5000),
}

export default notify
