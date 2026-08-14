import type { ComponentProps } from "react"
import { CircleAlert, type LucideIcon } from "lucide-react"

import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableCell, TableRow } from "@workspace/ui/components/table"

/** Single icon shared by every empty table across Admin and Portal. */
const TABLE_EMPTY_ICON = CircleAlert

type TableEmptyRowProps = Omit<ComponentProps<typeof EmptyState>, "icon"> & {
  /** Number of columns to span, so the row covers the whole table. */
  colSpan: number
  /**
   * Every empty table reads the same, so the icon is shared by default and
   * call sites are not expected to pass one.
   */
  icon?: LucideIcon
}

/**
 * Empty state rendered as a table row instead of replacing the table, so the
 * column headers stay visible and the user can still see what the table holds.
 */
function TableEmptyRow({
  colSpan,
  icon = TABLE_EMPTY_ICON,
  ...props
}: TableEmptyRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      {/* The cell defaults to nowrap padding meant for data, neither of which
          suits a centred block of copy. */}
      <TableCell className="p-0 whitespace-normal" colSpan={colSpan}>
        {/* The icon comes last so a spread props object cannot override it. */}
        <EmptyState {...props} icon={icon} />
      </TableCell>
    </TableRow>
  )
}

export { TABLE_EMPTY_ICON, TableEmptyRow }
export type { TableEmptyRowProps }
