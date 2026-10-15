/**
 * views/shifts.js - buka/tutup shift kasir + riwayat.
 */
import { h, render, clear, setBusy, readForm } from "../lib/dom.js"
import { rupiah, int, formatDateTime } from "../lib/format.js"
import { dataTable, skeletonTable, tableCard } from "../components/table.js"
import { field, numberInput, textInput } from "../components/form.js"
import { notify } from "../lib/toast.js"
import { pb, db } from "../api.js"
import { appStore } from "../lib/store.js"
import { closeShift, loadOpenShift, openShift, shiftSalesTotals } from "../services.js"

export function ShiftsView({ outlet }) {
  const currentCard = h("div", { class: "card" }, h("div", { class: "card__body" }, h("div", { class: "skeleton", style: { height: "120px" } })))
  const historyHost = h("div", { class: "card__body card__body--tight" }, skeletonTable(HISTORY_COLUMNS))

  render(
    outlet,
    h(
      "div",
      { class: "page" },
      h(
        "div",
        { class: "page-head" },
        h("div", {}, h("h2", {}, "Shift Kasir"), h("p", { class: "page-head__meta" }, "Catat kas awal & akhir supaya selisih kas mudah ditelusuri.")),
        h("div", { class: "page-head__actions" })
      ),
      currentCard,
      tableCard({ title: "Riwayat Shift", table: historyHost })
    )
  )

  load()

  async function load() {
    await Promise.all([loadCurrent(), loadHistory()])
  }

  async function loadCurrent() {
    const shift = await loadOpenShift(pb.user?.id).catch(() => null)
    clear(currentCard)

    if (!shift) {
      currentCard.appendChild(openForm())
      return
    }

    const totals = await shiftSalesTotals(shift.id).catch(() => ({ cash: 0, nonCash: 0, count: 0 }))
    currentCard.appendChild(activeForm(shift, totals))
  }

  function openForm() {
    const cashInput = numberInput({ name: "opening_cash", value: 0, min: 0, step: 1000 })
    const noteInput = textInput({ name: "note", placeholder: "mis. kas dari brankas" })

    const form = h(
      "form",
      { onsubmit: submit },
      h("div", { class: "card__head" }, h("h3", { class: "card__title" }, "Buka Shift Baru")),
      h(
        "div",
        { class: "card__body" },
        h("p", { class: "small muted" }, "Belum ada shift terbuka untuk akun Anda."),
        h(
          "div",
          { class: "form-grid mt-4" },
          field({ label: "Kas awal (Rp)", input: cashInput }),
          field({ label: "Catatan", input: noteInput })
        ),
        h(
          "div",
          { class: "mt-4" },
          h("button", { class: "btn btn--primary", type: "submit" }, "Buka Shift")
        )
      )
    )

    return form

    async function submit(event) {
      event.preventDefault()
      const data = readForm(form)
      const button = form.querySelector("button[type=submit]")
      setBusy(button, true, "Membuka…")
      try {
        await openShift(pb.user.id, data.opening_cash, data.note)
        notify.success("Shift dibuka. Selamat bekerja!")
        load()
      } catch (error) {
        console.error("[shifts] gagal membuka shift:", error)
      } finally {
        setBusy(button, false)
      }
    }
  }

  function activeForm(shift, totals) {
    const expected = (Number(shift.opening_cash) || 0) + totals.cash
    const closeInput = numberInput({ name: "closing_cash", value: expected, min: 0, step: 1000 })
    const noteInput = textInput({ name: "note", placeholder: "catatan penutupan (opsional)" })
    const diffBox = h("div", { class: "srow" })

    const form = h(
      "form",
      { onsubmit: submit },
      h(
        "div",
        { class: "card__head" },
        h("h3", { class: "card__title" }, "Shift Sedang Berjalan"),
        h("span", { class: "badge badge--success" }, "Dibuka " + formatDateTime(shift.opened_at))
      ),
      h(
        "div",
        { class: "card__body" },
        h(
          "div",
          { class: "stat-grid" },
          tile("Kas Awal", rupiah(shift.opening_cash), "primary"),
          tile("Penjualan Tunai", rupiah(totals.cash), "success"),
          tile("Non-Tunai", rupiah(totals.nonCash), "warning"),
          tile("Kas Seharusnya", rupiah(expected), "danger")
        ),
        h(
          "div",
          { class: "form-grid mt-4" },
          field({ label: "Kas akhir dihitung (Rp)", input: closeInput }),
          field({ label: "Catatan", input: noteInput }),
          h("div", { class: "span-2" }, diffBox)
        ),
        h(
          "div",
          { class: "mt-4 row" },
          h("button", { class: "btn btn--danger", type: "submit" }, "Tutup Shift"),
          h("span", { class: "small muted" }, `${int(totals.count)} transaksi pada shift ini`)
        )
      )
    )

    closeInput.addEventListener("input", refreshDiff)
    refreshDiff()

    function refreshDiff() {
      const actual = Number(closeInput.value) || 0
      const difference = actual - expected
      diffBox.replaceChildren(
        h("span", { class: "muted" }, "Selisih kas"),
        h(
          "span",
          {
            class: "srow__value",
            style: { color: difference === 0 ? "var(--c-success)" : "var(--c-danger)" },
          },
          (difference > 0 ? "+" : "") + rupiah(difference)
        )
      )
    }

    return form

    async function submit(event) {
      event.preventDefault()
      const data = readForm(form)
      const button = form.querySelector("button[type=submit]")
      setBusy(button, true, "Menutup…")
      try {
        const closed = await closeShift(shift, data.closing_cash, data.note)
        const difference = Number(closed.difference) || 0
        if (difference === 0) notify.success("Shift ditutup. Kas sesuai.")
        else notify.warning(`Shift ditutup dengan selisih ${rupiah(difference)}.`)
        appStore.set({ shift: null })
        load()
      } catch (error) {
        console.error("[shifts] gagal menutup shift:", error)
      } finally {
        setBusy(button, false)
      }
    }
  }

  async function loadHistory() {
    try {
      const shifts = await db.shifts.getFullList({ sort: "-opened_at", expand: "cashier", maxItems: 100 })
      clear(historyHost)
      historyHost.appendChild(
        dataTable({ columns: HISTORY_COLUMNS, rows: shifts, empty: "Belum ada riwayat shift." })
      )
    } catch (error) {
      console.error("[shifts] gagal memuat riwayat:", error)
    }
  }
}

