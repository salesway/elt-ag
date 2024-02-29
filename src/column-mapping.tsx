import { Renderable, o } from "elt"
import { ColDef, ICellEditorParams, ICellRendererParams, AgRichSelect, ModuleRegistry } from "ag-grid-enterprise"

import { sym_status, type AGWrapper } from "./grid"
import { make_renderer } from "./elt-renderer"

export type SelectValues<T, V, Context = any> = V[] | Promise<V[]> | ((params: ICellEditorParams<T, V, Context>) => V[] | Promise<V[]>)


// Can't get it from anywhere else ?
const RichSelectEditor = ModuleRegistry.__getRegisteredModules("").filter(m => m.moduleName === "@ag-grid-enterprise/rich-select")[0].userComponents![0].componentClass

export class RichSelectAllowText extends RichSelectEditor {

  richSelect!: { isPickerDisplayed: boolean, searchString: string }

  getValue() {
    const v = super.getValue()
    const rt = this.richSelect
    if (!rt.isPickerDisplayed && this.params.allowUserText) {
      return rt.searchString
    }
    return v
  }

}

/**
 *
 */
export class ColumnMapping<T, K extends keyof T, Context = any> {

  constructor(
    public wrapper: AGWrapper<T>,
    public key: K
  ) { }

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

  select(values: SelectValues<T, T[K], Context>, opts?: {
    allowUserText?: boolean,
  }) {
    this.options({
      cellEditor: RichSelectAllowText,
      cellEditorParams: {
        values,
        searchType: 'fuzzy',
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
        valueListGap: 0,
        allowUserText: true,
        ...opts,
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
      // cellEditor: 'agCheckboxCellEditor',
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

    // On fait en sorte que toute modification reste bien immutable.
    valueSetter: (param) => {
      if (param.node && param.newValue !== param.oldValue) {
        const dt = o.assign(
          param.data as any,
          {[param.colDef.field!]: param.newValue}
        ) as T
        param.node[sym_status] = 1
        param.node.setData(dt)

        const id = this.wrapper.id_fn(dt)
        if (param.node.id !== id) {
          // param.node.Id
        }
        // Il faut probablement faire un SetId !
        return true
      }
      return false
    }

  }

  options(opts: ColDef<T>) {
    this._options = o.assign(this._options as any, opts)
    return this
  }

}

