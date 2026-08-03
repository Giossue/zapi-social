export type DashboardMetricIcon =
  "ai" | "calendar" | "channels" | "files" | "storage" | "templates"

export type DashboardToolIcon = "content" | "image" | "repurpose" | "timing"

export type DashboardAttentionIcon =
  "ai" | "channels" | "credits" | "publishing"

export type DashboardAction = {
  label: string
  href: string
}

export type DashboardMetric = {
  label: string
  value: string
  description?: string
  icon: DashboardMetricIcon
}

export type DashboardTool = DashboardAction & {
  uses: number
  icon: DashboardToolIcon
}

export type DashboardAttention = DashboardAction & {
  description: string
  icon: DashboardAttentionIcon
}

export type PortalDashboard = {
  welcome: {
    name: string
  }
  primaryAction: DashboardAction
  workspace: DashboardMetric[]
  tools: DashboardTool[]
  publishing: DashboardMetric[]
  library: DashboardMetric[]
  attention: DashboardAttention[]
}
