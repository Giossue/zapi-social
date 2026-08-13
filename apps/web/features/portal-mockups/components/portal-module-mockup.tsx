"use client"

import { type FormEvent, useMemo, useState } from "react"

import {
  Ban,
  Check,
  Clock3,
  CircleAlert,
  CircleDollarSign,
  Clipboard,
  Code2,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HandCoins,
  ListChecks,
  type LucideIcon,
  MoreVertical,
  MousePointerClick,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Share2,
  ShieldX,
  Sparkles,
  Trash2,
  UserRoundPlus,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"

import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"

type PortalModuleKey =
  "bulk-posts" | "ai-publishing" | "automation" | "groups" | "affiliate"

type BadgeTone = "success" | "warning" | "info" | "neutral" | "destructive"

type CellValue = {
  badge?: BadgeTone
  primary: string
  secondary?: string
}

type MockRow = {
  cells: Record<string, CellValue>
  formValues?: Partial<Record<string, string>>
  id: string
  search: string
  status: string
}

type FormValues = Partial<Record<string, string>>

type RowActionKind =
  "view" | "edit" | "execute" | "rotate" | "cancel" | "revoke" | "delete"

type RowAction = {
  kind: RowActionKind
  label: string
}

type FormField = {
  label: string
  name: string
  options?: readonly { label: string; value: string }[]
  placeholder?: string
  required?: boolean
  type: "text" | "textarea" | "select"
}

type ViewAction = {
  description: string
  fields: readonly FormField[]
  label: string
  submitLabel: string
  successMessage: string
  title: string
}

type ModuleView = {
  action?: ViewAction
  columns: readonly { key: string; label: string }[]
  description: string
  emptyDescription: string
  emptyTitle: string
  filterOptions: readonly { label: string; value: string }[]
  key: string
  label: string
  rowActions: readonly RowAction[]
  rows: readonly MockRow[]
}

type ModuleDefinition = {
  description: string
  highlight?: { label: string; value: string }
  icon: LucideIcon
  metrics?: readonly {
    description: string
    icon: LucideIcon
    label: string
    value: string
  }[]
  title: string
  views: readonly ModuleView[]
}

type PendingRowAction = {
  action: RowAction
  row: MockRow
}

export type PortalModuleViewState =
  "normal" | "loading" | "empty" | "error" | "forbidden"

const required = (
  label: string,
  name: string,
  placeholder: string
): FormField => ({
  label,
  name,
  placeholder,
  required: true,
  type: "text",
})

const select = (
  label: string,
  name: string,
  options: readonly { label: string; value: string }[]
): FormField => ({
  label,
  name,
  options,
  required: true,
  type: "select",
})

const statusOptions = (
  options: readonly { label: string; value: string }[]
) => [{ label: "Todos los estados", value: "all" }, ...options]

const definitions: Record<PortalModuleKey, ModuleDefinition> = {
  "bulk-posts": {
    description:
      "Importa un CSV, valida cada fila y crea borradores o programaciones por cuenta.",
    icon: FileSpreadsheet,
    metrics: [
      {
        description: "Procesados este mes",
        icon: FileSpreadsheet,
        label: "Lotes",
        value: "18",
      },
      {
        description: "En todos los lotes",
        icon: ListChecks,
        label: "Filas",
        value: "2.460",
      },
      {
        description: "Requieren revisión",
        icon: CircleAlert,
        label: "Observaciones",
        value: "37",
      },
    ],
    title: "Publicaciones masivas",
    views: [
      {
        action: {
          description:
            "Selecciona un CSV de Files y define cómo se crearán sus publicaciones.",
          fields: [
            select("Archivo CSV", "file", [
              { label: "campaña-agosto.csv", value: "august" },
              { label: "lanzamientos.csv", value: "launches" },
            ]),
            select("Destino", "target", [
              { label: "Todas las cuentas seleccionadas", value: "all" },
              { label: "Grupo Retail Ecuador", value: "retail" },
            ]),
            select("Modo", "mode", [
              { label: "Crear borradores", value: "draft" },
              { label: "Programar por fecha del CSV", value: "scheduled" },
            ]),
            required("Intervalo entre publicaciones", "interval", "30 minutos"),
          ],
          label: "Nuevo lote",
          submitLabel: "Crear lote",
          successMessage: "Lote creado en el mockup.",
          title: "Crear lote de publicaciones",
        },
        columns: [
          { key: "batch", label: "Lote" },
          { key: "targets", label: "Destinos" },
          { key: "progress", label: "Progreso" },
          { key: "status", label: "Estado" },
          { key: "created", label: "Creado" },
        ],
        description:
          "Historial de archivos procesados y validaciones por fila.",
        emptyDescription:
          "Crea un lote para comenzar a procesar publicaciones.",
        emptyTitle: "No hay lotes todavía",
        filterOptions: statusOptions([
          { label: "Procesando", value: "processing" },
          { label: "Completado", value: "completed" },
          { label: "Con errores", value: "failed" },
          { label: "Cancelado", value: "cancelled" },
        ]),
        key: "batches",
        label: "Lotes",
        rowActions: [
          { kind: "view", label: "Ver detalle" },
          { kind: "cancel", label: "Cancelar lote" },
        ],
        rows: [
          {
            cells: {
              batch: {
                primary: "Campaña agosto",
                secondary: "campaña-agosto.csv",
              },
              created: { primary: "Hoy, 09:42" },
              progress: {
                primary: "68 de 120 filas",
                secondary: "57% procesado",
              },
              status: { badge: "info", primary: "Procesando" },
              targets: {
                primary: "4 cuentas",
                secondary: "Facebook e Instagram",
              },
            },
            id: "batch-1",
            search: "Campaña agosto campaña-agosto.csv Facebook Instagram",
            status: "processing",
          },
          {
            cells: {
              batch: {
                primary: "Lanzamientos Q3",
                secondary: "lanzamientos.csv",
              },
              created: { primary: "8 ago 2026" },
              progress: {
                primary: "480 de 480 filas",
                secondary: "12 observaciones",
              },
              status: { badge: "success", primary: "Completado" },
              targets: { primary: "8 cuentas", secondary: "Grupo Retail" },
            },
            id: "batch-2",
            search: "Lanzamientos Q3 lanzamientos.csv Retail",
            status: "completed",
          },
          {
            cells: {
              batch: {
                primary: "Promos fin de semana",
                secondary: "promos.csv",
              },
              created: { primary: "6 ago 2026" },
              progress: {
                primary: "92 de 100 filas",
                secondary: "8 filas inválidas",
              },
              status: { badge: "destructive", primary: "Con errores" },
              targets: { primary: "3 cuentas", secondary: "Instagram" },
            },
            id: "batch-3",
            search: "Promos fin de semana promos.csv Instagram",
            status: "failed",
          },
        ],
      },
    ],
  },
  "ai-publishing": {
    description:
      "Automatiza la creación de borradores con IA y mantenlos bajo revisión antes de publicar.",
    icon: Sparkles,
    metrics: [
      {
        description: "Listas para crear borradores",
        icon: Sparkles,
        label: "Automatizaciones",
        value: "3",
      },
      {
        description: "Durante el ciclo actual",
        icon: FileText,
        label: "Borradores",
        value: "46",
      },
      {
        description: "Tendencias del sector",
        icon: Clock3,
        label: "Próxima ejecución",
        value: "Hoy, 18:00",
      },
    ],
    title: "AI Publishing",
    views: [
      {
        action: {
          description:
            "Define el tema, la frecuencia y las cuentas que recibirán borradores.",
          fields: [
            required("Nombre", "name", "Ej. Tendencias semanales"),
            {
              label: "Instrucciones",
              name: "prompt",
              placeholder: "Describe qué contenido debe generar la IA.",
              required: true,
              type: "textarea",
            },
            select("Frecuencia", "frequency", [
              { label: "Todos los días", value: "daily" },
              { label: "Semanal", value: "weekly" },
            ]),
            select("Hora", "time", [
              { label: "09:00", value: "09:00" },
              { label: "13:00", value: "13:00" },
              { label: "18:00", value: "18:00" },
            ]),
            select("Destino", "target", [
              { label: "Instagram principal", value: "instagram" },
              { label: "Facebook e Instagram", value: "meta" },
            ]),
          ],
          label: "Nueva automatización",
          submitLabel: "Crear automatización",
          successMessage: "Automatización AI creada en el mockup.",
          title: "Crear automatización AI",
        },
        columns: [
          { key: "automation", label: "Automatización" },
          { key: "frequency", label: "Frecuencia" },
          { key: "targets", label: "Destinos" },
          { key: "next", label: "Próxima ejecución" },
          { key: "status", label: "Estado" },
        ],
        description: "Programaciones que crean borradores en Publishing.",
        emptyDescription:
          "Crea una automatización para generar tu primer borrador.",
        emptyTitle: "No hay automatizaciones AI",
        filterOptions: statusOptions([
          { label: "Activa", value: "active" },
          { label: "En pausa", value: "paused" },
          { label: "Borrador", value: "draft" },
        ]),
        key: "schedules",
        label: "Automatizaciones",
        rowActions: [
          { kind: "edit", label: "Editar" },
          { kind: "execute", label: "Ejecutar ahora" },
          { kind: "delete", label: "Eliminar" },
        ],
        rows: [
          {
            cells: {
              automation: {
                primary: "Tendencias del sector",
                secondary: "Tono cercano",
              },
              frequency: { primary: "Diaria · 18:00" },
              next: { primary: "Hoy, 18:00" },
              status: { badge: "success", primary: "Activa" },
              targets: {
                primary: "2 cuentas",
                secondary: "Facebook e Instagram",
              },
            },
            id: "ai-publishing-1",
            search: "Tendencias del sector Facebook Instagram",
            status: "active",
          },
          {
            cells: {
              automation: {
                primary: "Resumen semanal",
                secondary: "Tono profesional",
              },
              frequency: { primary: "Viernes · 09:00" },
              next: { primary: "14 ago, 09:00" },
              status: { badge: "warning", primary: "En pausa" },
              targets: { primary: "1 cuenta", secondary: "LinkedIn" },
            },
            id: "ai-publishing-2",
            search: "Resumen semanal LinkedIn profesional",
            status: "paused",
          },
          {
            cells: {
              automation: {
                primary: "Ideas de producto",
                secondary: "Pendiente de activar",
              },
              frequency: { primary: "Diaria · 13:00" },
              next: { primary: "Sin programar" },
              status: { badge: "neutral", primary: "Borrador" },
              targets: { primary: "1 cuenta", secondary: "Instagram" },
            },
            id: "ai-publishing-3",
            search: "Ideas de producto Instagram",
            status: "draft",
          },
        ],
      },
    ],
  },
  automation: {
    description:
      "Administra claves para integradores, webhooks firmados y actividad técnica del workspace.",
    icon: Code2,
    title: "API de automatización",
    views: [
      {
        action: {
          description:
            "El token completo se mostrará una sola vez después de crear la clave.",
          fields: [
            required("Nombre", "name", "Ej. Integración ecommerce"),
            select("Permisos", "scope", [
              { label: "Lectura de cuentas y publicaciones", value: "read" },
              { label: "Lectura y creación de publicaciones", value: "write" },
            ]),
            select("Expiración", "expiration", [
              { label: "30 días", value: "30" },
              { label: "90 días", value: "90" },
              { label: "Sin expiración", value: "never" },
            ]),
          ],
          label: "Nueva clave",
          submitLabel: "Crear clave",
          successMessage: "Clave API creada en el mockup.",
          title: "Crear clave API",
        },
        columns: [
          { key: "name", label: "Clave" },
          { key: "permissions", label: "Permisos" },
          { key: "lastUsed", label: "Último uso" },
          { key: "expires", label: "Expira" },
          { key: "status", label: "Estado" },
        ],
        description: "Credenciales redactadas para consumir la API externa.",
        emptyDescription:
          "Crea una clave para conectar tu primera integración.",
        emptyTitle: "No hay claves API",
        filterOptions: statusOptions([
          { label: "Activa", value: "active" },
          { label: "Revocada", value: "revoked" },
        ]),
        key: "keys",
        label: "Claves API",
        rowActions: [
          { kind: "view", label: "Ver permisos" },
          { kind: "revoke", label: "Revocar clave" },
        ],
        rows: [
          {
            cells: {
              expires: { primary: "8 nov 2026" },
              lastUsed: { primary: "Hace 12 minutos" },
              name: {
                primary: "Ecommerce principal",
                secondary: "zapi_live_••••7F2A",
              },
              permissions: { primary: "Lectura y escritura" },
              status: { badge: "success", primary: "Activa" },
            },
            id: "key-1",
            search: "Ecommerce principal zapi live lectura escritura",
            status: "active",
          },
          {
            cells: {
              expires: { primary: "Sin expiración" },
              lastUsed: { primary: "2 ago 2026" },
              name: {
                primary: "Reportes internos",
                secondary: "zapi_live_••••91BC",
              },
              permissions: { primary: "Solo lectura" },
              status: { badge: "success", primary: "Activa" },
            },
            id: "key-2",
            search: "Reportes internos solo lectura",
            status: "active",
          },
        ],
      },
      {
        action: {
          description:
            "Las entregas se firman y reintentan automáticamente ante fallos temporales.",
          fields: [
            required("Nombre", "name", "Ej. Eventos de Publishing"),
            required(
              "URL del endpoint",
              "url",
              "https://api.ejemplo.com/webhooks/zapi"
            ),
            select("Eventos", "events", [
              { label: "Todas las publicaciones", value: "all" },
              { label: "Solo publicaciones exitosas", value: "published" },
              { label: "Solo fallos", value: "failed" },
            ]),
          ],
          label: "Nuevo webhook",
          submitLabel: "Crear webhook",
          successMessage: "Webhook creado en el mockup.",
          title: "Crear webhook",
        },
        columns: [
          { key: "endpoint", label: "Endpoint" },
          { key: "events", label: "Eventos" },
          { key: "deliveries", label: "Entregas" },
          { key: "lastDelivery", label: "Última entrega" },
          { key: "status", label: "Estado" },
        ],
        description: "Endpoints que reciben eventos firmados del workspace.",
        emptyDescription: "Crea un webhook para recibir eventos de Publishing.",
        emptyTitle: "No hay webhooks",
        filterOptions: statusOptions([
          { label: "Activo", value: "active" },
          { label: "En pausa", value: "paused" },
        ]),
        key: "webhooks",
        label: "Webhooks",
        rowActions: [
          { kind: "edit", label: "Editar" },
          { kind: "rotate", label: "Rotar secreto" },
          { kind: "delete", label: "Eliminar" },
        ],
        rows: [
          {
            cells: {
              deliveries: {
                primary: "1.248 correctas",
                secondary: "3 reintentos",
              },
              endpoint: {
                primary: "Publishing events",
                secondary: "https://api.ejemplo.com/zapi",
              },
              events: { primary: "3 eventos" },
              lastDelivery: { primary: "Hace 4 minutos" },
              status: { badge: "success", primary: "Activo" },
            },
            id: "webhook-1",
            search: "Publishing events api ejemplo zapi",
            status: "active",
          },
          {
            cells: {
              deliveries: { primary: "98 correctas", secondary: "Sin fallos" },
              endpoint: {
                primary: "Data warehouse",
                secondary: "https://hooks.ejemplo.com/social",
              },
              events: { primary: "Publicadas" },
              lastDelivery: { primary: "7 ago 2026" },
              status: { badge: "warning", primary: "En pausa" },
            },
            id: "webhook-2",
            search: "Data warehouse hooks ejemplo social",
            status: "paused",
          },
        ],
      },
      {
        columns: [
          { key: "event", label: "Evento" },
          { key: "origin", label: "Origen" },
          { key: "result", label: "Resultado" },
          { key: "time", label: "Fecha" },
          { key: "status", label: "Estado" },
        ],
        description: "Últimos eventos de entrada y entregas de salida.",
        emptyDescription:
          "La actividad aparecerá cuando se use una clave o webhook.",
        emptyTitle: "No hay actividad registrada",
        filterOptions: statusOptions([
          { label: "Correcto", value: "success" },
          { label: "Con error", value: "failed" },
        ]),
        key: "activity",
        label: "Actividad",
        rowActions: [{ kind: "view", label: "Ver detalle" }],
        rows: [
          {
            cells: {
              event: {
                primary: "post.published",
                secondary: "Entrega de webhook",
              },
              origin: { primary: "Publishing events" },
              result: { primary: "HTTP 200", secondary: "184 ms" },
              status: { badge: "success", primary: "Correcto" },
              time: { primary: "Hoy, 10:08" },
            },
            id: "activity-1",
            search: "post published Publishing events HTTP 200",
            status: "success",
          },
          {
            cells: {
              event: {
                primary: "POST /automation/posts",
                secondary: "Solicitud API",
              },
              origin: { primary: "Ecommerce principal" },
              result: { primary: "Creó 2 borradores", secondary: "312 ms" },
              status: { badge: "success", primary: "Correcto" },
              time: { primary: "Hoy, 09:54" },
            },
            id: "activity-2",
            search: "automation posts Ecommerce principal borradores",
            status: "success",
          },
        ],
      },
    ],
  },
  groups: {
    description:
      "Organiza cuentas relacionadas para encontrarlas y seleccionarlas más rápido.",
    icon: FolderKanban,
    metrics: [
      {
        description: "Listos para usar",
        icon: FolderKanban,
        label: "Grupos activos",
        value: "4",
      },
      {
        description: "Con al menos un grupo",
        icon: Share2,
        label: "Cuentas organizadas",
        value: "11",
      },
      {
        description: "Pendientes de clasificar",
        icon: CircleAlert,
        label: "Sin grupo",
        value: "2",
      },
    ],
    title: "Grupos",
    views: [
      {
        action: {
          description:
            "Un grupo organiza cuentas; no modifica permisos ni miembros del equipo.",
          fields: [
            required("Nombre", "name", "Ej. Retail Ecuador"),
            {
              label: "Descripción",
              name: "description",
              placeholder: "Explica cuándo usar este grupo.",
              type: "textarea",
            },
            select("Cuentas", "accounts", [
              {
                label: "Facebook Ecuador + Instagram Ecuador",
                value: "ecuador",
              },
              { label: "Cuentas de la marca principal", value: "brand" },
            ]),
            select("Estado", "status", [
              { label: "Activo", value: "active" },
              { label: "Archivado", value: "archived" },
            ]),
          ],
          label: "Nuevo grupo",
          submitLabel: "Crear grupo",
          successMessage: "Grupo creado en el mockup.",
          title: "Crear grupo",
        },
        columns: [
          { key: "group", label: "Grupo" },
          { key: "accounts", label: "Cuentas" },
          { key: "networks", label: "Redes" },
          { key: "updated", label: "Actualizado" },
          { key: "status", label: "Estado" },
        ],
        description:
          "Clasificaciones privadas dentro de este espacio de trabajo.",
        emptyDescription: "Crea un grupo para ordenar tus cuentas conectadas.",
        emptyTitle: "No hay grupos",
        filterOptions: statusOptions([
          { label: "Activo", value: "active" },
          { label: "Archivado", value: "archived" },
        ]),
        key: "groups",
        label: "Grupos",
        rowActions: [
          { kind: "edit", label: "Editar" },
          { kind: "delete", label: "Eliminar" },
        ],
        rows: [
          {
            cells: {
              accounts: { primary: "4 cuentas", secondary: "Todas conectadas" },
              group: {
                primary: "Retail Ecuador",
                secondary: "Tiendas y campañas locales",
              },
              networks: { primary: "Facebook e Instagram" },
              status: { badge: "success", primary: "Activo" },
              updated: { primary: "Hoy, 08:30" },
            },
            id: "group-1",
            search: "Retail Ecuador tiendas campañas Facebook Instagram",
            status: "active",
          },
          {
            cells: {
              accounts: { primary: "3 cuentas", secondary: "Todas conectadas" },
              group: {
                primary: "Marca principal",
                secondary: "Canales corporativos",
              },
              networks: { primary: "Facebook, Instagram y WhatsApp" },
              status: { badge: "success", primary: "Activo" },
              updated: { primary: "7 ago 2026" },
            },
            id: "group-2",
            search:
              "Marca principal canales corporativos Facebook Instagram WhatsApp",
            status: "active",
          },
          {
            cells: {
              accounts: { primary: "2 cuentas", secondary: "Histórico" },
              group: {
                primary: "Campaña verano",
                secondary: "Cuentas de temporada",
              },
              networks: { primary: "Instagram" },
              status: { badge: "neutral", primary: "Archivado" },
              updated: { primary: "29 jul 2026" },
            },
            id: "group-3",
            search: "Campaña verano cuentas temporada Instagram",
            status: "archived",
          },
        ],
      },
    ],
  },
  affiliate: {
    description:
      "Comparte tu enlace, consulta comisiones y solicita retiros del saldo disponible.",
    highlight: {
      label: "Tu enlace de afiliado",
      value: "https://zapi.social/r/JOSUE24",
    },
    icon: CircleDollarSign,
    metrics: [
      {
        description: "Durante este ciclo",
        icon: MousePointerClick,
        label: "Clics",
        value: "1.284",
      },
      {
        description: "Conversiones atribuidas",
        icon: UserRoundPlus,
        label: "Registros",
        value: "74",
      },
      {
        description: "Lista para retiro",
        icon: HandCoins,
        label: "Comisión disponible",
        value: "$186,40",
      },
      {
        description: "Aún en validación",
        icon: CircleDollarSign,
        label: "Comisión pendiente",
        value: "$92,00",
      },
    ],
    title: "Afiliados",
    views: [
      {
        columns: [
          { key: "customer", label: "Referido" },
          { key: "order", label: "Origen" },
          { key: "amount", label: "Comisión" },
          { key: "available", label: "Disponible desde" },
          { key: "status", label: "Estado" },
        ],
        description: "Comisiones generadas por clientes referidos.",
        emptyDescription:
          "Las comisiones aparecerán después de una compra verificada.",
        emptyTitle: "No hay comisiones",
        filterOptions: statusOptions([
          { label: "Disponible", value: "available" },
          { label: "Pendiente", value: "pending" },
        ]),
        key: "commissions",
        label: "Comisiones",
        rowActions: [{ kind: "view", label: "Ver detalle" }],
        rows: [
          {
            cells: {
              amount: { primary: "$42,00" },
              available: { primary: "Disponible ahora" },
              customer: { primary: "María P.", secondary: "Plan Pro anual" },
              order: { primary: "Orden #1048" },
              status: { badge: "success", primary: "Disponible" },
            },
            id: "commission-1",
            search: "María Plan Pro anual Orden 1048",
            status: "available",
          },
          {
            cells: {
              amount: { primary: "$28,00" },
              available: { primary: "2 sep 2026" },
              customer: {
                primary: "Andrés C.",
                secondary: "Plan Business mensual",
              },
              order: { primary: "Orden #1073" },
              status: { badge: "warning", primary: "Pendiente" },
            },
            id: "commission-2",
            search: "Andrés Plan Business mensual Orden 1073",
            status: "pending",
          },
        ],
      },
      {
        action: {
          description:
            "El importe se reservará del saldo disponible hasta que se procese la solicitud.",
          fields: [
            required("Importe", "amount", "100,00"),
            select("Método", "method", [
              { label: "Transferencia bancaria", value: "bank" },
              { label: "PayPal", value: "paypal" },
            ]),
            required(
              "Cuenta de destino",
              "destination",
              "Cuenta o correo de pago"
            ),
          ],
          label: "Solicitar retiro",
          submitLabel: "Enviar solicitud",
          successMessage: "Solicitud de retiro creada en el mockup.",
          title: "Solicitar retiro",
        },
        columns: [
          { key: "request", label: "Solicitud" },
          { key: "method", label: "Método" },
          { key: "amount", label: "Importe" },
          { key: "requested", label: "Solicitada" },
          { key: "status", label: "Estado" },
        ],
        description: "Solicitudes realizadas con tu saldo disponible.",
        emptyDescription:
          "Tus solicitudes de retiro aparecerán en este historial.",
        emptyTitle: "No hay retiros",
        filterOptions: statusOptions([
          { label: "Solicitado", value: "requested" },
          { label: "Pagado", value: "paid" },
        ]),
        key: "withdrawals",
        label: "Retiros",
        rowActions: [{ kind: "view", label: "Ver detalle" }],
        rows: [
          {
            cells: {
              amount: { primary: "$120,00" },
              method: { primary: "Transferencia bancaria" },
              request: { primary: "Retiro #0031" },
              requested: { primary: "1 ago 2026" },
              status: { badge: "info", primary: "Solicitado" },
            },
            id: "withdrawal-1",
            search: "Retiro 0031 transferencia bancaria",
            status: "requested",
          },
          {
            cells: {
              amount: { primary: "$96,00" },
              method: { primary: "PayPal" },
              request: { primary: "Retiro #0024" },
              requested: { primary: "12 jul 2026" },
              status: { badge: "success", primary: "Pagado" },
            },
            id: "withdrawal-2",
            search: "Retiro 0024 PayPal",
            status: "paid",
          },
        ],
      },
    ],
  },
}

const pageSize = 6

function emptyValues(fields: readonly FormField[]): FormValues {
  return Object.fromEntries(fields.map((field) => [field.name, ""]))
}

function valuesFromRow(fields: readonly FormField[], row: MockRow): FormValues {
  if (row.formValues) return { ...emptyValues(fields), ...row.formValues }

  const values = emptyValues(fields)
  const firstCell = Object.values(row.cells)[0]
  for (const field of fields) {
    if (field.name === "status") values[field.name] = row.status
    else if (["name", "amount"].includes(field.name))
      values[field.name] = firstCell?.primary ?? ""
    else if (field.name === "url")
      values[field.name] = firstCell?.secondary ?? ""
  }
  return values
}

function toneForStatus(status: string): BadgeTone {
  const normalized = status.toLocaleLowerCase("es")
  if (normalized.includes("error") || normalized.includes("revoc"))
    return "destructive"
  if (normalized.includes("pend") || normalized.includes("pausa"))
    return "warning"
  if (normalized.includes("proces") || normalized.includes("solicit"))
    return "info"
  if (normalized.includes("borrador") || normalized.includes("archiv"))
    return "neutral"
  return "success"
}

function rowFromValues(
  view: ModuleView,
  values: FormValues,
  current?: MockRow
): MockRow {
  const cells: Record<string, CellValue> = current
    ? Object.fromEntries(
        Object.entries(current.cells).map(([key, cell]) => [key, { ...cell }])
      )
    : Object.fromEntries(
        view.columns.map((column) => [column.key, { primary: "—" }])
      )
  const primary =
    [values.name, values.file, values.url, values.amount].find((value) =>
      value?.trim()
    ) ?? "Nuevo registro"
  const firstColumn = view.columns[0]

  if (firstColumn) {
    cells[firstColumn.key] = {
      ...cells[firstColumn.key],
      primary,
      secondary:
        [values.url, values.prompt, values.destination].find((value) =>
          value?.trim()
        ) ?? cells[firstColumn.key]?.secondary,
    }
  }

  const statusColumn = view.columns.find((column) => column.key === "status")
  const fallbackStatus =
    current?.status ?? view.filterOptions[1]?.value ?? "active"
  const requestedStatus = values.status ?? ""
  const status = requestedStatus.trim() ? requestedStatus : fallbackStatus
  if (statusColumn) {
    const option = view.filterOptions.find((item) => item.value === status)
    cells[statusColumn.key] = {
      badge: toneForStatus(option?.label ?? status),
      primary: option?.label ?? status,
    }
  }

  return {
    cells,
    formValues: { ...values },
    id: current?.id ?? `mock-${Date.now()}`,
    search: [primary, ...Object.values(values)].join(" "),
    status,
  }
}

function StatusBadge({ cell }: { cell: CellValue }) {
  return <Badge variant={cell.badge ?? "neutral"}>{cell.primary}</Badge>
}

const destructiveActionKinds = new Set<RowActionKind>([
  "cancel",
  "revoke",
  "delete",
])
const rowActionIcons: Record<RowActionKind, LucideIcon> = {
  cancel: Ban,
  delete: Trash2,
  edit: Pencil,
  execute: Play,
  revoke: Ban,
  rotate: RotateCw,
  view: Eye,
}

function RowActionIcon({ kind }: { kind: RowActionKind }) {
  const Icon = rowActionIcons[kind]
  return <Icon aria-hidden="true" />
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function ActionFieldControl({
  field,
  onChange,
  value,
}: {
  field: FormField
  onChange: (value: string) => void
  value: string
}) {
  const id = `mock-${field.name}`

  if (field.type === "textarea") {
    return (
      <Textarea
        aria-required={field.required ? true : undefined}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={5}
        value={value}
      />
    )
  }

  if (field.type === "select") {
    return (
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger
          aria-required={field.required ? true : undefined}
          id={id}
        >
          <SelectValue
            placeholder={`Selecciona ${field.label.toLowerCase()}`}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      aria-required={field.required ? true : undefined}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      value={value}
    />
  )
}

function ActionSheet({
  action,
  editingRow,
  onSave,
  onOpenChange,
  open,
}: {
  action: ViewAction | undefined
  editingRow: MockRow | null
  onSave: (values: FormValues) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const initial = editingRow
    ? valuesFromRow(action?.fields ?? [], editingRow)
    : emptyValues(action?.fields ?? [])
  const [values, setValues] = useState<FormValues>(initial)
  const [baseline] = useState<FormValues>(initial)
  const [saving, setSaving] = useState(false)

  if (!action) return null

  const currentAction = action
  const canSubmit = currentAction.fields
    .filter((field) => field.required)
    .every((field) => values[field.name]?.trim())
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)

  function changeOpen(nextOpen: boolean) {
    onOpenChange(nextOpen)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    if (editingRow && !dirty) return
    setSaving(true)
    window.setTimeout(() => {
      onSave(values)
      setSaving(false)
      toast.success(
        editingRow ? "Cambios guardados." : currentAction.successMessage
      )
      onOpenChange(false)
    }, 250)
  }

  return (
    <Sheet onOpenChange={changeOpen} open={open}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>
            {editingRow ? `Editar · ${action.title}` : action.title}
          </SheetTitle>
          <SheetDescription>{action.description}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <FieldGroup>
              {action.fields.map((field) => (
                <Field key={field.name}>
                  <FieldLabel htmlFor={`mock-${field.name}`}>
                    {field.label} {field.required ? <RequiredMark /> : null}
                  </FieldLabel>
                  <ActionFieldControl
                    field={field}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: value,
                      }))
                    }
                    value={values[field.name] ?? ""}
                  />
                </Field>
              ))}
            </FieldGroup>
          </div>
          <SheetFooter className="border-t">
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                type="button"
                variant="brand-secondary"
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  !canSubmit || saving || (editingRow !== null && !dirty)
                }
                type="submit"
              >
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                {editingRow ? "Guardar cambios" : action.submitLabel}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function ModuleMetrics({ metrics }: { metrics: ModuleDefinition["metrics"] }) {
  if (!metrics?.length) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        return (
          <MetricCard
            description={metric.description}
            icon={metric.icon}
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        )
      })}
    </div>
  )
}

