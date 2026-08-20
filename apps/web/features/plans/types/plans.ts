export type PlanStatus = "active" | "inactive"
export type PlanBillingType = "monthly" | "yearly"

export type PlanPermission = {
  id: string
  label: string
  description: string
}

export type PlanPermissionGroup = {
  id: string
  label: string
  permissions: readonly PlanPermission[]
}

export type AdminPlan = {
  id: string
  name: string
  slug: string
  status: PlanStatus
  featured: boolean
  currency: "USD"
  price: number
  billingType: PlanBillingType
  isFree: boolean
  isDefaultSignup: boolean
  trialDays: number
  position: number
  description: string
  subscriberCount: number
  permissionIds: readonly string[]
}
