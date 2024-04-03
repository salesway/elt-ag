import { Model, s } from "@salesway/pgts"
import { ColDef, GridApi, IRowNode } from "ag-grid-enterprise"
import { Renderable, o, e } from "elt"
import { make_renderer } from "elt-renderer"
import type { AGWrapper } from "grid"
import { raw } from "osun"


import * as I from "elt-fa/sharp-light"
import { $tooltip } from "elt-shoelace"


export const enum Op {
  Orig = 0,
  Add = 1,
  Del = 2,
  Upd = 3,
}

export class Status<T> {
  constructor(
    public readonly node: IRowNode<T>,
    public readonly op: Op,
    public readonly value: T,
    public readonly errors?: (() => Renderable)[],
  ) { }
}


export class EditStack<T> extends Map<string | IRowNode<T>, Status<T>> {
  constructor(
    iter?: Iterable<[string | IRowNode<T>, Status<T>]>,
    public version = 0,
    public prev: EditStack<T> | null = null,
    public next: EditStack<T> | null = null,
  ) {
    super(iter)
  }

  derive() {
    if (this.next) {
      this.next.prev = null
    }
    const res = new EditStack(this, this.version + 1, this)
    this.next = res
    return res
  }

  unshift() {
    const next = this.next
    if (next) {
      next.prev = null
      this.next = null
    }
    return next!
  }


}


export class GridEdits<T = any> {
  constructor(
    public wrapper: AGWrapper<T>,
  ) {
    this.grid = this.wrapper.table
    this.init()
  }

  grid: GridApi<T>

  current_status: EditStack<T> = new EditStack()
  first: EditStack<T> = this.current_status

  max_undo_redo = 50

  o_undo_nb = o(0)
  o_redo_nb = o(0)

  /** Register a few events on the grid to clear ourselves if too many things happened, such as a server refresh */
  init() {
    this.setupChangeReporting()
    // this.grid.addEventListener("")
  }

  pushState(): {current: EditStack<T>, prev: EditStack<T>} {
    const prev = this.current_status
    const current = this.current_status.derive()
    this.current_status = current
    if (current.version - this.first.version > this.max_undo_redo) {
      this.first = this.first.unshift()
    }
    return {current, prev}
  }

  setupChangeReporting() {

    const old_row_class = this.grid.getGridOption("getRowClass")
    this.grid.setGridOption("getRowClass", (par) => {
      const chg = par.api.edits.current_status
      const other = old_row_class?.(par)
      const res: string[] = typeof other === "string" ? [other]
        : other ? [...other]
        : []

      const node = par.node
      const st = chg.get(node.id ?? node)
      if (st == null) {
        return [""]
      }

      if (st.op === Op.Add) {
        res.push("sw-added")
      } else if (st.op === Op.Upd) {
        res.push("sw-updated")
      } else if (st.op === Op.Del) {
        res.push("sw-deleted")
      }

      if (st.errors) {
        res.push("sw-error")
      }

      return res.length === 0 ? [""] : res
    })
  }

  getSelectionColumn(): ColDef<T>[] {
    return [
      {
        headerName: "",
        // rowDrag: true,
        // hide: true,
        pinned: "left",
        maxWidth: 42,
        initialWidth: 20,
        width: 20,
        floatingFilter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: make_renderer(par => {
          const st = this.current_status.get(par.node.id ?? par.node as any)
          let display = <span></span> as HTMLElement

          if (st?.errors) {
            e(display, $tooltip(st.errors), <I.FaTriangleExclamation/>)
          }

          if (st?.op === Op.Del) {
            e(display, <I.FaBan/>)
          } else if (st?.op === Op.Upd) {
            e(display, <I.FaPen/>)
          }


          return display
        }),
        enableValue: false,
        editable: false,
        filter: null,
        sortable: false,
      }
    ]
  }

  // create(data: {node: IRowNode<T>, value: T}[]) {
  //   const {current, prev} = this.pushState()

  //   for (let d of data) {
  //     const n = d.node
  //   }
  // }

  update(data: {node: IRowNode<T>, value: T,}[]) {
    const {current, prev} = this.pushState()

    for (let {node, value} of data) {
      const id = node.id ?? node
      if (!prev.has(id)) {
        prev.set(id, new Status(
          node,
          Op.Orig,
          node.data!,
        ))
      }
      current.set(id, new Status(
        node,
        Op.Upd,
        value,
      ))
    }
  }

