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

import type { PortalDashboard } from "@workspace/contracts"
import { useDashboardLabels } from "@/lib/dashboard-labels"

const statusVariants = {
  draft: "secondary",
  scheduled: "success",
} as const

export function UpcomingPosts({
  upcoming,
}: {
  upcoming: PortalDashboard["upcoming"]
}) {
  const t = useTranslations("dashboard.portal.upcoming")
  const format = useFormatter()
  const labels = useDashboardLabels()

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
              <TableHead className="hidden h-8 w-28 font-normal md:table-cell">
                {t("channel")}
              </TableHead>
              <TableHead className="h-8 w-28 font-normal">
                {t("statusColumn")}
              </TableHead>
              <TableHead className="h-8 w-32 text-right font-normal">
                {t("date")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {upcoming.map((post, index) => {
              return (
                <TableRow
                  className="hover:bg-transparent"
                  key={`${post.content}-${index}`}
                >
                  <TableCell className="max-w-0 truncate py-4 font-medium">
                    {post.content || t("noContent")}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {labels.provider(post.channelKey)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className="leading-none"
                      variant={statusVariants[post.status]}
                    >
                      {t(`status.${post.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {post.date
                      ? format.dateTime(new Date(post.date), {
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
            {upcoming.length === 0 ? (
              <TableEmptyRow
                colSpan={4}
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
