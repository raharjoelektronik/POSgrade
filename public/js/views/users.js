/**
 * views/users.js - kelola akun pengguna & perannya (khusus owner).
 */
import { h, render, clear, readForm, setBusy } from "../lib/dom.js"
import { formatDateTime, roleLabel } from "../lib/format.js"
import { dataTable, skeletonTable, tableCard } from "../components/table.js"
import { checkboxInput, field, selectInput, showFieldErrors, textInput } from "../components/form.js"
import { openModal, confirmDialog } from "../lib/modal.js"
import { notify } from "../lib/toast.js"
import { pb, db } from "../api.js"

const ROLES = [
  { value: "owner", label: "Pemilik (akses penuh)" },
  { value: "admin", label: "Admin (kelola master data)" },
  { value: "cashier", label: "Kasir (transaksi saja)" },
]

const COLUMNS = [
  {
    key: "full_name",
    label: "Nama",
    render: (row) => h("b", {}, row.full_name || h("span", { class: "muted" }, "(belum diisi)")),
  },
  { key: "email", label: "Email", render: (row) => h("span", { class: "small" }, row.email) },
  { key: "phone", label: "Telepon", render: (row) => row.phone || h("span", { class: "muted" }, "—") },
  {
    key: "role",
    label: "Peran",
    render: (row) => {
      const tone = row.role === "owner" ? "danger" : row.role === "admin" ? "warning" : "info"
      return h("span", { class: `badge badge--${tone}` }, roleLabel(row.role))
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
  {
    key: "created",
    label: "Dibuat",
    render: (row) => h("span", { class: "small muted" }, formatDateTime(row.created)),
  },
]

export function UsersView({ outlet }) {
  const tableHost = h("div", { class: "card__body card__body--tight" }, skeletonTable(COLUMNS))

  render(
    outlet,
    h(
      "div",
      { class: "page" },
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          {},
          h("h2", {}, "Pengguna"),
          h(
            "p",
            { class: "page-head__meta" },
            "Akun dibuat di sini agar peran (owner/admin/kasir) langsung terpasang."
          )
        ),
        h(
          "div",
          { class: "page-head__actions" },
          h(
            "button",
            { class: "btn btn--primary", type: "button", onclick: () => openForm(null) },
            "+ Tambah Pengguna"
          ),
          h(
            "a",
            { class: "btn", href: "/pb/_/", target: "_blank", rel: "noopener" },
            "Buka Dashboard PocketBase"
          )
        )
      ),
      tableCard({ title: "Daftar Pengguna", table: tableHost })
    )
  )

  reload()

  async function reload() {
    try {
      const users = await db.users.getFullList({ sort: "full_name,email", maxItems: 500 })
      clear(tableHost)
      tableHost.appendChild(
        dataTable({
          columns: [
            ...COLUMNS,
            {
              key: "__actions",
              label: "",
              align: "num",
              render: (row) =>
                h(
                  "div",
                  { class: "table__actions" },
                  h("button", { class: "btn btn--sm", type: "button", onclick: () => openForm(row) }, "Ubah"),
                  row.id === pb.user?.id
                    ? null
                    : h(
                        "button",
                        {
                          class: "btn btn--sm btn--danger",
                          type: "button",
                          onclick: () => removeUser(row),
                        },
                        "Hapus"
                      )
                ),
            },
          ],
          rows: users,
          empty: "Belum ada pengguna.",
        })
      )
    } catch (error) {
      console.error("[users] gagal memuat pengguna:", error)
    }
  }

  function openForm(record) {
    const isEdit = Boolean(record)

    const form = h(
      "form",
      { id: "user-form", onsubmit: (event) => save(event, record) },
      h(
        "div",
        { class: "form-grid" },
        field({ label: "Nama lengkap", input: textInput({ name: "full_name", value: record?.full_name }) }),
        field({
          label: "Email (untuk login)",
          input: textInput({ name: "email", type: "email", value: record?.email, required: true }),
        }),
        field({ label: "No. telepon", input: textInput({ name: "phone", value: record?.phone }) }),
        field({
          label: "Peran",
          input: selectInput({ name: "role", value: record?.role ?? "cashier", options: ROLES }),
        }),
        field({
          label: isEdit ? "Kata sandi baru (opsional)" : "Kata sandi",
          input: h("input", {
            class: "input",
            type: "password",
            name: "password",
            autocomplete: "new-password",
            required: !isEdit,
            minlength: 8,
          }),
          hint: "Minimal 8 karakter.",
        }),
        field({
          label: "Ulangi kata sandi",
          input: h("input", {
            class: "input",
            type: "password",
            name: "passwordConfirm",
            autocomplete: "new-password",
            required: !isEdit,
            minlength: 8,
          }),
        }),
        h(
          "div",
          { class: "span-2 row row--wrap" },
          checkboxInput({ name: "active", label: "Aktif", checked: record ? Boolean(record.active) : true }),
          checkboxInput({ name: "verified", label: "Email terverifikasi", checked: true }),
          checkboxInput({
            name: "emailVisibility",
            label: "Tampilkan email ke pengguna lain",
            checked: record ? Boolean(record.emailVisibility) : true,
            title:
              "PocketBase menyembunyikan field email pada koleksi auth bila opsi ini mati, " +
              "sehingga daftar pengguna dan kolom kasir di riwayat transaksi menjadi kosong.",
          })
        )
      )
    )

    const submitButton = h(
      "button",
      { class: "btn btn--primary", type: "submit", form: "user-form" },
      isEdit ? "Simpan Perubahan" : "Buat Akun"
    )

    const modal = openModal({
      title: isEdit ? `Ubah Pengguna · ${record.email}` : "Tambah Pengguna",
      body: form,
      footer: [
        h("button", { class: "btn", type: "button", onclick: () => modal.close() }, "Batal"),
        submitButton,
      ],
    })

    async function save(event, current) {
      event.preventDefault()
      const data = readForm(form)

      if (data.password && data.password !== data.passwordConfirm) {
        showFieldErrors(form, { passwordConfirm: "Konfirmasi kata sandi tidak sama." })
        return
      }

      const payload = {
        full_name: String(data.full_name ?? "").trim(),
        phone: String(data.phone ?? "").trim(),
        role: data.role,
        active: Boolean(data.active),
        verified: Boolean(data.verified),
        emailVisibility: Boolean(data.emailVisibility),
      }

      if (data.password) {
        payload.password = data.password
        payload.passwordConfirm = data.passwordConfirm
      }

      setBusy(submitButton, true, "Menyimpan…")

      try {
        if (current) {
          if (data.email && data.email !== current.email) payload.email = String(data.email).trim()
          await db.users.update(current.id, payload)
          notify.success("Pengguna diperbarui.")
        } else {
          payload.email = String(data.email).trim()
          await db.users.create(payload)
          notify.success("Akun pengguna dibuat.")
        }
        modal.close()
        reload()
      } catch (error) {
        const fieldErrors = error.fieldErrors ?? {}
        if (Object.keys(fieldErrors).length) {
          showFieldErrors(form, fieldErrors)
          notify.error("Periksa kembali isian yang ditandai merah.")
        }
        console.error("[users] gagal menyimpan:", error)
      } finally {
        setBusy(submitButton, false)
      }
    }
  }

  async function removeUser(record) {
    const confirmed = await confirmDialog({
      title: "Hapus Pengguna",
      message: `Akun ${record.email} akan dihapus permanen. Lanjutkan?`,
      confirmText: "Ya, hapus",
      danger: true,
    })
    if (!confirmed) return

    try {
      await db.users.remove(record.id)
      notify.success("Pengguna dihapus.")
      reload()
    } catch (error) {
      console.error("[users] gagal menghapus:", error)
    }
  }
}

export default UsersView
