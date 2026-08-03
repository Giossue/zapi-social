import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpRight, FolderOpen, Megaphone, TriangleAlert } from "lucide-react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"

import type { DashboardOverviewRow } from "./schema"

const categoryIcons = {
  Atención: TriangleAlert,
  Publicación: Megaphone,
  Biblioteca: FolderOpen,
} as const

function CategoryIcon({ category }: { category: DashboardOverviewRow["category"] }) {
  const Icon = categoryIcons[category]

  return <Icon className="size-4 text-muted-foreground" />
}

export const dashboardOverviewColumns: ColumnDef<DashboardOverviewRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todos los elementos de esta página"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Seleccionar ${row.original.title}`}
        />
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: "Elemento",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
          <CategoryIcon category={row.original.category} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm leading-none">{row.original.title}</span>
              {row.original.detail ? (
                <span className="truncate text-muted-foreground text-xs leading-none">{row.original.detail}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: "search",
    accessorFn: (row) => `${row.category} ${row.title} ${row.detail} ${row.value}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "category",
    header: "Área",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.category}
      </Badge>
    ),
  },
  {
    accessorKey: "value",
    header: "Valor",
    cell: ({ row }) => <span className="text-sm">{row.original.value || "—"}</span>,
  },
  {
    id: "action",
    header: "",
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link href={row.original.href}>
          Abrir
          <ArrowUpRight data-icon="inline-end" />
        </Link>
      </Button>
    ),
    enableHiding: false,
  },
]
