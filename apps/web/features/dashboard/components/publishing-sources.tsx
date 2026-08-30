"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  type LabelProps,
  XAxis,
  YAxis,
} from "recharts"
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

type SourceRow = PortalDashboard["publishingSources"][number] & {
  label: string
}

function renderValueLabel(props: LabelProps) {
  const { height, value, y } = props

  return (
    <text
      className="fill-foreground"
      dominantBaseline="middle"
      dx={-6}
      fontSize={14}
      textAnchor="end"
      x="100%"
      y={Number(y) + Number(height) / 2}
    >
      {value}
    </text>
  )
}

export function PublishingSources({
  sources,
}: {
  sources: PortalDashboard["publishingSources"]
}) {
  const t = useTranslations("dashboard.portal.sources")
  const labels: Record<string, string> = {
    ai: t("source.ai"),
    automation: t("source.automation"),
    bulk: t("source.bulk"),
    portal: t("source.portal"),
    rss: t("source.rss"),
  }
  const chartConfig = {
    count: { color: "var(--chart-1)", label: t("series") },
  } satisfies ChartConfig
  const data: SourceRow[] = sources.map((source) => ({
    ...source,
    label: labels[source.key] ?? source.key,
  }))

  return (
    <Card className="h-full" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 48 }}
            >
              <CartesianGrid horizontal={false} vertical={false} />
              <YAxis
                dataKey="label"
                hide
                tickLine={false}
                tickMargin={10}
                type="category"
              />
              <XAxis dataKey="count" hide type="number" />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Bar
                barSize={40}
                dataKey="count"
                fill="var(--color-count)"
                fillOpacity={0.5}
                radius={8}
              >
                <LabelList
                  className="fill-foreground"
                  dataKey="label"
                  fontSize={14}
                  offset={12}
                  position="insideLeft"
                />
                <LabelList content={renderValueLabel} dataKey="count" />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