const HISTORY_COLUMNS = [
  {
    key: "cashier",
    label: "Kasir",
    render: (row) => row.expand?.cashier?.full_name || row.expand?.cashier?.email || "-",
  },
  { key: "opened_at", label: "Dibuka", render: (row) => formatDateTime(row.opened_at) },
  { key: "closed_at", label: "Ditutup", render: (row) => (row.closed_at ? formatDateTime(row.closed_at) : h("span", { class: "badge badge--success" }, "Berjalan")) },
  { key: "opening_cash", label: "Kas Awal", align: "num", render: (row) => rupiah(row.opening_cash) },
  { key: "cash_sales", label: "Tunai", align: "num", render: (row) => rupiah(row.cash_sales) },
  { key: "non_cash_sales", label: "Non-Tunai", align: "num", render: (row) => rupiah(row.non_cash_sales) },
  { key: "expected_cash", label: "Seharusnya", align: "num", render: (row) => rupiah(row.expected_cash) },
  { key: "closing_cash", label: "Aktual", align: "num", render: (row) => rupiah(row.closing_cash) },
  {
    key: "difference",
    label: "Selisih",
    align: "num",
    render: (row) => {
      const difference = Number(row.difference) || 0
      if (!row.closed_at) return h("span", { class: "muted" }, "—")
      const tone = difference === 0 ? "success" : "danger"
      return h("span", { class: `badge badge--${tone}` }, rupiah(difference))
    },
  },
]

function tile(label, value, tone) {
  return h(
    "div",
    { class: ["stat", `stat--${tone}`] },
    h("div", { class: "stat__label" }, label),
    h("div", { class: "stat__value" }, value)
  )
}

export default ShiftsView
