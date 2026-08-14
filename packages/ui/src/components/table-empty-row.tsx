import type { ComponentProps } from "react"

import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableCell, TableRow } from "@workspace/ui/components/table"

type TableEmptyRowProps = ComponentProps<typeof EmptyState> & {
  /** Number of columns to span, so the row covers the whole table. */
  colSpan: number
}

/**
 * Empty state rendered as a table row instead of replacing the table, so the
 * column headers stay visible and the user can still see what the table holds.
 */
function TableEmptyRow({ colSpan, ...props }: TableEmptyRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      {/* The cell defaults to nowrap padding meant for data, neither of which
          suits a centred block of copy. */}
      <TableCell className="p-0 whitespace-normal" colSpan={colSpan}>
        <EmptyState {...props} />
      </TableCell>
    </TableRow>
  )
}

export { TableEmptyRow }
export type { TableEmptyRowProps }
