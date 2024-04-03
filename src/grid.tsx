import { createGrid, GridOptions, GridApi, IRowNode, CellRangeType,  } from "ag-grid-enterprise"

import { Inserter, node_on_connected, node_on_disconnected, o, sym_insert, e, } from "elt"

import "./grid-style"

import { ModelSource } from "./server"
import { Model, } from "@salesway/pgts"
import { ColumnMapping, } from "./column-mapping"
import { GridEdits, } from "changes"


export const sym_status = Symbol("modified")

declare module "ag-grid-enterprise" {

  interface GridApi<TData> {
    idfn: (val: TData) => string
    edits: GridEdits<TData>
  }

}



export class AGWrapper<T, Context = any> implements Inserter<HTMLElement> {

  static from<T>(
    typ: typeof Model & (new () => T),
    id_fn: (item: T) => any,
    lst?: T[] | o.Observable<T[]>,
    opts?: GridOptions<T>
  ): AGWrapper<T> {
    const n = new AGWrapper<T>(id_fn)

    if (opts != null) { n.options(opts) }
    if (lst) n.data = o.get(lst)
    n.model = typ
    return n
  }

  node: HTMLDivElement = <div style={{width: "100%", height: "100%",}} class={["ag-theme-balham", "ag-theme-sw"]}/> as HTMLDivElement
  table!: GridApi<T>
  model!: typeof Model & (new () => T)

  _data: T[] | null = null
  get data(): T[] {
    const res: T[] = []
    this.table.forEachLeafNode(node => {
      res.push(node.data!)
    })
    return res
  }
  set data(dt: T[]) {
    if (!this.table) {
      this._data = dt
    } else {
      this.table.updateGridOptions({
        rowData: dt,
      })
    }
  }

  nodes_to_update = new Map<any, T>()
  nodes_to_delete = new Map<any, T>()

  constructor(
    public id_fn: (val: T) => any
  ) {
    node_on_connected(this.node, this.on_connected)
    node_on_disconnected(this.node, this.on_disconnected)
    this._options.getRowId = param => id_fn(param.data)
  }

  _cols: ColumnMapping<T, any>[] = []
  _options: GridOptions<T> = {
    autoSizeStrategy: {
      type: 'fitCellContents',
    },

    columnHoverHighlight: false,
    suppressRowHoverHighlight: true,

    defaultColDef: {

    },

    enterNavigatesVerticallyAfterEdit: true,
    enableRangeSelection: true,
  }

  setQuickFilter(fil: string | undefined) {
    this.table?.setGridOption("quickFilterText", fil)
  }

  /** Call it after the first column */
  setDraggableRows() {
    this._cols[0].options({
      rowDrag: true,
    })
  }

  col<K extends keyof T>(key: K, fn?: (cm: ColumnMapping<T, K, Context>) => any) {
    const c = new ColumnMapping<T, K>(this, key)
    fn?.(c)
    this._cols.push(c)
    return this
  }

  options(opts: GridOptions<T>) {
    Object.assign(this._options, opts)
    return this
  }

  getTopPinnedObjects(): T[] {
    const nb_top = this.table.getPinnedTopRowCount()
    const top: T[] = []
    for (let i = 0; i < nb_top; i++) {
      top.push(this.table.getPinnedTopRow(i)?.data)
    }
    return top
  }

  on_connected = () => {
    const t = this.table = createGrid(this.node, {
      ...this._options,
    })

    this.table.edits = new GridEdits(this)
    t.setGridOption("columnDefs", [
      ...t.edits?.getSelectionColumn(),
      ...this._cols.map(c => c._options)
    ])


    // Upgrade the grid with stuff
    t.idfn = this.id_fn

    if (this._data) {
      this.table.setGridOption("rowData", this._data)
      this._data = null
    }
  }

  on_disconnected = () => {
    this.table.destroy()
    this.table = null!
  }

  useServer<T extends Model>(this: AGWrapper<T, Context>, type = "serverSide" as "serverSide" | "infinite") {
    this.options({
      rowModelType: type,
      serverSideDatasource: new ModelSource(this.model as any)
    })
    return this
  }

  addNewElement() {
    const top = this.getTopPinnedObjects()
    const row = new (this.model as any)()
    top.unshift(row)
    this.table.setGridOption("pinnedTopRowData", top)
  }

  [sym_insert](parent: HTMLElement, ref: Node | null) {

    this.node.addEventListener("keydown", ev => {
      if (ev.ctrlKey && ev.altKey && ev.code === "Minus") {
        this.markSelectionForDeletion()
        ev.preventDefault()
      } else if (ev.ctrlKey && ev.altKey && ev.code === "Equal") {
        this.addNewElement()
        const top = this.table.getPinnedTopRow(this.table.getPinnedTopRowCount() - 1)!
        this.table.setFocusedCell(top.rowIndex!, this.table.getColumns()![0], "top")
        ev.preventDefault()
      } else if (ev.ctrlKey && ev.code === "Enter") {
        // Multiple range entry, check if we are in edit mode ?
      } else if (ev.ctrlKey && ev.code === "KeyZ") {
        this.table.edits.undo()
      } else if (ev.ctrlKey && ev.code === "KeyY") {
        this.table.edits.redo()
      } else if (ev.ctrlKey && ev.code === "KeyA") {
        const grid = this.table
        const cols = grid.getColumns()!.slice(1)

        grid.clearRangeSelection()

        grid.setFocusedCell( 0, cols[0], );
        grid.addCellRange({
          rowStartIndex: 0,
          columns: cols,
          rowEndIndex: grid.getDisplayedRowCount()
        })

        // this.table.
      } else {
        return
      }
      ev.preventDefault()
      ev.stopPropagation()
    }, { capture: true })
    parent.insertBefore(this.node, ref)
  }

  async save() {
    return this.table.edits?.save()
  }

  /** Marque les rows qui ont des ranges comme étant à détruire */
  markSelectionForDeletion() {
    const ranges = this.table.getCellRanges()
    if (ranges == null) return
    const nodes: IRowNode[] = []
    for (let rng of ranges) {
      // Ignore pinned rows
      if (rng.startRow == null || rng.endRow == null || rng.startRow.rowPinned != null || rng.endRow.rowPinned != null) { continue }

      const [start, end] = [rng.startRow.rowIndex, rng.endRow.rowIndex]
      for (let i = start; i <= end; i++) {
        const node = this.table.getDisplayedRowAtIndex(i)
        const data = node?.data
        if (node == null || data == null) { continue }

        nodes.push(node)
      }
      this.table.edits.delete(nodes)
    }

    this.table.redrawRows({rowNodes: nodes})

    // Restore focus in the grid
    for (let rng of ranges) {
      if (rng.startRow == null) { continue }
      this.table.setFocusedCell(rng.startRow.rowIndex, rng.columns[0], rng.startRow.rowPinned)
      return
    }
  }
}