function AffiliateHighlight({
  highlight,
}: {
  highlight: ModuleDefinition["highlight"]
}) {
  if (!highlight) return null

  return (
    <Card size="sm" variant="subtle">
      <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle>{highlight.label}</CardTitle>
        <CardDescription className="break-all">
          {highlight.value}
        </CardDescription>
        <div className="col-start-1 row-start-auto sm:col-start-2 sm:row-span-2 sm:row-start-1">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(highlight.value)
                toast.success("Enlace copiado.")
              } catch {
                toast.error("No se pudo copiar el enlace.")
              }
            }}
            type="button"
            variant="brand-secondary"
          >
            <Clipboard data-icon="inline-start" />
            Copiar enlace
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}

function CollectionTable({
  filter,
  icon: EmptyIcon,
  onFilterChange,
  onPageChange,
  onRowAction,
  page,
  query,
  rows: sourceRows,
  view,
}: {
  filter: string
  icon: LucideIcon
  onFilterChange: (value: string) => void
  onPageChange: (value: number) => void
  onRowAction: (action: RowAction, row: MockRow) => void
  page: number
  query: string
  rows: readonly MockRow[]
  view: ModuleView
}) {
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return sourceRows.filter(
      (row) =>
        (filter === "all" || row.status === filter) &&
        (!normalizedQuery ||
          row.search.toLocaleLowerCase("es").includes(normalizedQuery))
    )
  }, [filter, query, sourceRows])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rangeStart = filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, filteredRows.length)
  const rows = filteredRows.slice(rangeStart ? rangeStart - 1 : 0, rangeEnd)

  return (
    <>
      <DataTableToolbar>
        <DataTableFilter
          ariaLabel={`Filtrar ${view.label.toLowerCase()} por estado`}
          label="Estado"
          onValueChange={(value) => {
            onFilterChange(value)
            onPageChange(1)
          }}
          options={view.filterOptions}
          value={filter}
        />
      </DataTableToolbar>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              {view.columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {view.columns.map((column) => {
                    const cell = row.cells[column.key]
                    return (
                      <TableCell key={column.key}>
                        {cell?.badge ? (
                          <StatusBadge cell={cell} />
                        ) : (
                          <div className="min-w-0">
                            <div className="font-medium">{cell?.primary}</div>
                            {cell?.secondary ? (
                              <div className="text-sm text-muted-foreground">
                                {cell.secondary}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label="Abrir acciones"
                          size="icon-sm"
                          type="button"
                          variant="brand-secondary"
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          {view.rowActions
                            .filter(
                              (action) =>
                                !destructiveActionKinds.has(action.kind)
                            )
                            .map((action) => (
                              <DropdownMenuItem
                                key={action.label}
                                onSelect={() => onRowAction(action, row)}
                              >
                                <RowActionIcon kind={action.kind} />
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                        {view.rowActions.some((action) =>
                          destructiveActionKinds.has(action.kind)
                        ) ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              {view.rowActions
                                .filter((action) =>
                                  destructiveActionKinds.has(action.kind)
                                )
                                .map((action) => (
                                  <DropdownMenuItem
                                    key={action.label}
                                    onSelect={() => onRowAction(action, row)}
                                    variant="destructive"
                                  >
                                    <RowActionIcon kind={action.kind} />
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuGroup>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={view.columns.length + 1}>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <EmptyIcon />
                      </EmptyMedia>
                      <EmptyTitle>{view.emptyTitle}</EmptyTitle>
                      <EmptyDescription>
                        {query || filter !== "all"
                          ? "Prueba con otra búsqueda o cambia el filtro."
                          : view.emptyDescription}
                      </EmptyDescription>
                    </EmptyHeader>
                    {query || filter !== "all" ? (
                      <EmptyContent>
                        <Button
                          onClick={() => {
                            onFilterChange("all")
                            onPageChange(1)
                          }}
                          type="button"
                          variant="brand-secondary"
                        >
                          Limpiar filtro
                        </Button>
                      </EmptyContent>
                    ) : null}
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          canGoNext={currentPage < pageCount}
          canGoPrevious={currentPage > 1}
          itemLabel={view.label.toLowerCase()}
          onNextPage={() => onPageChange(currentPage + 1)}
          onPreviousPage={() => onPageChange(currentPage - 1)}
          rangeEnd={rangeEnd}
          rangeStart={rangeStart}
          total={filteredRows.length}
        />
      </CardContent>
    </>
  )
}

function actionConfirmation(action: PendingRowAction | null) {
  if (action?.action.kind === "cancel") {
    return {
      confirmLabel: "Cancelar lote",
      description:
        "El procesamiento pendiente se detendrá y el lote quedará marcado como cancelado.",
      title: "¿Cancelar este lote?",
    }
  }
  if (action?.action.kind === "revoke") {
    return {
      confirmLabel: "Revocar clave",
      description: "La clave dejará de autorizar solicitudes nuevas.",
      title: "¿Revocar esta clave?",
    }
  }
  return {
    confirmLabel: "Eliminar",
    description:
      "El registro se retirará de esta vista y la acción no se puede deshacer en esta sesión.",
    title: "¿Eliminar este registro?",
  }
}

export function PortalModuleMockup({
  moduleKey,
  viewState = "normal",
}: {
  moduleKey: PortalModuleKey
  viewState?: PortalModuleViewState
}) {
  const definition = definitions[moduleKey]
  const [recordsByView, setRecordsByView] = useState<Record<string, MockRow[]>>(
    () =>
      Object.fromEntries(
        definition.views.map((view) => [view.key, [...view.rows]])
      )
  )
  const [activeViewKey, setActiveViewKey] = useState(
    definition.views[0]?.key ?? ""
  )
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<MockRow | null>(null)
  const [detailRow, setDetailRow] = useState<MockRow | null>(null)
  const [pendingRowAction, setPendingRowAction] =
    useState<PendingRowAction | null>(null)
  const [processingAction, setProcessingAction] = useState(false)
  const activeView =
    definition.views.find((view) => view.key === activeViewKey) ??
    definition.views[0]

  if (!activeView) return null

  const currentView = activeView
  const activeRows =
    viewState === "empty" ? [] : (recordsByView[currentView.key] ?? [])
  const confirmation = actionConfirmation(pendingRowAction)

  function openSheet(row?: MockRow) {
    setEditingRow(row ?? null)
    setSheetOpen(true)
  }

  function saveRow(values: FormValues) {
    const nextRow = rowFromValues(currentView, values, editingRow ?? undefined)
    setRecordsByView((current) => ({
      ...current,
      [currentView.key]: editingRow
        ? (current[currentView.key] ?? []).map((row) =>
            row.id === editingRow.id ? nextRow : row
          )
        : [nextRow, ...(current[currentView.key] ?? [])],
    }))
    setFilter("all")
    setPage(1)
    setQuery("")
  }

  function updateRowStatus(rowId: string, status: string, label: string) {
    setRecordsByView((current) => ({
      ...current,
      [currentView.key]: (current[currentView.key] ?? []).map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                status: { badge: toneForStatus(label), primary: label },
              },
              status,
            }
          : row
      ),
    }))
  }

  function handleRowAction(action: RowAction, row: MockRow) {
    if (action.kind === "view") {
      setDetailRow(row)
      return
    }
    if (action.kind === "edit") {
      openSheet(row)
      return
    }
    if (action.kind === "execute") {
      toast.success("Ejecución añadida a la cola del mockup.")
      return
    }
    if (action.kind === "rotate") {
      toast.success("Secreto rotado en el mockup.")
      return
    }
    setPendingRowAction({ action, row })
  }

  function confirmRowAction() {
    if (!pendingRowAction) return
    const { action, row } = pendingRowAction
    setProcessingAction(true)
    window.setTimeout(() => {
      if (action.kind === "cancel") {
        updateRowStatus(row.id, "cancelled", "Cancelado")
        toast.success("Lote cancelado.")
      } else if (action.kind === "revoke") {
        updateRowStatus(row.id, "revoked", "Revocada")
        toast.success("Clave revocada.")
      } else {
        setRecordsByView((current) => ({
          ...current,
          [currentView.key]: (current[currentView.key] ?? []).filter(
            (item) => item.id !== row.id
          ),
        }))
        toast.success("Registro eliminado.")
      }
      setPendingRowAction(null)
      setProcessingAction(false)
    }, 250)
  }

  if (viewState === "loading") return <PageLoading className="min-h-80" />

  if (viewState === "error") {
    return (
      <Card variant="subtle">
        <EmptyState
          description={`No fue posible cargar ${definition.title.toLocaleLowerCase("es")}.`}
          icon={CircleAlert}
          title="No pudimos cargar esta sección"
        />
      </Card>
    )
  }

  if (viewState === "forbidden") {
    return (
      <Card variant="subtle">
        <EmptyState
          description="Tu cuenta no tiene permisos para consultar o administrar esta sección."
          icon={ShieldX}
          title="Acceso restringido"
        />
      </Card>
    )
  }

  const table = (
    <CollectionTable
      filter={filter}
      icon={definition.icon}
      onFilterChange={setFilter}
      onPageChange={setPage}
      onRowAction={handleRowAction}
      page={page}
      query={query}
      rows={activeRows}
      view={activeView}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {definition.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {definition.description}
        </p>
      </header>
      <ModuleMetrics metrics={definition.metrics} />
      <AffiliateHighlight highlight={definition.highlight} />
      <Card variant="subtle">
        <DataTableHeader
          action={
            activeView.action ? (
              <Button onClick={() => openSheet()} size="sm" type="button">
                <Plus aria-hidden="true" data-icon="inline-start" />
                {activeView.action.label}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: `Buscar en ${activeView.label.toLowerCase()}`,
            onChange: (value) => {
              setPage(1)
              setQuery(value)
            },
            placeholder: `Buscar ${activeView.label.toLowerCase()}...`,
            value: query,
          }}
        />
        {definition.views.length > 1 ? (
          <Tabs
            onValueChange={(value) => {
              setActiveViewKey(value)
              setFilter("all")
              setPage(1)
              setQuery("")
              setEditingRow(null)
            }}
            value={activeView.key}
          >
            <DataTableToolbar>
              <TabsList>
                {definition.views.map((view) => (
                  <TabsTrigger key={view.key} value={view.key}>
                    {view.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </DataTableToolbar>
            {definition.views.map((view) => (
              <TabsContent key={view.key} value={view.key}>
                {view.key === activeView.key ? table : null}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          table
        )}
      </Card>
      <ActionSheet
        action={activeView.action}
        editingRow={editingRow}
        key={`${activeView.key}-${editingRow?.id ?? "new"}-${sheetOpen ? "open" : "closed"}`}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingRow(null)
        }}
        onSave={saveRow}
        open={sheetOpen}
      />

      <Sheet
        onOpenChange={(open) => !open && setDetailRow(null)}
        open={detailRow !== null}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>
              {Object.values(detailRow?.cells ?? {})[0]?.primary ?? "Detalle"}
            </SheetTitle>
            <SheetDescription>
              Información registrada en {activeView.label.toLowerCase()}.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {activeView.columns.map((column) => {
              const cell = detailRow?.cells[column.key]
              return (
                <div className="flex flex-col gap-0.5" key={column.key}>
                  <span className="text-xs text-muted-foreground">
                    {column.label}
                  </span>
                  <span className="text-sm">{cell?.primary ?? "—"}</span>
                  {cell?.secondary ? (
                    <span className="text-xs text-muted-foreground">
                      {cell.secondary}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              onClick={() => setDetailRow(null)}
              variant="brand-secondary"
            >
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => !open && setPendingRowAction(null)}
        open={pendingRowAction !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={processingAction}
              variant="brand-secondary"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={processingAction}
              onClick={confirmRowAction}
              variant="destructive"
            >
              {processingAction ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 aria-hidden="true" data-icon="inline-start" />
              )}
              {confirmation.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export type { PortalModuleKey }
