"use client"
"use no memo"

import type { MouseEvent, ReactNode } from "react"

import { flexRender, type Table as TableType } from "@tanstack/react-table"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import type { PortalChannelAccount } from "../../types/channels"

function preventPaginationNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
}

type ChannelsTableProps = {
  table: TableType<PortalChannelAccount>
  emptyState: ReactNode
  isFiltering: boolean
  canGoNext: boolean
  canGoPrevious: boolean
  onNextPage: () => void
  onPreviousPage: () => void
  rangeEnd: number
  rangeStart: number
  total: number
}

export function ChannelsTable({
  table,
  emptyState,
  isFiltering,
  canGoNext,
  canGoPrevious,
  onNextPage,
  onPreviousPage,
  rangeEnd,
  rangeStart,
  total,
}: ChannelsTableProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
          <TableHeader className="[&_tr]:border-t">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4 font-normal">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isFiltering ? (
              ["one", "two", "three"].map((item) => (
                <TableRow key={item}>
                  <TableCell className="px-3 py-4 align-middle" colSpan={table.getVisibleLeafColumns().length}>
                    <Skeleton className="h-10" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border/60 hover:bg-white/2.5"
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          <span>{total > 0 ? `${rangeStart}-${rangeEnd} de ${total}` : "0 canales"}</span>
        </div>

        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text=""
                className={!canGoPrevious ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  preventPaginationNavigation(event)
                  if (canGoPrevious) onPreviousPage()
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                text=""
                className={!canGoNext ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  preventPaginationNavigation(event)
                  if (canGoNext) onNextPage()
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
