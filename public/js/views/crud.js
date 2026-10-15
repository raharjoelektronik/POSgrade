/**
 * views/crud.js - pabrik halaman CRUD generik.
 *
 * Halaman master data (produk, kategori, pelanggan) punya pola yang sama:
 * pencarian + tabel + form modal. Daripada menulis ulang tiga kali, semua
 * perbedaan dinyatakan sebagai konfigurasi.
 */
import { h, render, readForm, clear, debounce, setBusy } from "../lib/dom.js"
import { dataTable, skeletonTable, tableCard } from "../components/table.js"
import { openModal, confirmDialog } from "../lib/modal.js"
import { showFieldErrors } from "../components/form.js"
import { notify } from "../lib/toast.js"
import { pb } from "../api.js"
import { buildFilter, quote } from "../lib/pb.js"

const PER_PAGE = 25

/**
 * @param {{ title:string, subtitle?:string,
 *   collection:() => object, columns:Array<object>,
 *   formFields:(record:object|null, ctx:object)=>Node[],
 *   toPayload:(data:object, record:object|null)=>object,
 *   emptyRecord?:object, sort?:string, expand?:string,
 *   searchFilter?:(term:string)=>string, baseFilter?:()=>string,
 *   permissions?:{ write?:string|null, delete?:string|null },
 *   labelOf?:(record:object)=>string, extraActions?:Array<object>,
 *   loadContext?:()=>Promise<object> }} config
 */
