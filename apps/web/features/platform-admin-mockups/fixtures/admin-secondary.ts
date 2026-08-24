import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  KeyRound,
  MailCheck,
  Pencil,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
  UserX,
} from "lucide-react"

export type AdminSecondaryModuleKey = "user-report" | "user-roles" | "teams"

export type AdminMockTone =
  "success" | "warning" | "info" | "neutral" | "destructive"

export type AdminMockRow = {
  id: string
  search: string
  statusKey: string
  tone: AdminMockTone
  values: readonly { primary: string; secondary?: string; mono?: boolean }[]
}

export type AdminPermissionOption = { key: string }

export type AdminMockField = {
  kind: "text" | "textarea" | "select" | "switch" | "display" | "permissions"
  labelKey: string
  hasDescription?: boolean
  name: string
  options?: readonly { labelKey: string; value: string }[]
  permissionActions?: readonly AdminPermissionOption[]
  permissionGroups?: readonly AdminPermissionOption[]
  hasPlaceholder?: boolean
  required?: boolean
  value: string | boolean | readonly string[]
}

export type AdminMockAction = {
  fields: readonly AdminMockField[]
  icon: LucideIcon
  mode: "create" | "edit" | "execute"
}

type AdminMockMetric = {
  key: string
  icon: LucideIcon
  value: string
}

export type AdminCollectionDefinition = {
  action?: AdminMockAction
  columnKeys: readonly string[]
  statusKeys: readonly string[]
  icon: LucideIcon
  kind: "collection"
  metrics?: readonly AdminMockMetric[]
  rows: readonly AdminMockRow[]
}

const text = (
  name: string,
  labelKey: string,
  value: string,
  required = true
): AdminMockField => ({
  kind: "text",
  labelKey,
  name,
  required,
  value,
})

const row = (
  id: string,
  values: AdminMockRow["values"],
  statusKey: string,
  tone: AdminMockTone
): AdminMockRow => ({
  id,
  search: values.flatMap((value) => [value.primary, value.secondary]).join(" "),
  statusKey,
  tone,
  values,
})

const permissionMatrix = (
  name: string,
  labelKey: string,
  groups: readonly AdminPermissionOption[],
  actions: readonly AdminPermissionOption[]
): AdminMockField => ({
  hasDescription: true,
  kind: "permissions",
  labelKey,
  name,
  permissionActions: actions,
  permissionGroups: groups,
  value: [],
})

const rolePermissionGroups: readonly AdminPermissionOption[] = [
  { key: "users" },
  { key: "roles" },
  { key: "plans" },
  { key: "payments" },
  { key: "content" },
  { key: "settings" },
]

const rolePermissionActions: readonly AdminPermissionOption[] = [
  { key: "view" },
  { key: "create" },
  { key: "edit" },
  { key: "delete" },
]

export const adminSecondaryDefinitions: Record<
  AdminSecondaryModuleKey,
  AdminCollectionDefinition
