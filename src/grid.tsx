import { createGrid, GridOptions, ColDef, GridApi, ICellRendererParams, ICellRendererComp, ICellEditorComp } from "ag-grid-enterprise"

import { Inserter, node_on_connected, node_on_disconnected, o, sym_insert, e, node_do_disconnect, Renderable, node_do_connected } from "elt"

import "./grid-style"

import { AgPromise, ICellEditorParams } from "ag-grid-community"

import { ModelSource } from "./server"
import { Model } from "@salesway/pgts"


export type SelectValues<T> = T[] | Promise<T[]> | (() => T[] | Promise<T[]>)


export class EltCellEditor<T, K extends keyof T, Context = any> implements ICellEditorComp {
  gui!: HTMLElement

  init(params: ICellEditorParams<any, any, any>): void | AgPromise<void> {

  }

  focusIn(): void {

  }

  focusOut(): void {

  }

  getValue() {

  }

  getGui(): HTMLElement {
    return this.gui
  }

  destroy(): void {
    node_do_disconnect(this.gui)
    this.gui = null!
  }

  afterGuiAttached(): void {
    node_do_connected(this.gui)
  }
}

export function make_renderer<T, K extends keyof T, Context = any>(render: (params: ICellRendererParams<T, T[K], Context>) => Renderable) {

  return class EltCellRenderer implements ICellRendererComp {
    static renderFn = render
    gui!: HTMLElement

    init(params: ICellRendererParams<any, any, any>): void | AgPromise<void> {
      let gui: Renderable = render(params)
      if (!(gui instanceof Node)) {
        gui = <div>{gui}</div> as HTMLElement
      }
      this.gui = gui as HTMLElement
    }

    destroy(): void {
      node_do_disconnect(this.gui)
      this.gui = null!
    }

    getGui(): HTMLElement {
      // We timeout it because this is the only way we'll be sure they're actually connected, since ag-grid does not give us control of when it gets inserted for real.
      setTimeout(() => { if (this.gui) { node_do_connected(this.gui as Node); } })
      return this.gui
    }

    refresh(params: ICellRendererParams<any, any, any>): boolean {
      return false // We could do some observable stuff...
    }
  }
}


/**
 *
 */
export class ColumnMapping<T, K extends keyof T, Context = any> {

  constructor(public key: K) { }

  render(fn: (ctx: ICellRendererParams<T, T[K], Context>) => Renderable) {
    const rd = make_renderer(fn)

    this.options({
      cellRenderer: rd,
      cellEditorParams: {
        cellRenderer: rd,
      },
      filterParams: {
        cellRenderer: rd,
      }
    })
    return this
  }

  select(values: SelectValues<T[K]>) {
    this.options({
      cellEditor: "agRichSelectCellEditor",
      cellEditorParams: {
        values,
        searchType: 'fuzzy',
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
      },
    })
    return this
  }

  name(t: string) {
    this._options.headerName = t
    return this
  }

  get center() {
    this.options({
      cellStyle: {
        display: "flex",
        justifyContent: "center",
      },
    })
    return this
  }

  get checkbox() {
    this.options({
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
    })
    return this
  }

  _options: ColDef<T> = {
    field: this.key as any,
    menuTabs: ['filterMenuTab'],
    editable: true,
    filter: true,
    enablePivot: true,
    enableValue: true,
    sortable: true,
  }

  options(opts: ColDef<T>) {
    this._options = o.assign(this._options as any, opts)
    return this
  }

}


export class AGWrapper<T, Context = any> implements Inserter<HTMLElement> {

  static from<T>(typ: new () => T, lst?: T[] | o.Observable<T[]>, opts?: GridOptions<T>): AGWrapper<T> {
    const n = new AGWrapper<T>()
    if (opts != null) { n.options(opts) }
    if (lst) n.data = o.get(lst)
    n.model = typ
    return n
  }

  node: HTMLDivElement = <div style={{width: "100%", height: "100%",}} class={["ag-theme-balham", "ag-theme-sw"]}/> as HTMLDivElement
  table!: GridApi
  model!: new () => T
  data: T[] = []

  constructor() {
    node_on_connected(this.node, this.on_connected)
    node_on_disconnected(this.node, this.on_disconnected)
  }

  _cols: ColumnMapping<T, any>[] = []
  _options: GridOptions<T> = {
    autoSizeStrategy: {
      type: 'fitCellContents',
    },

    defaultColDef: {
      editable: true,
    },

    enterNavigatesVerticallyAfterEdit: true,

    // rowSelection: "single",
    enableRangeSelection: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 50,
    // columns: this._columns,
    // licenseKey: "non-commercial-and-evaluation",
  }

  setQuickFilter(fil: string | undefined) {
    this.table?.setGridOption("quickFilterText", fil)
  }

  col<K extends keyof T>(key: K, fn?: (cm: ColumnMapping<T, K, Context>) => any) {
    const c = new ColumnMapping<T, K>(key)
    fn?.(c)
    this._cols.push(c)
    return this
  }

  options(opts: GridOptions<T>) {
    Object.assign(this._options, opts)
    return this
  }

  on_connected = () => {
    this.table = createGrid(this.node, {
      ...this._options,
      columnDefs: this._cols.map(c => c._options),
    })

    if (this.data) {
      this.table.setGridOption("rowData", this.data)
    }
  }

  on_disconnected = () => {
    this.table.destroy()
    this.table = null!
  }

  useServer<T extends Model>(this: AGWrapper<T, Context>, type = "serverSide" as "serverSide" | "infinite") {
    this.options({
      rowModelType: type,
      serverSideDatasource: new ModelSource(this.model)
    })
    return this
  }

  [sym_insert](parent: HTMLElement, ref: Node | null) {
    parent.insertBefore(this.node, ref)
  }

}
