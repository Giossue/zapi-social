import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  KeyRound,
  MailCheck,
  Pencil,
  Plus,
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
  status: string
  tone: AdminMockTone
  values: readonly { primary: string; secondary?: string; mono?: boolean }[]
}

export type AdminPermissionOption = { key: string; label: string }

export type AdminMockField = {
  description?: string
  kind: "text" | "textarea" | "select" | "switch" | "display" | "permissions"
  label: string
  name: string
  options?: readonly { label: string; value: string }[]
  permissionActions?: readonly AdminPermissionOption[]
  permissionGroups?: readonly AdminPermissionOption[]
  placeholder?: string
  required?: boolean
  value: string | boolean | readonly string[]
}

export type AdminMockAction = {
  description: string
  fields: readonly AdminMockField[]
  icon: LucideIcon
  label: string
  mode: "create" | "edit" | "execute"
  successMessage: string
  title: string
}

type AdminMockMetric = {
  description: string
  icon: LucideIcon
  label: string
  value: string
}

export type AdminCollectionDefinition = {
  action?: AdminMockAction
  columns: readonly string[]
  description: string
  filterOptions: readonly { label: string; value: string }[]
  icon: LucideIcon
  kind: "collection"
  metrics?: readonly AdminMockMetric[]
  rows: readonly AdminMockRow[]
  title: string
}

const allStatuses = (options: readonly string[]) => [
  { label: "Todos los estados", value: "all" },
  ...options.map((option) => ({ label: option, value: option })),
]

const text = (
  name: string,
  label: string,
  value: string,
  required = true
): AdminMockField => ({
  kind: "text",
  label,
  name,
  required,
  value,
})

const row = (
  id: string,
  values: AdminMockRow["values"],
  status: string,
  tone: AdminMockTone
): AdminMockRow => ({
  id,
  search: values.flatMap((value) => [value.primary, value.secondary]).join(" "),
  status,
  tone,
  values,
})

const createAction = (
  label: string,
  title: string,
  description: string,
  fields: readonly AdminMockField[],
  icon: LucideIcon = Plus,
  mode: AdminMockAction["mode"] = "create"
): AdminMockAction => ({
  description,
  fields,
  icon,
  label,
  mode,
  successMessage:
    mode === "execute"
      ? `${title}: acción registrada.`
      : `${title}: mockup guardado.`,
  title,
})

const permissionMatrix = (
  name: string,
  label: string,
  groups: readonly AdminPermissionOption[],
  actions: readonly AdminPermissionOption[],
  description: string
): AdminMockField => ({
  description,
  kind: "permissions",
  label,
  name,
  permissionActions: actions,
  permissionGroups: groups,
  value: [],
})

const rolePermissionGroups: readonly AdminPermissionOption[] = [
  { key: "users", label: "Usuarios" },
  { key: "roles", label: "Roles y equipos" },
  { key: "plans", label: "Planes" },
  { key: "payments", label: "Pagos" },
  { key: "content", label: "Contenido" },
  { key: "settings", label: "Ajustes" },
]

const rolePermissionActions: readonly AdminPermissionOption[] = [
  { key: "view", label: "Ver" },
  { key: "create", label: "Crear" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Eliminar" },
]

export const adminSecondaryDefinitions: Record<
  AdminSecondaryModuleKey,
  AdminCollectionDefinition
> = {
  "user-report": {
    columns: ["Usuario", "Rol", "Plan", "Registro"],
    description:
      "Crecimiento, seguridad de cuentas y últimas altas registradas.",
    filterOptions: allStatuses(["Verificada", "Sin verificar", "Atención"]),
    icon: BarChart3,
    kind: "collection",
    metrics: [
      {
        label: "Usuarios",
        value: "1.248",
        description: "Identidades registradas",
        icon: Users,
      },
      {
        label: "Crecimiento 30 días",
        value: "+18%",
        description: "86 altas en el período",
        icon: TrendingUp,
      },
      {
        label: "Correo verificado",
        value: "82%",
        description: "1.023 cuentas verificadas",
        icon: MailCheck,
      },
      {
        label: "Dos factores",
        value: "38%",
        description: "474 cuentas protegidas",
        icon: ShieldCheck,
      },
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
        "Verificada",
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
        "Verificada",
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
        "Atención",
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
        "Sin verificar",
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
        "Verificada",
        "success"
      ),
    ],
    title: "Reporte de usuarios",
  },
  "user-roles": {
    action: createAction(
      "Crear rol",
      "Crear rol",
      "Agrupa permisos del panel y reutilízalos entre usuarios administrativos.",
      [
        text("name", "Nombre", ""),
        {
          kind: "textarea",
          label: "Descripción",
          name: "description",
          required: false,
          value: "",
        },
        permissionMatrix(
          "permissions",
          "Permisos",
          rolePermissionGroups,
          rolePermissionActions,
          "Marca las acciones permitidas por módulo del panel."
        ),
      ],
      KeyRound
    ),
    columns: ["Rol", "Usuarios", "Permisos"],
    description: "Grupos de permisos reutilizables para el acceso al panel.",
    filterOptions: allStatuses(["Sin usuarios", "En uso"]),
    icon: KeyRound,
    kind: "collection",
    metrics: [
      {
        label: "Roles",
        value: "6",
        description: "Grupos de permisos disponibles",
        icon: KeyRound,
      },
      {
        label: "Usuarios asignados",
        value: "148",
        description: "Cuentas con un rol activo",
        icon: Users,
      },
      {
        label: "Permisos",
        value: "112",
        description: "Claves cubiertas por los roles",
        icon: ShieldCheck,
      },
    ],
    rows: [
      row(
        "role-1",
        [
          { primary: "Administrador", secondary: "Acceso completo al panel" },
          { primary: "12" },
          { primary: "48" },
        ],
        "En uso",
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
        "En uso",
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
        "En uso",
        "success"
      ),
      row(
        "role-4",
        [
          { primary: "Auditor", secondary: "Sin descripción todavía" },
          { primary: "0" },
          { primary: "9" },
        ],
        "Sin usuarios",
        "neutral"
      ),
    ],
    title: "Roles de usuario",
  },
  teams: {
    action: createAction(
      "Editar equipo",
      "Editar equipo",
      "Actualiza el nombre y la descripción del espacio de trabajo.",
      [
        text("name", "Nombre", ""),
        {
          kind: "textarea",
          label: "Descripción",
          name: "description",
          required: false,
          value: "",
        },
      ],
      Pencil,
      "edit"
    ),
    columns: ["Equipo", "Propietario", "Miembros", "Slug"],
    description: "Espacios de trabajo con su propietario y miembros asignados.",
    filterOptions: allStatuses(["Con propietario", "Sin propietario"]),
    icon: UsersRound,
    kind: "collection",
    metrics: [
      {
        label: "Equipos",
        value: "312",
        description: "Espacios de trabajo actuales",
        icon: UsersRound,
      },
      {
        label: "Con propietario",
        value: "301",
        description: "Equipos con dueño asignado",
        icon: UserCheck,
      },
      {
        label: "Sin propietario",
        value: "11",
        description: "Requieren reasignar dueño",
        icon: UserX,
      },
      {
        label: "Tamaño medio",
        value: "3,4",
        description: "Miembros por equipo",
        icon: Users,
      },
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
        "Con propietario",
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
        "Con propietario",
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
        "Sin propietario",
        "warning"
      ),
    ],
    title: "Equipos",
  },
}
