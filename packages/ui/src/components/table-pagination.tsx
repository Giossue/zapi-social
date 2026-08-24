"use client"

import type { MouseEvent } from "react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { Separator } from "@workspace/ui/components/separator"

type TablePaginationProps = {
  rangeLabel: string
  canGoNext: boolean
  canGoPrevious: boolean
  onNextPage: () => void
  onPreviousPage: () => void
}

function preventPaginationNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
}

function TablePagination(props: TablePaginationProps) {
  const range = props.rangeLabel

  return (
    <>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4">
        <span className="text-sm text-muted-foreground">{range}</span>
        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!props.canGoPrevious}
                className={
                  !props.canGoPrevious
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
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
                className={
                  !props.canGoNext
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
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
