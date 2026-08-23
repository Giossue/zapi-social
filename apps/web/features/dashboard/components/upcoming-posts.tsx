import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"

import type { PortalDashboard } from "@workspace/contracts"

const statusCopy = {
  draft: { label: "Borrador", variant: "secondary" },
  scheduled: { label: "Programada", variant: "success" },
} as const

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function UpcomingPosts({
  upcoming,
}: {
  upcoming: PortalDashboard["upcoming"]
}) {
  return (
    <Card className="h-full gap-2" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">Próximas publicaciones</CardTitle>
        <CardDescription>
          Lo siguiente en tu calendario de contenido.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8" />
              <TableHead className="hidden h-8 w-28 font-normal md:table-cell">
                Canal
              </TableHead>
              <TableHead className="h-8 w-28 font-normal">Estado</TableHead>
              <TableHead className="h-8 w-32 text-right font-normal">
                Fecha
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {upcoming.map((post, index) => {
              const status = statusCopy[post.status]

              return (
                <TableRow
                  className="hover:bg-transparent"
                  key={`${post.content}-${index}`}
                >
                  <TableCell className="max-w-0 truncate py-4 font-medium">
                    {post.content || "Sin contenido"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {post.channel}
                  </TableCell>
                  <TableCell>
                    <Badge className="leading-none" variant={status.variant}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {post.date ? dateFormatter.format(new Date(post.date)) : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
            {upcoming.length === 0 ? (
              <TableEmptyRow
                colSpan={4}
                description="Programa una publicación para verla aquí."
                title="Sin publicaciones próximas"
              />
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
