"use client"

import { Area, CartesianGrid, ComposedChart, XAxis } from "recharts"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { DashboardTool } from "@/features/dashboard/types/dashboard"

const chartConfig = {
  uses: {
    label: "Usos",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function PerformanceOverview({ tools }: { tools: DashboardTool[] }) {
  const chartData = tools.map((tool) => ({
    label: tool.label,
    uses: tool.uses,
  }))
  const primaryTool = tools[0]

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Uso de herramientas AI</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Usos registrados por cada herramienta de tu espacio de trabajo</span>
          <span className="@[540px]/card:hidden">Usos por herramienta</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select defaultValue="tools">
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="Herramientas" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Vista</SelectLabel>
                <SelectItem value="tools">Herramientas</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="uses">
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Usos" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Métrica</SelectLabel>
                <SelectItem value="uses">Usos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {primaryTool ? (
            <Button asChild variant="outline" size="sm">
              <Link href={primaryTool.href}>Abrir herramienta</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Abrir herramienta
            </Button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <ComposedChart data={chartData} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillUses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-uses)" stopOpacity={0.36} />
                <stop offset="95%" stopColor="var(--color-uses)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />

            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} />

            <ChartTooltip cursor={false} content={<ChartTooltipContent className="w-50" indicator="line" />} />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />

            <Area
              dataKey="uses"
              type="natural"
              fill="url(#fillUses)"
              stroke="var(--color-uses)"
              strokeWidth={1.25}
              dot={false}
              fillOpacity={1}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
