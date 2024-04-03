import { AgPromise, ICellRendererComp, ICellRendererParams } from "ag-grid-enterprise"
import { Renderable, e, node_do_connected, node_do_disconnect } from "elt"


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