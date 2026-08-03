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
import { ArrowUpDown, Search, Tags } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
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

export function DashboardOverviewTable({ data }: { data: DashboardOverviewRow[] }) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "title", desc: false }])
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

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? ""
  const categoryFilter = (table.getColumn("category")?.getFilterValue() as string | undefined) ?? "all"
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0]

    if (!currentSort) return "name-asc"
    if (currentSort.id === "title" && !currentSort.desc) return "name-asc"
    if (currentSort.id === "title" && currentSort.desc) return "name-desc"
    if (currentSort.id === "category" && !currentSort.desc) return "category-asc"

    return "name-asc"
  }, [sorting])

  const filteredTotal = table.getFilteredRowModel().rows.length
  const rangeStart = filteredTotal ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const rangeEnd = filteredTotal ? Math.min(rangeStart + table.getRowModel().rows.length - 1, filteredTotal) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
              placeholder="Buscar elementos..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined)
                table.setPageIndex(0)
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Tags data-icon="inline-start" />
                Área
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-35" align="start">
              <DropdownMenuRadioGroup
                value={categoryFilter}
                onValueChange={(value) => {
                  table.getColumn("category")?.setFilterValue(value === "all" ? undefined : value)
                  table.setPageIndex(0)
                }}
              >
                {categoryOptions.map((category) => (
                  <DropdownMenuRadioItem key={category.value} value={category.value}>
                    {category.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown data-icon="inline-start" />
              Ordenar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sortValue}
              onValueChange={(value) => {
                table.setSorting(sortOptionState[value as keyof typeof sortOptionState] ?? sortOptionState["name-asc"])
                table.setPageIndex(0)
              }}
            >
              {sortOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/15">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No hay elementos que coincidan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        canGoNext={table.getCanNextPage()}
        canGoPrevious={table.getCanPreviousPage()}
        itemLabel="elementos"
        locale="es"
        mode="detailed"
        onFirstPage={() => table.setPageIndex(0)}
        onLastPage={() => table.setPageIndex(Math.max(table.getPageCount() - 1, 0))}
        onNextPage={() => table.nextPage()}
        onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
        onPreviousPage={() => table.previousPage()}
        page={pagination.pageIndex + 1}
        pageCount={Math.max(table.getPageCount(), 1)}
        pageSize={pagination.pageSize}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
        summary={`${table.getFilteredSelectedRowModel().rows.length} de ${filteredTotal} elemento(s) seleccionado(s).`}
        total={filteredTotal}
      />
    </div>
  )
}
