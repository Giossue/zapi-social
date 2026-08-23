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

import type { AdminDashboard } from "@workspace/contracts"

const statusCopy = {
  failed: { label: "Fallido", variant: "destructive" },
  paid: { label: "Pagado", variant: "success" },
  partially_refunded: { label: "Reembolso parcial", variant: "warning" },
  pending: { label: "Pendiente", variant: "warning" },
  refunded: { label: "Reembolsado", variant: "secondary" },
} as const

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function RecentPayments({
  payments,
}: {
  payments: AdminDashboard["recentPayments"]
}) {
  return (
    <Card className="h-full gap-2" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">Últimos pagos</CardTitle>
        <CardDescription>
          Cobros recientes de planes y créditos.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8" />
              <TableHead className="hidden h-8 w-36 font-normal md:table-cell">
                Workspace
              </TableHead>
              <TableHead className="h-8 w-28 font-normal">Estado</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">
                Importe
              </TableHead>
              <TableHead className="hidden h-8 w-32 text-right font-normal sm:table-cell">
                Fecha
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {payments.map((payment, index) => {
              const status = statusCopy[payment.status]
              const amountFormatter = new Intl.NumberFormat("es", {
                style: "currency",
                currency: payment.currency,
              })

              return (
                <TableRow
                  className="hover:bg-transparent"
                  key={`${payment.workspace}-${payment.date}-${index}`}
                >
                  <TableCell className="max-w-0 truncate py-4 font-medium">
                    {payment.product}
                  </TableCell>
                  <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                    {payment.workspace}
                  </TableCell>
                  <TableCell>
                    <Badge className="leading-none" variant={status.variant}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {amountFormatter.format(payment.amountMinor / 100)}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {dateFormatter.format(new Date(payment.date))}
                  </TableCell>
                </TableRow>
              )
            })}
            {payments.length === 0 ? (
              <TableEmptyRow
                colSpan={5}
                description="Los cobros de planes y créditos aparecerán aquí."
                title="Sin pagos registrados"
              />
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
