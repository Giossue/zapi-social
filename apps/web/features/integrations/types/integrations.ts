export type IntegrationReadiness =
  "ready" | "incomplete" | "untested" | "disabled"

export type IntegrationTestState =
  "not-tested" | "testing" | "passed" | "failed"

export type IntegrationAuthMode = "oauth" | "basic"

export type IntegrationCapability = {
  id: string
  label: string
  description: string
  enabled: boolean
  callbackUrl?: string
}

export type IntegrationField = {
  id: string
  label: string
  value: string
  type?: "text" | "url" | "password" | "multiselect"
  required?: boolean
  readOnly?: boolean
  helper?: string
  placeholder?: string
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
  testState: IntegrationTestState
  capabilities: IntegrationCapability[]
  fields: IntegrationField[]
  checklist: IntegrationChecklistItem[]
  dataDeletionCallbackUrl?: string
}
