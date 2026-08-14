"use client"
"use no memo"

import * as React from "react"

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { CardContent } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@workspace/ui/components/table-pagination"

import { dashboardOverviewColumns } from "./columns"
import type { DashboardOverviewRow } from "./schema"

const categoryOptions = [
  { value: "all", label: "Todas" },
  { value: "Atención", label: "Atención" },
  { value: "Publicación", label: "Publicación" },
  { value: "Biblioteca", label: "Biblioteca" },
] as const

const sortOptions = [
  { value: "name-asc", label: "Elemento A-Z" },
  { value: "name-desc", label: "Elemento Z-A" },
  { value: "category-asc", label: "Área A-Z" },
] as const

const sortOptionState = {
  "name-asc": [{ id: "title", desc: false }],
  "name-desc": [{ id: "title", desc: true }],
  "category-asc": [{ id: "category", desc: false }],
} satisfies Record<(typeof sortOptions)[number]["value"], SortingState>

export function DashboardOverviewTable({
  data,
}: {
  data: DashboardOverviewRow[]
}) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "title", desc: false },
  ])
  const [columnVisibility] = React.useState<VisibilityState>({
    search: false,
  })
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns: dashboardOverviewColumns,
    state: {
      rowSelection,
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const searchQuery =
    (table.getColumn("search")?.getFilterValue() as string | undefined) ?? ""
  const categoryFilter =
    (table.getColumn("category")?.getFilterValue() as string | undefined) ??
    "all"
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0]

    if (!currentSort) return "name-asc"
    if (currentSort.id === "title" && !currentSort.desc) return "name-asc"
    if (currentSort.id === "title" && currentSort.desc) return "name-desc"
    if (currentSort.id === "category" && !currentSort.desc)
      return "category-asc"

    return "name-asc"
  }, [sorting])

  const filteredTotal = table.getFilteredRowModel().rows.length
  const rangeStart = filteredTotal
    ? pagination.pageIndex * pagination.pageSize + 1
    : 0
  const rangeEnd = filteredTotal
    ? Math.min(rangeStart + table.getRowModel().rows.length - 1, filteredTotal)
    : 0

  return (
    <>
      <DataTableHeader
        search={{
          ariaLabel: "Buscar elementos",
          onChange: (value) => {
            table.getColumn("search")?.setFilterValue(value || undefined)
            table.setPageIndex(0)
          },
          placeholder: "Buscar elementos...",
          value: searchQuery,
        }}
      />
      <CardContent className="flex flex-col gap-4 px-0">
        <DataTableToolbar>
          <DataTableFilter
            ariaLabel="Filtrar por área"
            label="Área"
            onValueChange={(value) => {
              table
                .getColumn("category")
                ?.setFilterValue(value === "all" ? undefined : value)
              table.setPageIndex(0)
            }}
            options={categoryOptions}
            value={categoryFilter}
          />
          <DataTableFilter
            ariaLabel="Ordenar elementos"
            label="Orden"
            onValueChange={(value) => {
              table.setSorting(
                sortOptionState[value as keyof typeof sortOptionState] ??
                  sortOptionState["name-asc"]
              )
              table.setPageIndex(0)
            }}
            options={sortOptions}
            value={sortValue}
          />
        </DataTableToolbar>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center"
                >
                  No hay elementos que coincidan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          canGoNext={table.getCanNextPage()}
          canGoPrevious={table.getCanPreviousPage()}
          itemLabel="indicadores"
          onNextPage={() => table.nextPage()}
          onPreviousPage={() => table.previousPage()}
          rangeEnd={rangeEnd}
          rangeStart={rangeStart}
          total={filteredTotal}
        />
      </CardContent>
    </>
  )
}
