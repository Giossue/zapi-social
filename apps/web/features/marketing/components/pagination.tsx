import Link from "next/link"

import { cn } from "@workspace/ui/lib/utils"

interface MarketingPaginationProps {
  basePath: string
  query?: string
  page: number
  limit: number
  total: number
  rangeLabel: string
  previousLabel: string
  nextLabel: string
}

function hrefFor(basePath: string, page: number, query?: string) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (page > 1) params.set("page", String(page))
  const serialized = params.toString()
  return serialized ? `${basePath}?${serialized}` : basePath
}

const linkClass =
  "rounded-md border border-foreground/10 px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"

const MarketingPagination = ({
  basePath,
  query,
  page,
  limit,
  total,
  rangeLabel,
  previousLabel,
  nextLabel,
}: MarketingPaginationProps) => {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  if (lastPage <= 1) return null

  return (
    <div className="mx-auto mt-10 flex w-full max-w-3xl items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{rangeLabel}</span>
      <div className="flex items-center gap-2">
        <Link
          href={hrefFor(basePath, page - 1, query)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(
            linkClass,
            page <= 1 && "pointer-events-none opacity-40"
          )}
        >
          {previousLabel}
        </Link>
        <Link
          href={hrefFor(basePath, page + 1, query)}
          aria-disabled={page >= lastPage}
          tabIndex={page >= lastPage ? -1 : undefined}
          className={cn(
            linkClass,
            page >= lastPage && "pointer-events-none opacity-40"
          )}
        >
          {nextLabel}
        </Link>
      </div>
    </div>
  )
}

export default MarketingPagination
