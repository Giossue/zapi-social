"use client"

import type { LucideIcon } from "lucide-react"
import { Clock3, FileText, Image, Recycle, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { Bar, BarChart, type BarShapeProps, XAxis, YAxis } from "recharts"

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
import { useDashboardLabels } from "@/lib/dashboard-labels"

const kindIcons: Record<string, LucideIcon> = {
  content: FileText,
  image: Image,
  repurpose: Recycle,
  timing: Clock3,
}

type UsageDay = PortalDashboard["aiUsage"]["days"][number]

function createUsageBarShape(maxCount: number) {
  return function UsageBarShape(props: BarShapeProps) {
    const { height, payload, width, x, y } = props
    const barPayload = payload as UsageDay | undefined
    const barHeightValue = Number(height)
    const barWidthValue = Number(width)
    const xValue = Number(x)
    const yValue = Number(y)
    const requests = barPayload?.count ?? 0
    const fill = "var(--color-count)"
    const fillOpacity = requests >= maxCount * 0.8 ? 0.95 : 0.4
    const baselineY = yValue + barHeightValue - 2
    const barGap = 4
    const barHeight = Math.max(0, barHeightValue - barGap)

    return (
      <g>
        <rect
          x={xValue}
          y={baselineY}
          width={barWidthValue}
          height={2}
          rx={1}
          fill={fill}
          fillOpacity={requests === 0 ? 0.25 : fillOpacity}
        />
        {requests > 0 && barHeight > 0 ? (
          <rect
            x={xValue}
            y={yValue}
            width={barWidthValue}
            height={barHeight}
            rx={2}
            fill={fill}
            fillOpacity={fillOpacity}
          />
        ) : null}
      </g>
    )
  }
}

export function AiUsage({ aiUsage }: { aiUsage: PortalDashboard["aiUsage"] }) {
  const t = useTranslations("dashboard.portal.aiUsage")
  const labels = useDashboardLabels()
  const maxCount = Math.max(...aiUsage.days.map((item) => item.count), 1)
  const chartConfig = {
    count: { color: "var(--chart-3)", label: t("series") },
  } satisfies ChartConfig

  return (
    <Card className="h-full" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl leading-none tracking-tight tabular-nums">
            {aiUsage.creditsUsed}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("creditsUsed")}
          </span>
        </div>
        <ChartContainer config={chartConfig} className="h-36 w-full">
          <BarChart
            data={aiUsage.days}
            margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
            barCategoryGap={3}
          >
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, maxCount + 2]} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              shape={createUsageBarShape(maxCount)}
            />
          </BarChart>
        </ChartContainer>
        {aiUsage.kinds.length ? (
          <div className="grid grid-cols-2">
            {aiUsage.kinds.map((kind, index) => {
              const Icon = kindIcons[kind.key] ?? Sparkles
              const isLeft = index % 2 === 0
              const isTop = index < 2

              return (
                <div
                  className={[
                    "flex items-center gap-3",
                    isLeft ? "border-r border-border/50 pr-5" : "pl-5",
                    isTop ? "border-b border-border/50 pt-1 pb-4" : "pt-4 pb-1",
                  ].join(" ")}
                  key={kind.key}
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {labels.aiKind(kind.key)}
                  </span>
                  <span className="text-sm tabular-nums">{kind.count}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  )
}