export function createCrudView(config) {
  const {
    title,
    subtitle = "",
    collection,
    columns,
    formFields,
    toPayload,
    sort = "name",
    expand = "",
    searchFilter = (term) => `name ~ ${quote(term)}`,
    baseFilter = () => "",
    permissions = {},
    labelOf = (record) => record.name ?? record.id,
    extraActions = [],
    loadContext = async () => ({}),
  } = config

  return function CrudView({ outlet }) {
    const state = { page: 1, totalPages: 1, totalItems: 0, search: "", rows: [], ctx: {} }

    const tableHost = h("div", { class: "card__body card__body--tight" }, skeletonTable(columns))
    const pagination = h("div", { class: "row row--between mt-4" })

    const searchInput = h("input", {
      class: "input",
      type: "search",
      placeholder: "Cari…",
      autocomplete: "off",
      oninput: debounce((event) => {
        state.search = event.target.value.trim()
        state.page = 1
        reload()
      }, 280),
    })

    const addButton = h(
      "button",
      { class: "btn btn--primary", type: "button", onclick: () => openForm(null) },
      `+ Tambah ${title}`
    )

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
            h("h2", {}, title),
            subtitle ? h("p", { class: "page-head__meta" }, subtitle) : null
          ),
          h(
            "div",
            { class: "page-head__actions" },
            ...extraActions.map((action) =>
              h(
                "button",
                { class: "btn", type: "button", onclick: () => action.onClick({ reload, state }) },
                action.label
              )
            ),
            pb.can(permissions.write) ? addButton : null
          )
        ),
        tableCard({
          title: "Daftar " + title,
          actions: [
            h("div", { style: { width: "260px" } }, searchInput),
            h("button", { class: "btn btn--sm", type: "button", onclick: () => reload() }, "⟳"),
          ],
          table: tableHost,
        }),
        pagination
      )
    )

    loadContext()
      .then((ctx) => {
        state.ctx = ctx ?? {}
        return reload()
      })
      .catch((error) => console.error(`[${title}] gagal memuat konteks:`, error))

    // ------------------------------------------------------------ data loading
    async function reload() {
      try {
        const filter = buildFilter(baseFilter(), state.search ? searchFilter(state.search) : "")

        const result = await collection().getList(state.page, PER_PAGE, { filter, sort, expand })
        state.rows = result.items
        state.totalPages = result.totalPages || 1
        state.totalItems = result.totalItems || 0
        renderTable()
      } catch (error) {
        console.error(`[${title}] gagal memuat data:`, error)
      }
    }

    function renderTable() {
      clear(tableHost)

      tableHost.appendChild(
        dataTable({
          columns: [
            ...columns,
            {
              key: "__actions",
              label: "",
              align: "num",
              render: (row) =>
                h(
                  "div",
                  { class: "table__actions" },
                  pb.can(permissions.write)
                    ? h(
                        "button",
                        { class: "btn btn--sm", type: "button", onclick: () => openForm(row) },
                        "Ubah"
                      )
                    : null,
                  pb.can(permissions.delete)
                    ? h(
                        "button",
                        {
                          class: "btn btn--sm btn--danger",
                          type: "button",
                          onclick: () => removeRecord(row),
                        },
                        "Hapus"
                      )
                    : null
                ),
            },
          ],
          rows: state.rows,
          empty: state.search ? "Tidak ada data yang cocok." : `Belum ada ${title.toLowerCase()}.`,
        })
      )

      renderPagination()
    }

    function renderPagination() {
      clear(pagination)

      const from = state.totalItems === 0 ? 0 : (state.page - 1) * PER_PAGE + 1
      const to = Math.min(state.page * PER_PAGE, state.totalItems)

      pagination.append(
        h("span", { class: "small muted" }, `Menampilkan ${from}–${to} dari ${state.totalItems} data`),
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              class: "btn btn--sm",
              type: "button",
              disabled: state.page <= 1,
              onclick: () => {
                state.page -= 1
                reload()
              },
            },
            "‹ Sebelumnya"
          ),
          h("span", { class: "small nowrap" }, `Hal. ${state.page} / ${state.totalPages}`),
          h(
            "button",
            {
              class: "btn btn--sm",
              type: "button",
              disabled: state.page >= state.totalPages,
              onclick: () => {
                state.page += 1
                reload()
              },
            },
            "Berikutnya ›"
          )
        )
      )
    }

    // --------------------------------------------------------------- form modal
    function openForm(record) {
      const isEdit = Boolean(record)
      const fields = formFields(record, state.ctx)

      const form = h(
        "form",
        { id: "crud-form", onsubmit: (event) => save(event, record) },
        h("div", { class: "form-grid" }, ...fields)
      )

      const submitButton = h(
        "button",
        { class: "btn btn--primary", type: "submit", form: "crud-form" },
        isEdit ? "Simpan Perubahan" : "Simpan"
      )

      const modal = openModal({
        title: `${isEdit ? "Ubah" : "Tambah"} ${title}`,
        body: form,
        footer: [
          h("button", { class: "btn", type: "button", onclick: () => modal.close() }, "Batal"),
          submitButton,
        ],
      })

      async function save(event, current) {
        event.preventDefault()

        const data = readForm(form)
        const payload = toPayload(data, current)

        setBusy(submitButton, true, "Menyimpan…")

        try {
          if (current) {
            await collection().update(current.id, payload)
            notify.success(`${title} diperbarui.`)
          } else {
            await collection().create(payload)
            notify.success(`${title} baru ditambahkan.`)
          }
          modal.close()
          reload()
        } catch (error) {
          const fieldErrors = error.fieldErrors ?? {}
          if (Object.keys(fieldErrors).length) {
            showFieldErrors(form, fieldErrors)
            notify.error("Periksa kembali isian yang ditandai merah.")
          }
          console.error(`[${title}] gagal menyimpan:`, error)
        } finally {
          setBusy(submitButton, false)
        }
      }
    }

    async function removeRecord(record) {
      const confirmed = await confirmDialog({
        title: `Hapus ${title}`,
        message: `Yakin ingin menghapus "${labelOf(record)}"? Tindakan ini tidak dapat dibatalkan.`,
        confirmText: "Ya, hapus",
        danger: true,
      })
      if (!confirmed) return

      try {
        await collection().remove(record.id)
        notify.success(`${title} dihapus.`)
        reload()
      } catch (error) {
        console.error(`[${title}] gagal menghapus:`, error)
      }
    }
  }
}

export default createCrudView
