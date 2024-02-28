import { AdvancedFilterModel, BooleanAdvancedFilterModelType, FilterModel, IServerSideDatasource, IServerSideGetRowsParams, IViewportDatasource, IViewportDatasourceParams, ScalarAdvancedFilterModelType, TextAdvancedFilterModelType } from "ag-grid-enterprise"
import { Model, s } from "@salesway/pgts"

function is_advanced(s: any): s is AdvancedFilterModel {
  return true
}

const adv_number: {[name in ScalarAdvancedFilterModelType | TextAdvancedFilterModelType | BooleanAdvancedFilterModelType]: (value?: any) => string} = {
  lessThan: v => `lt.${v}`,
  lessThanOrEqual: v => `lte.${v}`,
  greaterThanOrEqual: v => `gte.${v}`,
  greaterThan: v => `gt.${v}`,
  blank: v => "is.null",
  notBlank: v => "not.is.null",
  true: v => "is.true",
  false: v => "is.false",
  // ??
  contains: v => `contains.${v}`,
  notContains: v => `not.contains.${v}`,
  endsWith: v => ``,
  startsWith: v => ``,
  equals: v => `eq.${v}`,
  notEqual: v => `neq.${v}`,
}


export class ModelSource implements IServerSideDatasource {

  constructor(
    public model: typeof Model & {new (): Model}
  ) { }

  init(params: IViewportDatasourceParams): void {

  }

  async getRows(params: IServerSideGetRowsParams<any, any>): Promise<void> {

    try {
      const parts: string[] = []
      const r = params.request
      const url = this.model.meta.url
      const headers = new Headers()

      // Implement sorting !
      if (r.sortModel?.length > 0) {
        parts.push(
          "order=" + r.sortModel.map(srt => `${srt.colId}.${srt.sort}`).join(",")
        )
      }

      if (r.filterModel) {
        const ft = r.filterModel
        const fts: string[] = []
        const do_filter = (ft: FilterModel | AdvancedFilterModel) => {
          if (is_advanced(ft)) {
            if (ft.filterType === "number") {
              adv_number[ft.type]
            }
          }
        }

        ft.type
      }

      if (r.startRow != null && r.endRow != null) {
        headers.append("Range", `${r.startRow}-${r.endRow}`)
        headers.append("Prefer", "count=exact")
      }

      if (r.endRow) {

      }

      //
      const response = await fetch(url + (parts.length ? "?" + parts.join("&"): ""), {
        credentials: "include",
        headers,
      })

      const cnt_rng = response.headers.get("Content-Range")
      const [rng_str, count_str] = cnt_rng!.split("/")
      const [rng_start, rng_end] = rng_str.split("-")

      //
      const json_res = await response.json() as unknown[]

      //
      const res = s.deserialize(json_res, this.model)

      // Also check the response headers for count indications

      params.success({
        rowData: res,
        rowCount: parseInt(count_str),
      })
    } catch (e) {
      params.fail()
    }
  }
}