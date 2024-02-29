import { createGrid, GridOptions, GridApi, IRowNode, } from "ag-grid-enterprise"

import { Inserter, node_on_connected, node_on_disconnected, o, sym_insert, e, } from "elt"

import "./grid-style"

import { ModelSource } from "./server"
import { Model } from "@salesway/pgts"
import { ColumnMapping } from "./column-mapping"


export const sym_status = Symbol("modified")
export const enum RowStatus {
  None = 0,
  Added = 1,
  Modified = 2,
  Deleted = 3,
  Error = 4,
}

declare module "ag-grid-enterprise" {
  interface IRowNode<TData = any> {
    [sym_status]?: RowStatus
    error?: string
  }
}



export class AGWrapper<T, Context = any> implements Inserter<HTMLElement> {

  static from<T>(
    typ: new () => T,
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
  table!: GridApi
  model!: new () => T

  _data: T[] | null = null
  get data(): T[] {
    const res: T[] = []
    this.table.forEachLeafNode(node => {
      res.push(node.data)
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

  modified_tmp = new Map<any, T>()
  deleted_tmp = new Map<any, T>()

  /**  */
  saveChanges() {

  }

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

    getRowStyle(par) {
      if (par.node[sym_status] === RowStatus.Modified) {
        return {background: "rgba(255, 165, 0, 0.25)"}
      } else if (par.node[sym_status] === RowStatus.Error) {
        return {background: "rgba(255, 0, 0, 0.25)"}
      }
    },

    enterNavigatesVerticallyAfterEdit: true,

    enableRangeSelection: true,
  }

  setQuickFilter(fil: string | undefined) {
    this.table?.setGridOption("quickFilterText", fil)
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

  /**
   * Pour tous les objets Pinnés (en haut ou en bas,) on considère qu'il s'agit d'une tentative d'insertion, donc on tente de les "insérer," sachant qu'on va fail un objet pour lequel on avait par exemple déjà un row.
   * Cela aboutit toujours à une transaction, sachant que l'on garde des changements locaux
   */
  async savePrimedChanges() {
    let nodes_to_save: IRowNode<any>[] = []
    let nodes_to_add: T[] = []

    this.table.forEachLeafNode(node => {
      if (node[sym_status]) {
        nodes_to_save.push(node)
      }
    })

    const row_id_fn = this.table.getGridOption("getRowId")!

    // this.table.getRowNode()

    // We should have a callback that does some validation, sets errors and replies with a batch update

    console.log(nodes_to_save)

    // ... after while
    for (let n of nodes_to_save) {
      n[sym_status] = RowStatus.None
    }

    await this.table.applyTransactionAsync({

    })

    this.table.redrawRows({
      rowNodes: nodes_to_save
    })
  }

  on_connected = () => {
    this.table = createGrid(this.node, {
      ...this._options,
      columnDefs: this._cols.map(c => c._options),
    })

    // this.table.addEventListener("cellEdi")

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
      serverSideDatasource: new ModelSource(this.model)
    })
    return this
  }

  [sym_insert](parent: HTMLElement, ref: Node | null) {
    parent.insertBefore(this.node, ref)
  }

}
