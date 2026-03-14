import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridOptions } from "ag-grid-community";
import { useThemeStore } from "../../store/theme";

interface DataGridProps<T> extends Omit<GridOptions<T>, "columnDefs" | "rowData"> {
  columnDefs: ColDef<T>[];
  rowData: T[] | null | undefined;
  height?: number | string;
  pagination?: boolean;
  pageSize?: number;
  compact?: boolean;
}

export default function DataGrid<T>({
  columnDefs,
  rowData,
  height,
  pagination = false,
  pageSize = 25,
  compact = false,
  ...rest
}: DataGridProps<T>) {
  const { theme } = useThemeStore();
  const themeClass = theme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    suppressMovable: true,
    minWidth: 80,
    flex: 1,
  };

  return (
    <div
      className={themeClass}
      style={{
        height: height ?? (compact ? "auto" : undefined),
        width: "100%",
        "--ag-font-size": compact ? "12px" : "13px",
        "--ag-row-height": compact ? "32px" : "40px",
        "--ag-header-height": compact ? "34px" : "42px",
      } as React.CSSProperties}
    >
      <AgGridReact<T>
        columnDefs={columnDefs}
        rowData={rowData ?? []}
        defaultColDef={defaultColDef}
        domLayout={height ? undefined : "autoHeight"}
        pagination={pagination}
        paginationPageSize={pageSize}
        suppressMovableColumns
        animateRows
        {...rest}
      />
    </div>
  );
}
