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
        {payments.length ? (
          <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
            <TableHeader className="[&_tr]:border-border/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8" />
                <TableHead className="h-8 w-36 font-normal">
                  Workspace
                </TableHead>
                <TableHead className="h-8 w-28 font-normal">Estado</TableHead>
                <TableHead className="h-8 w-24 text-right font-normal">
                  Importe
                </TableHead>
                <TableHead className="h-8 w-32 text-right font-normal">
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
                    <TableCell className="max-w-0 truncate text-muted-foreground">
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
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {dateFormatter.format(new Date(payment.date))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center px-4 text-muted-foreground text-sm">
            Sin pagos registrados todavía.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
