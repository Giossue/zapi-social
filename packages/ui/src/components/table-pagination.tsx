"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { MouseEvent, ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"

type TablePaginationBaseProps = {
  itemLabel: string
  rangeEnd: number
  rangeStart: number
  total: number
}

type CompactTablePaginationProps = TablePaginationBaseProps & {
  canGoNext: boolean
  canGoPrevious: boolean
  mode: "compact"
  onNextPage: () => void
  onPreviousPage: () => void
}

type DetailedTablePaginationProps = TablePaginationBaseProps & {
  canGoNext: boolean
  canGoPrevious: boolean
  locale?: "en" | "es"
  mode: "detailed"
  onFirstPage: () => void
  onLastPage: () => void
  onNextPage: () => void
  onPageSizeChange: (pageSize: number) => void
  onPreviousPage: () => void
  page: number
  pageCount: number
  pageSize: number
  summary?: ReactNode
}

type TablePaginationProps = CompactTablePaginationProps | DetailedTablePaginationProps

function preventPaginationNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
}

function rangeLabel({ itemLabel, rangeEnd, rangeStart, total }: TablePaginationBaseProps) {
  return total > 0 ? `${rangeStart}-${rangeEnd} de ${total}` : `0 ${itemLabel}`
}

function TablePagination(props: TablePaginationProps) {
  const range = rangeLabel(props)

  if (props.mode === "detailed") {
    const isSpanish = props.locale !== "en"
    const rowsPerPageLabel = isSpanish ? "Filas por página" : "Rows per page"
    const pageLabel = isSpanish ? "Página" : "Page"
    const pageConnector = isSpanish ? "de" : "of"

    return (
      <div className="flex items-center justify-between px-1">
        <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">{props.summary ?? range}</div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="font-medium text-sm">{rowsPerPageLabel}</span>
            <Select value={`${props.pageSize}`} onValueChange={(value) => props.onPageSizeChange(Number(value))}>
              <SelectTrigger size="sm" className="w-20" aria-label={rowsPerPageLabel}>
                <SelectValue placeholder={props.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center font-medium text-sm">
            {pageLabel} {props.page} {pageConnector} {props.pageCount}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              aria-label={isSpanish ? "Ir a la primera página" : "Go to first page"}
              className="hidden size-8 lg:flex"
              disabled={!props.canGoPrevious}
              onClick={props.onFirstPage}
              size="icon"
              variant="outline"
            >
              <ChevronsLeft />
            </Button>
            <Button
              aria-label={isSpanish ? "Ir a la página anterior" : "Go to previous page"}
              className="size-8"
              disabled={!props.canGoPrevious}
              onClick={props.onPreviousPage}
              size="icon"
              variant="outline"
            >
              <ChevronLeft />
            </Button>
            <Button
              aria-label={isSpanish ? "Ir a la página siguiente" : "Go to next page"}
              className="size-8"
              disabled={!props.canGoNext}
              onClick={props.onNextPage}
              size="icon"
              variant="outline"
            >
              <ChevronRight />
            </Button>
            <Button
              aria-label={isSpanish ? "Ir a la última página" : "Go to last page"}
              className="hidden size-8 lg:flex"
              disabled={!props.canGoNext}
              onClick={props.onLastPage}
              size="icon"
              variant="outline"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Separator />
      <div className="flex items-center justify-between px-4">
        <span className="text-muted-foreground text-sm">{range}</span>
        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!props.canGoPrevious}
                className={!props.canGoPrevious ? "pointer-events-none opacity-50" : undefined}
                href="#"
                text=""
                onClick={(event) => {
                  preventPaginationNavigation(event)
                  if (props.canGoPrevious) props.onPreviousPage()
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-disabled={!props.canGoNext}
                className={!props.canGoNext ? "pointer-events-none opacity-50" : undefined}
                href="#"
                text=""
                onClick={(event) => {
                  preventPaginationNavigation(event)
                  if (props.canGoNext) props.onNextPage()
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </>
  )
}

export { TablePagination }
