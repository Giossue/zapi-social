"use client"

import * as React from "react"
import { adminOperationsApi, ApiError } from "@workspace/api-client"
import type { AdminOperationActionKey } from "@workspace/contracts"
import type { LucideIcon } from "lucide-react"
import {
  BadgeDollarSign,
  Check,
  CircleAlert,
  CircleDollarSign,
  EllipsisVertical,
  Eye,
  HandCoins,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldX,
  Tags,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { toast } from "@workspace/ui/components/toast"

import { Badge } from "@workspace/ui/components/badge"
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
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

export type AdminModuleKey =
  "users" | "credits" | "affiliate" | "coupons" | "payments" | "subscriptions"
type Tone = "success" | "warning" | "neutral" | "destructive"
type Icon = LucideIcon

type Metric = { label: string; value: string; description: string; icon: Icon }
type Cell = { primary: string; secondary?: string; mono?: boolean }
type Action = {
  key?: AdminOperationActionKey
  label: string
  kind?: "destructive" | "success"
}
type Row = {
  id: string
  cells: Cell[]
  status: string
  tone: Tone
  actions: Action[]
}
type Tab = {
  value: string
  label: string
  searchPlaceholder: string
  columns: string[]
  metrics: Metric[]
  rows: Row[]
  primaryAction?: {
    label: string
    icon: Icon
    dialogTitle: string
    dialogDescription: string
    fields: string[]
  }
}
type Module = { title: string; description: string; tabs: [Tab, ...Tab[]] }

const modules: Record<AdminModuleKey, Module> = {
  users: {
    title: "Usuarios",
    description: "Administra las cuentas de Portal, su acceso, plan y estado.",
    tabs: [
      {
        value: "users",
        label: "Usuarios",
        searchPlaceholder: "Buscar por nombre o correo...",
        columns: ["Usuario", "Acceso", "Plan", "Espacio", "Registro"],
        metrics: [
          {
            label: "Usuarios",
            value: "2,684",
            description: "Cuentas visibles",
            icon: Users,
          },
          {
            label: "Nuevos",
            value: "84",
            description: "Últimos 7 días",
            icon: UserPlus,
          },
          {
            label: "Con plan",
            value: "91%",
            description: "Cobertura de plan",
            icon: WalletCards,
          },
          {
            label: "Por revisar",
            value: "17",
            description: "Acceso incompleto",
            icon: ShieldX,
          },
        ],
        rows: [
          {
            id: "u1",
            cells: [
              { primary: "María Andrade", secondary: "maria@aurora.ec" },
              { primary: "Propietaria", secondary: "Aurora Studio" },
              { primary: "Profesional" },
              { primary: "Aurora Studio" },
              { primary: "8 ago 2026" },
            ],
            status: "Activo",
            tone: "success",
            actions: [
              { label: "Ver usuario" },
              { label: "Editar usuario" },
              { label: "Desactivar", kind: "destructive" },
            ],
          },
          {
            id: "u2",
            cells: [
              { primary: "Daniel Vera", secondary: "daniel@north.ec" },
              { primary: "Administración", secondary: "North Lab" },
              { primary: "Business" },
              { primary: "North Lab" },
              { primary: "6 ago 2026" },
            ],
            status: "Activo",
            tone: "success",
            actions: [
              { label: "Ver usuario" },
              { label: "Editar usuario" },
              { label: "Desactivar", kind: "destructive" },
            ],
          },
          {
            id: "u3",
            cells: [
              { primary: "Sofía Torres", secondary: "sofia@demo.ec" },
              { primary: "Miembro", secondary: "Demo Workspace" },
              { primary: "Gratis" },
              { primary: "Demo Workspace" },
              { primary: "1 ago 2026" },
            ],
            status: "Revisar",
            tone: "warning",
            actions: [
              { label: "Ver usuario" },
              { label: "Editar usuario" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
        ],
        primaryAction: {
          label: "Crear usuario",
          icon: UserPlus,
          dialogTitle: "Crear usuario",
          dialogDescription:
            "Crea una cuenta de Portal y asigna su acceso inicial.",
          fields: ["Nombre visible", "Correo electrónico", "Plan"],
        },
      },
    ],
  },
  credits: {
    title: "Créditos",
    description:
      "Controla paquetes, movimientos y consumo de créditos del sistema.",
    tabs: [
      {
        value: "packs",
        label: "Paquetes",
        searchPlaceholder: "Buscar paquete...",
        columns: ["Paquete", "Créditos", "Precio", "Compras", "Orden"],
        metrics: [
          {
            label: "Paquetes",
            value: "4",
            description: "Ofertas configuradas",
            icon: BadgeDollarSign,
          },
          {
            label: "Activos",
            value: "3",
            description: "Disponibles en Portal",
            icon: Check,
          },
          {
            label: "Destacados",
            value: "1",
            description: "Oferta principal",
            icon: PackagePlus,
          },
          {
            label: "Ventas",
            value: "326",
            description: "Compras históricas",
            icon: ReceiptText,
          },
        ],
        rows: [
          {
            id: "cp1",
            cells: [
              { primary: "Impulso", secondary: "impulso-500" },
              { primary: "500" },
              { primary: "USD 9.00" },
              { primary: "184" },
              { primary: "1" },
            ],
            status: "Activo",
            tone: "success",
            actions: [
              { label: "Editar paquete" },
              { label: "Duplicar" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
          {
            id: "cp2",
            cells: [
              { primary: "Crecimiento", secondary: "crecimiento-1500" },
              { primary: "1,500" },
              { primary: "USD 24.00" },
              { primary: "109" },
              { primary: "2" },
            ],
            status: "Activo",
            tone: "success",
            actions: [
              { label: "Editar paquete" },
              { label: "Duplicar" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
          {
            id: "cp3",
            cells: [
              { primary: "Escala", secondary: "escala-5000" },
              { primary: "5,000" },
              { primary: "USD 69.00" },
              { primary: "33" },
              { primary: "3" },
            ],
            status: "Oculto",
            tone: "neutral",
            actions: [
              { label: "Editar paquete" },
              { label: "Activar", kind: "success" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
        ],
        primaryAction: {
          label: "Añadir paquete",
          icon: PackagePlus,
          dialogTitle: "Nuevo paquete de créditos",
          dialogDescription:
            "Define una oferta de recarga disponible para los clientes.",
          fields: ["Nombre", "Créditos", "Precio"],
        },
      },
      {
        value: "ledger",
        label: "Movimientos",
        searchPlaceholder: "Buscar usuario, paquete o movimiento...",
        columns: ["Usuario", "Tipo", "Paquete", "Créditos", "Saldo", "Fecha"],
        metrics: [
          {
            label: "Movimientos",
            value: "8,942",
            description: "Filas del libro",
            icon: ReceiptText,
          },
          {
            label: "Compras",
            value: "326",
            description: "Recargas pagadas",
            icon: CircleDollarSign,
          },
          {
            label: "Otorgados",
            value: "684k",
            description: "Compras y ajustes",
            icon: BadgeDollarSign,
          },
          {
            label: "Disponibles",
            value: "291k",
            description: "Saldo abierto",
            icon: WalletCards,
          },
        ],
        rows: [
          {
            id: "cl1",
            cells: [
              { primary: "María Andrade", secondary: "maria@aurora.ec" },
              { primary: "Compra" },
              { primary: "Crecimiento" },
              { primary: "+1,500" },
              { primary: "1,420" },
              { primary: "8 ago 2026" },
            ],
            status: "Aplicado",
            tone: "success",
            actions: [{ label: "Ver movimiento" }],
          },
          {
            id: "cl2",
            cells: [
              { primary: "Daniel Vera", secondary: "daniel@north.ec" },
              { primary: "Consumo" },
              { primary: "Impulso" },
              { primary: "-24" },
              { primary: "318" },
              { primary: "8 ago 2026" },
            ],
            status: "Aplicado",
            tone: "success",
            actions: [{ label: "Ver movimiento" }],
          },
          {
            id: "cl3",
            cells: [
              { primary: "Sofía Torres", secondary: "sofia@demo.ec" },
              { primary: "Ajuste" },
              { primary: "—" },
              { primary: "+100" },
              { primary: "100" },
              { primary: "7 ago 2026" },
            ],
            status: "Manual",
            tone: "warning",
            actions: [{ label: "Ver movimiento" }],
          },
        ],
      },
      {
        value: "usage",
        label: "Uso",
        searchPlaceholder: "Buscar usuario, acción o función...",
        columns: [
          "Usuario",
          "Acción",
          "Función",
          "Créditos",
          "Cantidad",
          "Fecha",
        ],
        metrics: [
          {
            label: "Registros",
            value: "12,406",
            description: "Usos medidos",
            icon: ReceiptText,
          },
          {
            label: "Consumidos",
            value: "393k",
            description: "Créditos gastados",
            icon: BadgeDollarSign,
          },
          {
            label: "Usuarios",
            value: "1,204",
            description: "Consumidores únicos",
            icon: Users,
          },
          {
            label: "Acciones",
            value: "18",
            description: "Claves de consumo",
            icon: RotateCcw,
          },
        ],
        rows: [
          {
            id: "cu1",
            cells: [
              { primary: "María Andrade", secondary: "maria@aurora.ec" },
              { primary: "ai.image.generate", mono: true },
              { primary: "Generación de imagen" },
              { primary: "18" },
              { primary: "1" },
              { primary: "8 ago 2026" },
            ],
            status: "Cobrado",
            tone: "success",
            actions: [{ label: "Ver detalle" }],
          },
          {
            id: "cu2",
            cells: [
              { primary: "Daniel Vera", secondary: "daniel@north.ec" },
              { primary: "ai.copy.generate", mono: true },
              { primary: "Generación de texto" },
              { primary: "6" },
              { primary: "3" },
              { primary: "8 ago 2026" },
            ],
            status: "Cobrado",
            tone: "success",
            actions: [{ label: "Ver detalle" }],
          },
          {
            id: "cu3",
            cells: [
              { primary: "Sofía Torres", secondary: "sofia@demo.ec" },
              { primary: "ai.video.generate", mono: true },
              { primary: "Generación de video" },
              { primary: "40" },
              { primary: "1" },
              { primary: "7 ago 2026" },
            ],
            status: "Revertido",
            tone: "neutral",
            actions: [{ label: "Ver detalle" }],
          },
        ],
      },
    ],
  },
  affiliate: {
    title: "Afiliados",
    description: "Revisa referidos, comisiones y solicitudes de retiro.",
    tabs: [
      {
        value: "overview",
        label: "Afiliados",
        searchPlaceholder: "Buscar afiliado o código...",
        columns: ["Afiliado", "Código", "Clics", "Conversiones", "Saldo"],
        metrics: [
          {
            label: "Afiliados",
            value: "148",
            description: "Perfiles activos",
            icon: HandCoins,
          },
          {
            label: "Clics",
            value: "8,294",
            description: "Visitas referidas",
            icon: Eye,
          },
          {
            label: "Conversiones",
            value: "376",
            description: "Pagos atribuidos",
            icon: Check,
          },
          {
            label: "Aprobado",
            value: "$4,820",
            description: "Ganancia histórica",
            icon: CircleDollarSign,
          },
        ],
        rows: [
          {
            id: "a1",
            cells: [
              { primary: "Lucía Paz", secondary: "lucia@creator.ec" },
              { primary: "LUCIA20", mono: true },
              { primary: "1,842" },
              { primary: "94" },
              { primary: "USD 420.00" },
            ],
            status: "Activo",
            tone: "success",
            actions: [{ label: "Ver afiliado" }, { label: "Ver comisiones" }],
          },
          {
            id: "a2",
            cells: [
              { primary: "Marco Ruiz", secondary: "marco@agency.ec" },
              { primary: "MARCO10", mono: true },
              { primary: "986" },
              { primary: "47" },
              { primary: "USD 184.50" },
            ],
            status: "Activo",
            tone: "success",
            actions: [{ label: "Ver afiliado" }, { label: "Ver comisiones" }],
          },
          {
            id: "a3",
            cells: [
              { primary: "Elena Mora", secondary: "elena@demo.ec" },
              { primary: "ELENA15", mono: true },
              { primary: "124" },
              { primary: "3" },
              { primary: "USD 18.00" },
            ],
            status: "Pausado",
            tone: "neutral",
            actions: [
              { label: "Ver afiliado" },
              { label: "Reactivar", kind: "success" },
            ],
          },
        ],
      },
      {
        value: "commissions",
        label: "Comisiones",
        searchPlaceholder: "Buscar afiliado, referido o pago...",
        columns: ["Afiliado", "Referido", "Pago", "Comisión", "Creada"],
        metrics: [
          {
            label: "Comisiones",
            value: "376",
            description: "Registros totales",
            icon: ReceiptText,
          },
          {
            label: "Pendientes",
            value: "42",
            description: "En período de espera",
            icon: RotateCcw,
          },
          {
            label: "Disponibles",
            value: "$1,284",
            description: "Listas para retirar",
            icon: CircleDollarSign,
          },
          {
            label: "Rechazadas",
            value: "9",
            description: "No elegibles",
            icon: X,
          },
        ],
        rows: [
          {
            id: "ac1",
            cells: [
              { primary: "Lucía Paz" },
              { primary: "Carlos Peña", secondary: "carlos@buyer.ec" },
              { primary: "INV-10482", mono: true },
              { primary: "USD 12.00" },
              { primary: "8 ago 2026" },
            ],
            status: "Pendiente",
            tone: "warning",
            actions: [
              { label: "Aprobar", kind: "success" },
              { label: "Rechazar", kind: "destructive" },
            ],
          },
          {
            id: "ac2",
            cells: [
              { primary: "Marco Ruiz" },
              { primary: "Ana Ríos", secondary: "ana@buyer.ec" },
              { primary: "INV-10461", mono: true },
              { primary: "USD 8.70" },
              { primary: "6 ago 2026" },
            ],
            status: "Disponible",
            tone: "success",
            actions: [{ label: "Ver detalle" }],
          },
          {
            id: "ac3",
            cells: [
              { primary: "Lucía Paz" },
              { primary: "Diego Sol", secondary: "diego@buyer.ec" },
              { primary: "INV-10392", mono: true },
              { primary: "USD 12.00" },
              { primary: "31 jul 2026" },
            ],
            status: "Pagada",
            tone: "neutral",
            actions: [{ label: "Ver detalle" }],
          },
        ],
      },
      {
        value: "withdrawals",
        label: "Retiros",
        searchPlaceholder: "Buscar afiliado, retiro o método...",
        columns: ["Afiliado", "Solicitud", "Método", "Importe", "Solicitada"],
        metrics: [
          {
            label: "Solicitudes",
            value: "64",
            description: "Retiros históricos",
            icon: ReceiptText,
          },
          {
            label: "Pendientes",
            value: "7",
            description: "Esperan revisión",
            icon: RotateCcw,
          },
          {
            label: "Aprobados",
            value: "$940",
            description: "Listos para pagar",
            icon: Check,
          },
          {
            label: "Pagados",
            value: "$3,520",
            description: "Acumulado enviado",
            icon: CircleDollarSign,
          },
        ],
        rows: [
          {
            id: "aw1",
            cells: [
              { primary: "Lucía Paz", secondary: "lucia@creator.ec" },
              { primary: "WD-0084", mono: true },
              { primary: "PayPal" },
              { primary: "USD 240.00" },
              { primary: "8 ago 2026" },
            ],
            status: "Pendiente",
            tone: "warning",
            actions: [
              { label: "Aprobar", kind: "success" },
              { label: "Rechazar", kind: "destructive" },
            ],
          },
          {
            id: "aw2",
            cells: [
              { primary: "Marco Ruiz", secondary: "marco@agency.ec" },
              { primary: "WD-0081", mono: true },
              { primary: "Transferencia" },
              { primary: "USD 180.00" },
              { primary: "5 ago 2026" },
            ],
            status: "Aprobado",
            tone: "success",
            actions: [
              { label: "Marcar pagado", kind: "success" },
              { label: "Ver detalle" },
            ],
          },
          {
            id: "aw3",
            cells: [
              { primary: "Elena Mora", secondary: "elena@demo.ec" },
              { primary: "WD-0074", mono: true },
              { primary: "PayPal" },
              { primary: "USD 96.00" },
              { primary: "28 jul 2026" },
            ],
            status: "Pagado",
            tone: "neutral",
            actions: [{ label: "Ver detalle" }],
          },
        ],
      },
    ],
  },
  coupons: {
    title: "Cupones",
    description: "Administra descuentos, vigencia, límites y planes elegibles.",
    tabs: [
      {
        value: "coupons",
        label: "Cupones",
        searchPlaceholder: "Buscar nombre, código o descuento...",
        columns: ["Cupón", "Descuento", "Uso", "Planes", "Vigencia"],
        metrics: [
          {
            label: "Cupones",
            value: "18",
            description: "Códigos creados",
            icon: Tags,
          },
          {
            label: "Activos",
            value: "11",
            description: "Disponibles hoy",
            icon: Check,
          },
          {
            label: "Canjes",
            value: "438",
            description: "Usos acumulados",
            icon: ReceiptText,
          },
          {
            label: "Sin límite",
            value: "4",
            description: "Uso ilimitado",
            icon: RotateCcw,
          },
        ],
        rows: [
          {
            id: "co1",
            cells: [
              { primary: "Bienvenida", secondary: "HOLA20", mono: true },
              { primary: "20%" },
              { primary: "184 / 500" },
              { primary: "Profesional, Business" },
              { primary: "1–31 ago 2026" },
            ],
            status: "Activo",
            tone: "success",
            actions: [
              { label: "Editar cupón" },
              { label: "Duplicar" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
          {
            id: "co2",
            cells: [
              { primary: "Lanzamiento", secondary: "ZAPI10", mono: true },
              { primary: "USD 10.00" },
              { primary: "76 / ∞" },
              { primary: "Todos los pagos" },
              { primary: "Sin vencimiento" },
            ],
            status: "Activo",
            tone: "success",
            actions: [
              { label: "Editar cupón" },
              { label: "Duplicar" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
          {
            id: "co3",
            cells: [
              { primary: "Black Friday", secondary: "BLACK30", mono: true },
              { primary: "30%" },
              { primary: "178 / 200" },
              { primary: "Business" },
              { primary: "Finalizó 30 nov 2025" },
            ],
            status: "Vencido",
            tone: "neutral",
            actions: [
              { label: "Editar cupón" },
              { label: "Duplicar" },
              { label: "Eliminar", kind: "destructive" },
            ],
          },
        ],
        primaryAction: {
          label: "Crear cupón",
          icon: Plus,
          dialogTitle: "Crear cupón",
          dialogDescription:
            "Configura el descuento que Polar aplicará durante el checkout.",
          fields: ["Nombre", "Código", "Valor del descuento"],
        },
      },
    ],
  },
  payments: {
    title: "Pagos",
    description:
      "Consulta transacciones procesadas únicamente mediante Polar.sh.",
    tabs: [
      {
        value: "payments",
        label: "Pagos",
        searchPlaceholder: "Buscar factura, usuario o transacción...",
        columns: [
          "Factura",
          "Usuario",
          "Producto",
          "Transacción",
          "Importe",
          "Fecha",
        ],
        metrics: [
          {
            label: "Transacciones",
            value: "1,284",
            description: "Registros de Polar",
            icon: ReceiptText,
          },
          {
            label: "Completadas",
            value: "1,198",
            description: "Pagos confirmados",
            icon: Check,
          },
          {
            label: "Reembolsadas",
            value: "18",
            description: "Total o parcial",
            icon: RotateCcw,
          },
          {
            label: "Volumen",
            value: "$38,420",
            description: "Importe completado",
            icon: CircleDollarSign,
          },
        ],
        rows: [
          {
            id: "p1",
            cells: [
              { primary: "INV-10482", secondary: "Polar.sh", mono: true },
              { primary: "Carlos Peña", secondary: "carlos@buyer.ec" },
              { primary: "Profesional mensual" },
              { primary: "chk_7c91…12af", mono: true },
              { primary: "USD 29.00" },
              { primary: "8 ago 2026" },
            ],
            status: "Completado",
            tone: "success",
            actions: [
              { label: "Ver recibo" },
              { label: "Reembolsar", kind: "destructive" },
            ],
          },
          {
            id: "p2",
            cells: [
              { primary: "INV-10481", secondary: "Polar.sh", mono: true },
              { primary: "Ana Ríos", secondary: "ana@buyer.ec" },
              { primary: "Business mensual" },
              { primary: "chk_6bd2…7c40", mono: true },
              { primary: "USD 79.00" },
              { primary: "8 ago 2026" },
            ],
            status: "Pendiente",
            tone: "warning",
            actions: [{ label: "Ver detalle" }, { label: "Sincronizar" }],
          },
          {
            id: "p3",
            cells: [
              { primary: "INV-10420", secondary: "Polar.sh", mono: true },
              { primary: "Diego Sol", secondary: "diego@buyer.ec" },
              { primary: "Crecimiento · créditos" },
              { primary: "chk_29fa…003b", mono: true },
              { primary: "USD 24.00" },
              { primary: "31 jul 2026" },
            ],
            status: "Reembolsado",
            tone: "neutral",
            actions: [{ label: "Ver recibo" }, { label: "Ver reembolso" }],
          },
        ],
      },
    ],
  },
  subscriptions: {
    title: "Suscripciones",
    description:
      "Supervisa renovaciones, cobros fallidos y cancelaciones en Polar.sh.",
    tabs: [
      {
        value: "subscriptions",
        label: "Suscripciones",
        searchPlaceholder: "Buscar suscripción, cliente o plan...",
        columns: [
          "Suscripción",
          "Cliente",
          "Plan",
          "Importe",
          "Renovación",
          "Actualizada",
        ],
        metrics: [
          {
            label: "Suscripciones",
            value: "842",
            description: "Registros de Polar",
            icon: ReceiptText,
          },
          {
            label: "Activas",
            value: "779",
            description: "Renovación vigente",
            icon: Check,
          },
          {
            label: "En mora",
            value: "21",
            description: "Polar reintentando",
            icon: RotateCcw,
          },
          {
            label: "MRR",
            value: "$24,980",
            description: "Valor mensual activo",
            icon: CircleDollarSign,
          },
        ],
        rows: [
          {
            id: "s1",
            cells: [
              { primary: "sub_018f…81a2", secondary: "Polar.sh", mono: true },
              { primary: "Carlos Peña", secondary: "carlos@buyer.ec" },
              { primary: "Profesional mensual" },
              { primary: "USD 29.00 / mes" },
              { primary: "8 sep 2026" },
              { primary: "8 ago 2026" },
            ],
            status: "Activa",
            tone: "success",
            actions: [
              { label: "Ver suscripción" },
              { label: "Cancelar al final" },
              { label: "Revocar ahora", kind: "destructive" },
            ],
          },
          {
            id: "s2",
            cells: [
              { primary: "sub_019a…d18c", secondary: "Polar.sh", mono: true },
              { primary: "Ana Ríos", secondary: "ana@buyer.ec" },
              { primary: "Business mensual" },
              { primary: "USD 79.00 / mes" },
              { primary: "11 ago 2026" },
              { primary: "8 ago 2026" },
            ],
            status: "En mora",
            tone: "warning",
            actions: [
              { label: "Ver suscripción" },
              { label: "Abrir cliente en Polar" },
              { label: "Revocar ahora", kind: "destructive" },
            ],
          },
          {
            id: "s3",
            cells: [
              { primary: "sub_017b…903f", secondary: "Polar.sh", mono: true },
              { primary: "Diego Sol", secondary: "diego@buyer.ec" },
              { primary: "Profesional anual" },
              { primary: "USD 290.00 / año" },
              { primary: "Finaliza 31 ago 2026" },
              { primary: "31 jul 2026" },
            ],
            status: "Cancela al final",
            tone: "neutral",
            actions: [
              { label: "Ver suscripción" },
              { label: "Reactivar", kind: "success" },
              { label: "Revocar ahora", kind: "destructive" },
            ],
          },
        ],
      },
    ],
  },
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  if (tone === "success")
    return (
      <Badge variant="success">
        <span className="size-1.5 rounded-full bg-success" />
        {label}
      </Badge>
    )
  if (tone === "destructive")
    return <Badge variant="destructive">{label}</Badge>
  if (tone === "warning")
    return (
      <Badge variant="warning">
        <span className="size-1.5 rounded-full bg-current" />
        {label}
      </Badge>
    )
  return <Badge variant="neutral">{label}</Badge>
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <FieldLabel>
      {children}
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
    </FieldLabel>
  )
}

function RowActionIcon({ action, index }: { action: Action; index: number }) {
  if (action.kind === "destructive") return <Trash2 />
  if (action.kind === "success") return <Check />
  if (index === 0) return <Eye />
  return <Pencil />
}

function editValuesFor(
  moduleKey: AdminModuleKey,
  row: Row,
  fieldCount: number
) {
  if (moduleKey === "users") {
    return [
      row.cells[0]?.primary ?? "",
      row.cells[0]?.secondary ?? "",
      row.cells[2]?.primary ?? "",
    ]
  }
  if (moduleKey === "credits") {
    return [
      row.cells[0]?.primary ?? "",
      row.cells[1]?.primary ?? "",
      row.cells[2]?.primary ?? "",
    ]
  }
  if (moduleKey === "coupons") {
    return [
      row.cells[0]?.primary ?? "",
      row.cells[0]?.secondary ?? "",
      row.cells[1]?.primary ?? "",
    ]
  }
  return Array.from({ length: fieldCount }, () => "")
}

type AdminModuleViewState =
  "normal" | "loading" | "empty" | "error" | "forbidden"

export function AdminModulePreview({
  moduleKey,
  viewState = "normal",
}: {
  moduleKey: AdminModuleKey
  viewState?: AdminModuleViewState
}) {
  const moduleConfig = modules[moduleKey]
  const firstTab = moduleConfig.tabs[0]
  const [activeTab, setActiveTab] = React.useState(firstTab.value)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [pageIndex, setPageIndex] = React.useState(0)
  const pageSize = 10
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
  const [detailRow, setDetailRow] = React.useState<Row | null>(null)
  const [formValues, setFormValues] = React.useState<string[]>([])
  const [remote, setRemote] = React.useState<Awaited<
    ReturnType<typeof adminOperationsApi.view>
  > | null>(null)
  const [requestState, setRequestState] = React.useState<
    "loading" | "ready" | "error" | "forbidden"
  >("loading")
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [saving, setSaving] = React.useState(false)
  const [pendingDestructive, setPendingDestructive] = React.useState<{
    action: string
    actionKey: AdminOperationActionKey
    id: string
    resource: string
  } | null>(null)
  const active =
    moduleConfig.tabs.find((tab) => tab.value === activeTab) ?? firstTab
  const rows = viewState === "empty" ? [] : (remote?.rows ?? [])
  const statuses = remote?.statusOptions ?? []
  const pageCount = remote?.pagination.pageCount ?? 1
  const currentPageIndex = (remote?.pagination.page ?? pageIndex + 1) - 1
  const paginatedRows = rows
  const rangeStart = remote?.pagination.rangeStart ?? 0
  const rangeEnd = remote?.pagination.rangeEnd ?? 0
  const total = remote?.pagination.total ?? 0
  const metrics = remote
    ? remote.metrics.map((metric) => ({
        ...metric,
        icon:
          active.metrics.find((candidate) => candidate.label === metric.label)
            ?.icon ?? CircleAlert,
      }))
    : active.metrics
  const primaryAction = active.primaryAction
  const PrimaryIcon = primaryAction?.icon
  const formComplete =
    primaryAction?.fields.every((_, index) =>
      Boolean(formValues[index]?.trim())
    ) ?? true

  React.useEffect(() => {
    let current = true
    const timer = window.setTimeout(
      () => {
        setRequestState((current) =>
          current === "ready" ? current : "loading"
        )
        void adminOperationsApi
          .view(moduleKey, {
            tab: activeTab,
            q: search || undefined,
            status,
            page: pageIndex + 1,
            pageSize,
          })
          .then((response) => {
            if (!current) return
            setRemote(response)
            setRequestState("ready")
          })
          .catch((error: unknown) => {
            if (!current) return
            setRequestState(
              error instanceof ApiError && error.status === 403
                ? "forbidden"
                : "error"
            )
          })
      },
      search ? 250 : 0
    )
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [activeTab, moduleKey, pageIndex, pageSize, refreshKey, search, status])

  if (viewState === "loading" || (requestState === "loading" && !remote)) {
    return <PageLoading className="min-h-80" />
  }

  if (viewState === "error" || requestState === "error") {
    return (
      <EmptyState
        action={
          <RetryButton
            onClick={() => setRefreshKey((current) => current + 1)}
          />
        }
        description={`No fue posible cargar ${moduleConfig.title.toLowerCase()}.`}
        icon={CircleAlert}
        title="No pudimos cargar esta sección"
      />
    )
  }

  if (viewState === "forbidden" || requestState === "forbidden") {
    return (
      <EmptyState
        description="Tu cuenta no tiene permisos para administrar esta sección de la plataforma."
        icon={ShieldX}
        title="Acceso restringido"
      />
    )
  }

  function changeTab(value: string) {
    setActiveTab(value)
    setSearch("")
    setStatus("all")
    setPageIndex(0)
    setFormValues([])
    setRemote(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {moduleConfig.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {moduleConfig.description}
        </p>
      </header>

      {moduleConfig.tabs.length > 1 ? (
        <Tabs onValueChange={changeTab} value={activeTab}>
          <TabsList aria-label={`Secciones de ${moduleConfig.title}`}>
            {moduleConfig.tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <Card variant="subtle">
        <DataTableHeader
          action={
            primaryAction && PrimaryIcon ? (
              <Button
                disabled={saving}
                onClick={() => {
                  setFormValues(primaryAction.fields.map(() => ""))
                  setEditingRowId(null)
                  setDialogOpen(true)
                }}
                size="sm"
              >
                <PrimaryIcon aria-hidden="true" data-icon="inline-start" />
                {primaryAction.label}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: `Buscar en ${active.label}`,
            onChange: (value) => {
              setSearch(value)
              setPageIndex(0)
            },
            placeholder: active.searchPlaceholder,
            value: search,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel="Filtrar por estado"
              label="Estado"
              onValueChange={(value) => {
                setStatus(value)
                setPageIndex(0)
              }}
              options={[
                { label: "Todos los estados", value: "all" },
                ...statuses.map((item) => ({ label: item, value: item })),
              ]}
              value={status}
            />
          </DataTableToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                {active.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow key={row.id}>
                  {row.cells.map((cell, index) => (
                    <TableCell
                      key={`${row.id}-${active.columns[index] ?? index}`}
                    >
                      <div className="grid gap-0.5">
                        <span
                          className={
                            cell.mono ? "font-mono text-xs" : "font-medium"
                          }
                        >
                          {cell.primary}
                        </span>
                        {cell.secondary ? (
                          <span className="text-xs text-muted-foreground">
                            {cell.secondary}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell>
                    <StatusBadge label={row.status} tone={row.tone} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Acciones para ${row.cells[0]?.primary ?? row.id}`}
                          size="icon-sm"
                          variant="brand-secondary"
                        >
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.actions.map((action, index) => (
                          <React.Fragment key={action.label}>
                            {action.kind === "destructive" && index > 0 ? (
                              <DropdownMenuSeparator />
                            ) : null}
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                disabled={saving}
                                variant={
                                  action.kind === "destructive"
                                    ? "destructive"
                                    : undefined
                                }
                                onSelect={() => {
                                  if (!action.key) return
                                  if (action.kind === "destructive") {
                                    setPendingDestructive({
                                      action: action.label,
                                      actionKey: action.key,
                                      id: row.id,
                                      resource: row.cells[0]?.primary ?? row.id,
                                    })
                                    return
                                  }
                                  if (action.key === "view") {
                                    if (
                                      moduleKey === "affiliate" &&
                                      action.label === "Ver comisiones"
                                    ) {
                                      setActiveTab("commissions")
                                      setSearch(row.cells[0]?.primary ?? "")
                                      setPageIndex(0)
                                      return
                                    }
                                    setDetailRow(row)
                                    return
                                  }
                                  if (action.key === "edit" && primaryAction) {
                                    setEditingRowId(row.id)
                                    setFormValues(
                                      editValuesFor(
                                        moduleKey,
                                        row,
                                        primaryAction.fields.length
                                      )
                                    )
                                    setDialogOpen(true)
                                    return
                                  }
                                  setSaving(true)
                                  void adminOperationsApi
                                    .action(
                                      moduleKey,
                                      activeTab,
                                      row.id,
                                      action.key
                                    )
                                    .then((result) => {
                                      toast.success(result.message)
                                      setRefreshKey((current) => current + 1)
                                    })
                                    .catch(() =>
                                      toast.error(
                                        "No se pudo aplicar la acción."
                                      )
                                    )
                                    .finally(() => setSaving(false))
                                }}
                              >
                                <RowActionIcon action={action} index={index} />
                                {action.label}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </React.Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="h-40 text-center text-muted-foreground"
                    colSpan={active.columns.length + 2}
                  >
                    No hay resultados para esta búsqueda.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={currentPageIndex < pageCount - 1}
            canGoPrevious={currentPageIndex > 0}
            itemLabel="resultados"
            onNextPage={() =>
              setPageIndex((current) => Math.min(current + 1, pageCount - 1))
            }
            onPreviousPage={() =>
              setPageIndex((current) => Math.max(current - 1, 0))
            }
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            total={total}
          />
        </CardContent>
      </Card>

      {primaryAction ? (
        <Sheet
          onOpenChange={(open) => {
            if (!saving) setDialogOpen(open)
          }}
          open={dialogOpen}
        >
          <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                if (!formComplete) {
                  toast.error("Completa todos los campos obligatorios.")
                  return
                }
                setSaving(true)
                const operation = editingRowId
                  ? adminOperationsApi.action(
                      moduleKey,
                      activeTab,
                      editingRowId,
                      "edit",
                      formValues
                    )
                  : adminOperationsApi.create(moduleKey, formValues)
                void operation
                  .then((result) => {
                    setDialogOpen(false)
                    setEditingRowId(null)
                    toast.success(result.message)
                    setRefreshKey((current) => current + 1)
                  })
                  .catch(() =>
                    toast.error("No se pudieron guardar los cambios.")
                  )
                  .finally(() => setSaving(false))
              }}
            >
              <SheetHeader className="border-b pr-12">
                <SheetTitle>{primaryAction.dialogTitle}</SheetTitle>
                <SheetDescription>
                  {primaryAction.dialogDescription}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <FieldGroup>
                  {primaryAction.fields.map((field, index) => (
                    <Field key={field}>
                      <RequiredLabel>{field}</RequiredLabel>
                      <Input
                        aria-required="true"
                        name={`field-${index}`}
                        onChange={(event) =>
                          setFormValues((current) =>
                            current.map((value, valueIndex) =>
                              valueIndex === index ? event.target.value : value
                            )
                          )
                        }
                        placeholder={field}
                        value={formValues[index] ?? ""}
                      />
                    </Field>
                  ))}
                </FieldGroup>
              </div>
              <SheetFooter className="flex-row justify-end border-t">
                <Button
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                  type="button"
                  variant="brand-secondary"
                >
                  Cancelar
                </Button>
                <Button disabled={!formComplete || saving} type="submit">
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Plus aria-hidden="true" data-icon="inline-start" />
                  )}
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      ) : null}

      <Sheet
        onOpenChange={(open) => !open && setDetailRow(null)}
        open={detailRow !== null}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{detailRow?.cells[0]?.primary ?? "Detalle"}</SheetTitle>
            <SheetDescription>
              Información registrada en esta sección administrativa.
            </SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
            {detailRow?.cells.map((cell, index) => (
              <div className="grid gap-0.5" key={`${cell.primary}-${index}`}>
                <span className="text-xs text-muted-foreground">
                  {active.columns[index] ?? `Campo ${index + 1}`}
                </span>
                <span className={cell.mono ? "font-mono text-sm" : "text-sm"}>
                  {cell.primary}
                </span>
                {cell.secondary ? (
                  <span className="text-xs text-muted-foreground">
                    {cell.secondary}
                  </span>
                ) : null}
              </div>
            ))}
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
        onOpenChange={(open) => {
          if (!open && !saving) setPendingDestructive(null)
        }}
        open={pendingDestructive !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDestructive
                ? `${pendingDestructive.action} sobre ${pendingDestructive.resource}. Esta acción quedará registrada en auditoría.`
                : "Confirma la acción seleccionada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} variant="brand-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                const pending = pendingDestructive
                if (!pending || saving) return
                setSaving(true)
                void adminOperationsApi
                  .action(moduleKey, activeTab, pending.id, pending.actionKey)
                  .then((result) => {
                    toast.success(result.message)
                    setRefreshKey((current) => current + 1)
                    setPendingDestructive(null)
                  })
                  .catch(() => toast.error("No se pudo aplicar la acción."))
                  .finally(() => setSaving(false))
              }}
              variant="destructive"
            >
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {saving ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function PlatformAdminPreview() {
  const [moduleKey, setModuleKey] = React.useState<AdminModuleKey>("users")
  return (
    <div className="space-y-6">
      <Tabs
        onValueChange={(value) => setModuleKey(value as AdminModuleKey)}
        value={moduleKey}
      >
        <TabsList
          className="flex h-auto flex-wrap"
          aria-label="Mockups de administración"
        >
          {(
            [
              "users",
              "credits",
              "affiliate",
              "coupons",
              "payments",
              "subscriptions",
            ] as const
          ).map((key) => (
            <TabsTrigger key={key} value={key}>
              {modules[key].title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <AdminModulePreview moduleKey={moduleKey} />
    </div>
  )
}