> = {
  "user-report": {
    columnKeys: ["user", "role", "plan", "signup"],
    statusKeys: ["verified", "unverified", "attention"],
    icon: BarChart3,
    kind: "collection",
    metrics: [
      { key: "user-report.users", value: "1.248", icon: Users },
      { key: "user-report.growth", value: "+18%", icon: TrendingUp },
      { key: "user-report.verified", value: "82%", icon: MailCheck },
      { key: "user-report.twoFactor", value: "38%", icon: ShieldCheck },
    ],
    rows: [
      row(
        "report-user-1",
        [
          { primary: "María Andrade", secondary: "@maria · ES" },
          { primary: "Cliente" },
          { primary: "Pro" },
          { primary: "Hoy, 09:24" },
        ],
        "verified",
        "success"
      ),
      row(
        "report-user-2",
        [
          { primary: "Daniel Vera", secondary: "@daniel · ES" },
          { primary: "Cliente" },
          { primary: "Starter" },
          { primary: "8 ago 2026" },
        ],
        "verified",
        "success"
      ),
      row(
        "report-user-3",
        [
          { primary: "Sofía Torres", secondary: "@sofia · EN" },
          { primary: "Sin rol" },
          { primary: "Sin plan" },
          { primary: "7 ago 2026" },
        ],
        "attention",
        "warning"
      ),
      row(
        "report-user-4",
        [
          { primary: "Lucas Prieto", secondary: "@lucas · ES" },
          { primary: "Soporte" },
          { primary: "Pro" },
          { primary: "6 ago 2026" },
        ],
        "unverified",
        "neutral"
      ),
      row(
        "report-user-5",
        [
          { primary: "Josue Admin", secondary: "@josue · ES" },
          { primary: "Super admin" },
          { primary: "Agencia" },
          { primary: "2 ago 2026" },
        ],
        "verified",
        "success"
      ),
    ],
  },
  "user-roles": {
    action: {
      icon: KeyRound,
      mode: "create",
      fields: [
        text("name", "field.name", ""),
        {
          kind: "textarea",
          labelKey: "field.description",
          name: "description",
          required: false,
          value: "",
        },
        permissionMatrix(
          "permissions",
          "field.permissions",
          rolePermissionGroups,
          rolePermissionActions
        ),
      ],
    },
    columnKeys: ["role", "users", "permissions"],
    statusKeys: ["unused", "inUse"],
    icon: KeyRound,
    kind: "collection",
    metrics: [
      { key: "user-roles.roles", value: "6", icon: KeyRound },
      { key: "user-roles.assigned", value: "148", icon: Users },
      { key: "user-roles.permissions", value: "112", icon: ShieldCheck },
    ],
    rows: [
      row(
        "role-1",
        [
          { primary: "Administrador", secondary: "Acceso completo al panel" },
          { primary: "12" },
          { primary: "48" },
        ],
        "inUse",
        "success"
      ),
      row(
        "role-2",
        [
          {
            primary: "Soporte",
            secondary: "Tickets y usuarios en solo lectura",
          },
          { primary: "26" },
          { primary: "18" },
        ],
        "inUse",
        "success"
      ),
      row(
        "role-3",
        [
          {
            primary: "Editor de contenido",
            secondary: "Blog, FAQs y páginas estáticas",
          },
          { primary: "8" },
          { primary: "22" },
        ],
        "inUse",
        "success"
      ),
      row(
        "role-4",
        [
          { primary: "Auditor", secondary: "Sin descripción todavía" },
          { primary: "0" },
          { primary: "9" },
        ],
        "unused",
        "neutral"
      ),
    ],
  },
  teams: {
    action: {
      icon: Pencil,
      mode: "edit",
      fields: [
        text("name", "field.name", ""),
        {
          kind: "textarea",
          labelKey: "field.description",
          name: "description",
          required: false,
          value: "",
        },
      ],
    },
    columnKeys: ["team", "owner", "members", "slug"],
    statusKeys: ["withOwner", "withoutOwner"],
    icon: UsersRound,
    kind: "collection",
    metrics: [
      { key: "teams.teams", value: "312", icon: UsersRound },
      { key: "teams.withOwner", value: "301", icon: UserCheck },
      { key: "teams.withoutOwner", value: "11", icon: UserX },
      { key: "teams.averageSize", value: "3,4", icon: Users },
    ],
    rows: [
      row(
        "team-1",
        [
          { primary: "Aurora Studio", secondary: "Equipo personal de María" },
          { primary: "María Andrade", secondary: "maria@aurora.studio" },
          { primary: "6" },
          { primary: "aurora-studio", mono: true },
        ],
        "withOwner",
        "success"
      ),
      row(
        "team-2",
        [
          {
            primary: "North Lab",
            secondary: "Espacio del equipo de contenido",
          },
          { primary: "Daniel Vera", secondary: "daniel@northlab.io" },
          { primary: "4" },
          { primary: "north-lab", mono: true },
        ],
        "withOwner",
        "success"
      ),
      row(
        "team-3",
        [
          { primary: "Demo Workspace", secondary: "Sin descripción todavía" },
          { primary: "—", secondary: "Sin propietario asignado" },
          { primary: "2" },
          { primary: "demo-workspace", mono: true },
        ],
        "withoutOwner",
        "warning"
      ),
    ],
  },
}
