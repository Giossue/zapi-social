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

import type { AdminDashboard } from "@workspace/contracts"

const chartConfig = {
  count: {
    color: "var(--chart-1)",
    label: "Total",
  },
} satisfies ChartConfig

type BreakdownDatum = AdminDashboard["plans"][number]

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

function BreakdownBarChart({ data }: { data: BreakdownDatum[] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        Sin datos en las últimas 4 semanas.
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

export function PlanBreakdown({
  plans,
  aiTools,
}: {
  plans: BreakdownDatum[]
  aiTools: BreakdownDatum[]
}) {
  return (
    <Card className="h-full gap-2" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">
          Distribución de la plataforma
        </CardTitle>
        <CardDescription>
          Suscripciones por plan y uso AI por herramienta.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Tabs defaultValue="plans" className="flex flex-col gap-3">
          <TabsList
            className="w-full justify-start border-b px-2.5"
            variant="line"
          >
            <TabsTrigger className="flex-none font-normal" value="plans">
              Planes
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="ai">
              Herramientas AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="px-4">
            <BreakdownBarChart data={plans} />
          </TabsContent>

          <TabsContent value="ai" className="px-4">
            <BreakdownBarChart data={aiTools} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
