import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FolderOpen,
  HardDrive,
  Image,
  Layers3,
  Link2Off,
  PenLine,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  Zap,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type {
  DashboardAttention,
  DashboardAttentionIcon,
  DashboardMetric,
  DashboardMetricIcon,
  DashboardTool,
  DashboardToolIcon,
  PortalDashboard,
} from "@/features/dashboard/types/dashboard"

const metricIcons: Record<DashboardMetricIcon, LucideIcon> = {
  ai: Sparkles,
  calendar: CalendarDays,
  channels: Share2,
  files: Image,
  storage: HardDrive,
  templates: Layers3,
}

const toolIcons: Record<DashboardToolIcon, LucideIcon> = {
  content: PenLine,
  image: WandSparkles,
  repurpose: RefreshCw,
  timing: Clock3,
}

const attentionIcons: Record<DashboardAttentionIcon, LucideIcon> = {
  ai: Sparkles,
  channels: Link2Off,
  credits: Zap,
  publishing: TriangleAlert,
}

type DashboardSectionProps = {
  title: string
  description: string
  action?: {
    label: string
    href: string
    icon: LucideIcon
    variant?: "default" | "secondary" | "brand-secondary"
  }
  children?: React.ReactNode
}

function DashboardSection({ title, description, action, children }: DashboardSectionProps) {
  const ActionIcon = action?.icon

  return (
    <Card variant="subtle">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action ? (
          <Button asChild className="shrink-0" size="lg" variant={action.variant ?? "brand-secondary"}>
            <Link href={action.href}>
              {ActionIcon ? <ActionIcon data-icon="inline-start" /> : null}
              {action.label}
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metricIcons[metric.icon]

  return (
    <Card className="min-h-36" variant="inset">
      <CardContent className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-3">
          <p className={metric.value.length > 6 ? "text-2xl font-semibold tracking-tight whitespace-nowrap" : "text-3xl font-semibold tracking-tight"}>{metric.value}</p>
          <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{metric.label}</p>
          {metric.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{metric.description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function WorkflowCard({ tool }: { tool: DashboardTool }) {
  const Icon = toolIcons[tool.icon]

  return (
    <Link
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      href={tool.href}
    >
      <Card className="h-full" variant="interactive">
        <CardContent className="flex h-full items-center gap-3">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{tool.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tool.uses} {tool.uses === 1 ? "uso" : "usos"}
            </p>
          </div>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}

function AttentionRow({ item }: { item: DashboardAttention }) {
  const Icon = attentionIcons[item.icon]

  return (
    <Link
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      href={item.href}
    >
      <Card variant="interactive">
        <CardContent className="flex items-start gap-3">
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{item.label}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function PortalDashboardPage({ dashboard }: { dashboard: PortalDashboard }) {
  return (
    <div className="space-y-6">
      <DashboardSection
        description="Empieza por lo que está listo para publicar y continúa el trabajo AI que más utilizas."
        title={`Bienvenido, ${dashboard.welcome.name}`}
      />

      <DashboardSection
        action={{ ...dashboard.primaryAction, icon: Plus, variant: "default" }}
        description="Consulta qué está listo para publicar, qué utilizas más y qué necesita atención."
        title="Tu espacio de trabajo"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboard.workspace.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </DashboardSection>

      {dashboard.tools.length > 0 ? (
        <DashboardSection
          action={{ label: "Abrir AI Studio", href: "/portal/ai-studio/ai-content", icon: Sparkles }}
          description="Tus herramientas más utilizadas en este espacio de trabajo."
          title="Continúa tu trabajo AI"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.tools.map((tool) => (
              <WorkflowCard key={tool.href} tool={tool} />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection
          action={{ label: "Abrir calendario", href: "/portal/publishing/calendar", icon: CalendarDays }}
          description="Tu carga de publicaciones actual, de un vistazo."
          title="Publicación"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {dashboard.publishing.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          action={{ label: "Abrir archivos", href: "/portal/files", icon: FolderOpen }}
          description="Recursos y activos AI disponibles para tu espacio de trabajo."
          title="Biblioteca"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {dashboard.library.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </DashboardSection>
      </div>

      {dashboard.attention.length > 0 ? (
        <DashboardSection
          description="Resuelve estos elementos antes de tu próxima publicación o ejecución AI."
          title="Necesita atención"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {dashboard.attention.map((item) => (
              <AttentionRow item={item} key={item.href} />
            ))}
          </div>
        </DashboardSection>
      ) : null}
    </div>
  )
}
