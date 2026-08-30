"use client"

import { Label, Pie, PieChart } from "recharts"
import { useTranslations } from "next-intl"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"

import type { PortalDashboard } from "@workspace/contracts"

type PublishingStatusDatum = PortalDashboard["publishingStatuses"][number]

export function PublishingStatus({
  statuses,
}: {
  statuses: PublishingStatusDatum[]
}) {
  const t = useTranslations("dashboard.portal.status")
  const chartConfig = {
    draft: { color: "var(--chart-4)", label: t("status.draft") },
    failed: { color: "var(--destructive)", label: t("status.failed") },
    processing: { color: "var(--chart-1)", label: t("status.processing") },
    published: { color: "var(--chart-2)", label: t("status.published") },
    scheduled: { color: "var(--chart-3)", label: t("status.scheduled") },
  } satisfies ChartConfig
  const total = statuses.reduce((sum, item) => sum + item.count, 0)
  const chartData = statuses
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, fill: `var(--color-${item.status})` }))

  return (
    <Card className="h-full" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        {total ? (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-50"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="w-44"
                    nameKey="status"
                  />
                }
              />
              <Pie
                cornerRadius={6}
                data={chartData}
                dataKey="count"
                innerRadius={65}
                nameKey="status"
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                      return null
                    }

                    return (
                      <text
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x={viewBox.cx}
                        y={viewBox.cy}
                      >
                        <tspan
                          className="fill-muted-foreground text-xs"
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) - 8}
                        >
                          {t("total")}
                        </tspan>
                        <tspan
                          className="fill-foreground text-lg font-medium tabular-nums"
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 14}
                        >
                          {total}
                        </tspan>
                      </text>
                    )
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex h-50 items-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-3">
          {statuses.map((item) => (
            <div
              className="grid grid-cols-[1fr_auto] items-end gap-3"
              key={item.status}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--color-${item.status})` }}
                />
                <p className="truncate text-sm text-muted-foreground">
                  {t(`status.${item.status}`)}
                </p>
              </div>
              <p className="font-medium tabular-nums">{item.count}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
