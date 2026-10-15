/**
 * receipt.js - render & cetak struk.
 *
 * Struk dibuat dari string HTML lalu dimasukkan ke modal; CSS `@media print`
 * pada app.css menyembunyikan seluruh UI selain area struk.
 */
import { escapeHtml } from "./dom.js"
import { rupiah, formatDateTime, paymentLabel, int } from "./format.js"

/**
 * @param {object} sale   record `sales` (boleh punya expand.cashier)
 * @param {Array}  lines  hasil Cart.toReceiptLines()
 * @param {object} settings pengaturan toko efektif
 * @returns {string} HTML struk
 */
export function renderReceipt(sale, lines, settings) {
  const rows = lines
    .map(
      (line) => `
      <div class="r-row">
        <span>${escapeHtml(line.name)}</span>
      </div>
      <div class="r-row">
        <span>${int(line.qty)} ${escapeHtml(line.unit ?? "pcs")} x ${rupiah(line.price)}</span>
        <span>${rupiah(line.total)}</span>
      </div>
      ${
        line.discount
          ? `<div class="r-row"><span>Diskon</span><span>-${rupiah(line.discount)}</span></div>`
          : ""
      }`
    )
    .join("")

  const cashierName =
    sale.expand?.cashier?.full_name || sale.expand?.cashier?.email || sale.cashier || "-"

  return `
  <div class="receipt">
    <div class="r-center r-bold">${escapeHtml(settings.store_name ?? "Toko")}</div>
    ${settings.address ? `<div class="r-center">${escapeHtml(settings.address)}</div>` : ""}
    ${settings.phone ? `<div class="r-center">Telp. ${escapeHtml(settings.phone)}</div>` : ""}
    <hr />
    <div class="r-row"><span>No. Struk</span><span>${escapeHtml(sale.receipt_no ?? "-")}</span></div>
    <div class="r-row"><span>Waktu</span><span>${escapeHtml(formatDateTime(sale.sold_at))}</span></div>
    <div class="r-row"><span>Kasir</span><span>${escapeHtml(cashierName)}</span></div>
    <hr />
    ${rows}
    <hr />
    <div class="r-row"><span>Subtotal</span><span>${rupiah(sale.subtotal)}</span></div>
    ${sale.discount ? `<div class="r-row"><span>Diskon</span><span>-${rupiah(sale.discount)}</span></div>` : ""}
    ${sale.tax ? `<div class="r-row"><span>Pajak</span><span>${rupiah(sale.tax)}</span></div>` : ""}
    <div class="r-row r-bold"><span>TOTAL</span><span>${rupiah(sale.total)}</span></div>
    <div class="r-row"><span>${escapeHtml(paymentLabel(sale.payment_method))}</span><span>${rupiah(sale.paid)}</span></div>
    <div class="r-row"><span>Kembali</span><span>${rupiah(sale.change)}</span></div>
    <hr />
    <div class="r-center">${escapeHtml(settings.receipt_footer ?? "")}</div>
  </div>`
}

/** Cetak elemen struk (dipakai untuk printer 58/80mm maupun PDF). */
export function printReceipt(receiptElement) {
  if (!receiptElement) return

  const printWindow = window.open("", "_blank", "width=380,height=640")
  if (!printWindow) return

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join("")

  printWindow.document.write(`<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>Struk</title>${styles}
<style>body{margin:0;padding:8px;background:#fff}</style>
</head><body>${receiptElement.outerHTML}</body></html>`)
  printWindow.document.close()

  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
    setTimeout(() => printWindow.close(), 300)
  }
}

export default printReceipt