  delete(nodes: IRowNode<T>[]) {
    const {prev, current} = this.pushState()

    for (let n of nodes) {
      const id = n.id
      // If id is null, we should check whether we're trying to delete a pinned row (which is a creation row)
      if (id == null || n.data == null) continue

      const _old_status = prev.get(id)

      if (_old_status?.op === Op.Del) {
        // This was already deleted, try to find out its previous status
        const old_status = prev.prev?.get(id) ?? new Status(n, Op.Orig, n.data)
        current.set(id, old_status)
      } else {
        if (!_old_status) {
          prev.set(id, new Status(n, Op.Orig, n.data))
        }
        current.set(id, new Status(n, Op.Del, n.data!))
      }
    }
  }

  diff(prev: EditStack<T>) {
    const cur = this.current_status
    const nodes: IRowNode<T>[] = []
    for (let [id, st] of cur) {
      const prev_st = prev.get(id)
      if (prev_st && prev_st.op === st.op && prev_st.value === st.value) {
        continue
      }
      if (prev_st?.value !== st.value) {
        st.node.setData(st.value)
      }

      // On réévalue les classes des rows
      nodes.push(st.node)
    }
    this.grid.redrawRows({rowNodes: nodes})
    this.wrapper.node.focus()

    this.refocus()
  }

  refocus() {
    // Restore focus as the redraw may kill it.
    let cell = this.grid.getFocusedCell();
    if ( cell ) {
        this.grid.setFocusedCell( cell.rowIndex, cell.column, cell.rowPinned );
    }
  }

  undo() {
    if (!this.current_status.prev) {
      return
    }
    const pre = this.current_status
    this.current_status = this.current_status.prev
    this.diff(pre)
  }

  redo() {
    if (!this.current_status.next) {
      return
    }
    const pre = this.current_status
    this.current_status = this.current_status.next
    this.diff(pre)
  }

  async save() {
    if (this.current_status.size === 0 || [...this.current_status.values()].filter(s => s.op !== Op.Orig).length === 0) {
      return
    }

    // FIXME change
    ;(this as any).saveChangesToServer()
  }

  /** Commit the changes to the grid */
  async commit(cbk?: (current: EditStack<T>, edit: GridEdits<T>) => Promise<EditStack<T>> | EditStack<T> | undefined) {

    const changes = this.current_status
    const res = new EditStack(await cbk?.(changes, this) ?? changes)

    const add: T[] = []
    const update: T[] = []
    const remove: T[] = []
    const redraw: IRowNode<T>[] = []

    for (let [id, c] of res) {
      if (c.errors) {
        redraw.push(c.node)
        continue
      }

      if (c.op === Op.Add) {
        add.push(c.value)
      } else if (c.op === Op.Del) {
        remove.push(c.value)
      } else if (c.op === Op.Upd) {
        update.push(c.value)
      }

      res.delete(id)
    }

    await this.grid.applyTransactionAsync({
      add,
      update,
      remove,
    })

    this.clear(res)
    if (redraw.length) {
      this.grid.redrawRows({rowNodes: redraw})
      this.refocus()
    }
  }

  async saveChangesToServer<T extends Model>(this: GridEdits<T>) {
    await this.commit(async (chg) => {
      const resmap = new EditStack(chg)
      const bulk_statement: any[] = []
      const orig: [any, Status<T>][] = []
      const model = this.wrapper.model as any as typeof Model

      for (let [id, c] of chg) {
        orig.push([id, c])
        if (c.op === Op.Orig) {
          continue
        } else if (c.op === Op.Add) {
          bulk_statement.push(c.value)
        } else if (c.op === Op.Del) {
          bulk_statement.push({$d: c.value.__pk})
        } else if (c.op === Op.Upd) {
          const inst: any = s.serialize(c.value, model)
          bulk_statement.push({$u: c.value.__pk, ...inst})
        }
      }

      const res = await (await fetch(`${model.meta.url}/bulk${model.meta.pk_fields.length ? "?_pk=" + model.meta.pk_fields.join(",") : ""}`, {
        method: "POST",
        body: JSON.stringify(bulk_statement),
      })).json() as {item: T, error_code: number, error_msg: string}[]

      let i = 0
      for (let item of res){
        const des = item.item ? s.deserialize(item.item, model as any) : null!
        const [key, or] = orig[i]
        const errors = item.error_msg ? [() => item.error_msg] : undefined

        const status = new Status(or.node, or.op, des ?? or.value, errors)
        resmap.set(key, status)

        i++
      }

      return resmap
    })
  }

  clear(map?: EditStack<T>) {
    this.current_status = map?.size ? map : new EditStack()
    this.grid.redrawRows()
  }

}


raw`
.ag-row.sw-updated {
  background-color: rgba(255, 166, 166, 0.2);
}
.ag-row.sw-deleted {
  background-color: rgba(0, 0, 166, 0.2);
}
.ag-row.sw-error {
  background-color: rgba(255, 0, 0, 0.2);
}
.ag-row.sw-added {
  background-color: rgba(0, 255, 0, 0.2);
}

`