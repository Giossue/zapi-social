"use client"
"use no memo"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"

import { flexRender, type Table as TableType } from "@tanstack/react-table"

import { Spinner } from "@workspace/ui/components/spinner"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { PortalChannelAccount } from "../../types/channels"

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
  const t = useTranslations("channels")

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={header.column.columnDef.meta?.className}
                    key={header.id}
                  >
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
            {isFiltering ? (
              ["one", "two", "three"].map((item) => (
                <TableRow key={item}>
                  <TableCell colSpan={table.getVisibleLeafColumns().length}>
                    <div className="flex h-10 items-center justify-center">
                      <Spinner aria-label={t("filtering")} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={cell.column.columnDef.meta?.className}
                      key={cell.id}
                    >
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
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        itemLabel={t("itemLabel")}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
        total={total}
      />
    </div>
  )
}
