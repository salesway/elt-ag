import { Renderable, o } from "elt"
import { ColDef, ICellEditorParams, ICellRendererParams, ModuleRegistry } from "ag-grid-enterprise"

import { type AGWrapper } from "./grid"
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

  select(values?: SelectValues<T, T[K], Context>, opts?: {
    allowUserText?: boolean,
  }) {
    values ??= (params) => {
      return [...new Set(this.wrapper.data.map((item: any) => item[params.colDef.field as any]))]
    }

    this.options({
      cellEditor: RichSelectAllowText,
      cellEditorParams: {
        values,
        searchType: 'fuzzy',
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
        valueListGap: 0,
        allowUserText: false,
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

        const current = param.data
        //
        const value = o.assign(
          current as any,
          {[param.colDef.field!]: param.newValue}
        ) as T

        const node = param.node

        if (!node.isRowPinned()) {
          param.api.edits.update([{ value, node }])
        }
        node.setData(value)

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

