"use client"

import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

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

import type { AdminDashboard } from "@workspace/contracts"

const chartConfig = {
  current: {
    color: "var(--chart-3)",
    label: "Últimas 4 semanas",
  },
  previous: {
    color: "var(--muted-foreground)",
    label: "Periodo anterior",
  },
} satisfies ChartConfig

const weeklyTicks = [4, 11, 18, 25]

function formatWeek(value: number) {
  const weekIndex = weeklyTicks.indexOf(value)

  return weekIndex >= 0 ? `Semana ${weekIndex + 1}` : ""
}

export function UserGrowth({
  data,
}: {
  data: AdminDashboard["userGrowth"]
}) {
  const chartData = data.map((point, index) => ({ ...point, day: index + 1 }))

  return (
    <Card className="h-full" variant="subtle">
      <CardHeader>
        <CardTitle className="font-normal">Crecimiento de usuarios</CardTitle>
        <CardDescription>
          Registros por día frente al periodo anterior.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-68 w-full">
          <ComposedChart
            data={chartData}
            margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              domain={[1, 28]}
              interval={0}
              tickFormatter={formatWeek}
              tickLine={false}
              tickMargin={14}
              ticks={weeklyTicks}
              type="number"
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              width={34}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="w-48"
                  labelFormatter={() => "Registros"}
                />
              }
            />
            <Line
              dataKey="previous"
              dot={false}
              stroke="var(--color-previous)"
              strokeOpacity={0.65}
              strokeDasharray="4 4"
              strokeWidth={1.75}
              type="linear"
            />
            <Line
              dataKey="current"
              dot={false}
              activeDot={{ r: 4 }}
              stroke="var(--color-current)"
              strokeWidth={2.5}
              type="linear"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
