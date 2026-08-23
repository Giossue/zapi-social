"use client"

import { useFormatter, useTranslations } from "next-intl"

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

const statusVariants = {
  failed: "destructive",
  paid: "success",
  partially_refunded: "warning",
  pending: "warning",
  refunded: "secondary",
} as const

export function RecentPayments({
  payments,
}: {
  payments: AdminDashboard["recentPayments"]
}) {
  const t = useTranslations("dashboard.admin.payments")
  const format = useFormatter()

  return (
    <Card className="h-full gap-2" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8" />
              <TableHead className="hidden h-8 w-36 font-normal md:table-cell">
                {t("workspace")}
              </TableHead>
              <TableHead className="h-8 w-28 font-normal">
                {t("statusColumn")}
              </TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">
                {t("amount")}
              </TableHead>
              <TableHead className="hidden h-8 w-32 text-right font-normal sm:table-cell">
                {t("date")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {payments.map((payment, index) => {
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
                    <Badge
                      className="leading-none"
                      variant={statusVariants[payment.status]}
                    >
                      {t(`status.${payment.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.number(payment.amountMinor / 100, {
                      currency: payment.currency,
                      style: "currency",
                    })}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {format.dateTime(new Date(payment.date), {
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                    })}
                  </TableCell>
                </TableRow>
              )
            })}
            {payments.length === 0 ? (
              <TableEmptyRow
                colSpan={5}
                description={t("emptyDescription")}
                title={t("emptyTitle")}
              />
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
