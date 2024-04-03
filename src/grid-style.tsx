
import "ag-grid-enterprise/styles/ag-grid.css"
import "ag-grid-enterprise/styles/ag-theme-balham.css"

import { raw } from "osun"

raw/* css */`
.ag-row-pinned {
  background-color: rgba(40, 155, 40, 0.14);
}

.ag-theme-sw {
  font-size: 1rem;
  --ag-grid-size: 3px;
  --ag-row-height: calc(1em + var(--ag-grid-size) * 3);
  --ag-header-height: calc(1em + var(--ag-grid-size) * 2);
  --ag-list-item-height: calc(1em + var(--ag-grid-size) * 2);
  --ag-column-select-indent-size: var(--ag-icon-size);
  --ag-set-filter-indent-size: var(--ag-icon-size);
  --ag-advanced-filter-builder-indent-size: calc(var(--ag-icon-size) + var(--ag-grid-size) * 2);
  --ag-cell-horizontal-padding: calc(var(--ag-grid-size) * 2);
  --ag-cell-widget-spacing: calc(var(--ag-grid-size) * 2);
  --ag-widget-container-vertical-padding: calc(var(--ag-grid-size) * 2);
  --ag-widget-container-horizontal-padding: calc(var(--ag-grid-size) * 2);
  --ag-widget-vertical-spacing: calc(var(--ag-grid-size) * 2);
}

.ag-theme-sw .ag-cell-label-container {
  padding: 0;
}
`