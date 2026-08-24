import type { ComponentProps } from "react"
import { CircleAlert, type LucideIcon } from "lucide-react"

import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableCell, TableRow } from "@workspace/ui/components/table"

const TABLE_EMPTY_ICON = CircleAlert

type TableEmptyRowProps = Omit<ComponentProps<typeof EmptyState>, "icon"> & {
  colSpan: number
  icon?: LucideIcon
}

function TableEmptyRow({
  colSpan,
  icon = TABLE_EMPTY_ICON,
  ...props
}: TableEmptyRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="p-0 whitespace-normal" colSpan={colSpan}>
        <EmptyState {...props} icon={icon} />
      </TableCell>
    </TableRow>
  )
}

export { TABLE_EMPTY_ICON, TableEmptyRow }
export type { TableEmptyRowProps }
