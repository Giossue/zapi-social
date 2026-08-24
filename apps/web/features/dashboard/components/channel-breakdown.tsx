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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import type { PortalDashboard } from "@workspace/contracts"
import { useDashboardLabels } from "@/lib/dashboard-labels"

type BreakdownDatum = PortalDashboard["channels"][number]

type BreakdownRow = { label: string; count: number }

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

function BreakdownBarChart({ data }: { data: BreakdownRow[] }) {
  const t = useTranslations("dashboard.portal.breakdown")
  const chartConfig = {
    count: { color: "var(--chart-1)", label: t("series") },
  } satisfies ChartConfig

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{
          left: 0,
          right: 48,
        }}
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
  )
}

export function ChannelBreakdown({
  channels,
  aiTools,
}: {
  channels: BreakdownDatum[]
  aiTools: BreakdownDatum[]
}) {
  const t = useTranslations("dashboard.portal.breakdown")
  const labels = useDashboardLabels()
  const channelRows = channels.map((row) => ({
    count: row.count,
    label: labels.provider(row.key),
  }))
  const toolRows = aiTools.map((row) => ({
    count: row.count,
    label: labels.aiKind(row.key),
  }))

  return (
    <Card className="h-full gap-2" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Tabs defaultValue="channels" className="flex flex-col gap-3">
          <TabsList
            className="w-full justify-start border-b px-2.5"
            variant="line"
          >
            <TabsTrigger className="flex-none font-normal" value="channels">
              {t("channels")}
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="tools">
              {t("aiTools")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="px-4">
            <BreakdownBarChart data={channelRows} />
          </TabsContent>

          <TabsContent value="tools" className="px-4">
            <BreakdownBarChart data={toolRows} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
