export type AdminMetric = {
  label: string
  value: string
  description: string
}

export type AdminActivity = {
  title: string
  description: string
  status: "healthy" | "attention"
}

export type AdminDashboard = {
  metrics: readonly AdminMetric[]
  activity: readonly AdminActivity[]
}
