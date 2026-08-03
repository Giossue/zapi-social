export type CommercePeriod = "month" | "quarter" | "year"

export type CommerceChannel = "all" | "social" | "store" | "marketplace"

export type CommerceMetric = {
  id: "sales" | "orders" | "average" | "returns"
  label: string
  value: string
  change: string
  context: string
  trend: "up" | "down"
}

export type InventoryItem = {
  id: string
  name: string
  sku: string
  available: number
  reserved: number
  status: "healthy" | "low" | "out"
}

export type CommerceOrder = {
  id: string
  customer: string
  channel: Exclude<CommerceChannel, "all">
  itemCount: number
  total: string
  status: "completed" | "attention" | "processing"
  updatedAt: string
}

export type CommerceDashboardData = {
  canView: boolean
  metrics: readonly CommerceMetric[]
  inventory: readonly InventoryItem[]
  orders: readonly CommerceOrder[]
}
