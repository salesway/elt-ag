import { AgPromise } from "ag-grid-community"
import { ICellEditorComp, ICellEditorParams, } from "ag-grid-enterprise"
import { node_do_connected, node_do_disconnect } from "elt"


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
