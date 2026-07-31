export type IntegrationReadiness = "ready" | "incomplete" | "disabled"
export type IntegrationAuthMode = "oauth" | "basic"

export type IntegrationCapability = {
  id: string
  label: string
  description: string
  callbackUrl?: string
}

export type IntegrationField = {
  id: string
  label: string
  value: string
  type?: "text" | "url" | "password"
  required?: boolean
  readOnly?: boolean
  helper?: string
  hasStoredSecret?: boolean
}

export type IntegrationChecklistItem = {
  id: string
  label: string
  complete: boolean
}

export type IntegrationProvider = {
  id: string
  label: string
  description: string
  authMode: IntegrationAuthMode
  enabled: boolean
  readiness: IntegrationReadiness
  capabilities: IntegrationCapability[]
  fields: IntegrationField[]
  checklist: IntegrationChecklistItem[]
  dataDeletionCallbackUrl?: string
}
