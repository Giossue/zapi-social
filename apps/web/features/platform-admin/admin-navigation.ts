import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bot,
  BrainCircuit,
  Cable,
  CreditCard,
  FileQuestion,
  FileText,
  Gauge,
  Globe2,
  HandCoins,
  KeyRound,
  Landmark,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  PackageCheck,
  PlugZap,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
} from "lucide-react"

export type AdminNavigationLink = {
  label: string
  href: string
  icon: LucideIcon
}
export type AdminNavigationGroup = {
  label: string
  items: readonly AdminNavigationLink[]
}

export const adminNavigationGroups: readonly AdminNavigationGroup[] = [
  {
    label: "General",
    items: [
      { label: "Resumen", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { label: "Integraciones", href: "/admin/integrations", icon: PlugZap },
      { label: "Usuarios", href: "/admin/users", icon: Users },
      { label: "Planes", href: "/admin/plans", icon: PackageCheck },
      { label: "Créditos", href: "/admin/credits", icon: BadgeDollarSign },
      { label: "Afiliados", href: "/admin/affiliate", icon: HandCoins },
      { label: "Cupones", href: "/admin/coupons", icon: Tags },
      { label: "Pagos", href: "/admin/payments", icon: CreditCard },
      {
        label: "Pagos manuales",
        href: "/admin/manual-payments",
        icon: Landmark,
      },
      {
        label: "Reporte de pagos",
        href: "/admin/payment-report",
        icon: ReceiptText,
      },
      {
        label: "Suscripciones",
        href: "/admin/subscriptions",
        icon: ReceiptText,
      },
    ],
  },
  {
    label: "Soporte",
    items: [
      { label: "Casos", href: "/admin/support", icon: LifeBuoy },
      { label: "Anuncios", href: "/admin/notifications", icon: Megaphone },
    ],
  },
  {
    label: "Contenido",
    items: [
      { label: "Blogs", href: "/admin/blogs", icon: FileText },
      {
        label: "Categorías de blog",
        href: "/admin/blog-categories",
        icon: Tags,
      },
      { label: "Etiquetas de blog", href: "/admin/blog-tags", icon: Tags },
      {
        label: "Preguntas frecuentes",
        href: "/admin/faqs",
        icon: FileQuestion,
      },
      { label: "Idiomas", href: "/admin/languages", icon: Languages },
    ],
  },
  {
    label: "AI",
    items: [
      {
        label: "Configuración AI",
        href: "/admin/settings/ai",
        icon: BrainCircuit,
      },
      { label: "Plantillas AI", href: "/admin/ai-templates", icon: Bot },
      {
        label: "Categorías AI",
        href: "/admin/ai-template-categories",
        icon: Tags,
      },
      { label: "Uso AI", href: "/admin/ai-usage-logs", icon: BarChart3 },
      { label: "Reporte AI", href: "/admin/ai-report", icon: Gauge },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Configuración general",
        href: "/admin/settings/general",
        icon: Settings2,
      },
      {
        label: "Reglas de autenticación",
        href: "/admin/settings/auth",
        icon: KeyRound,
      },
      { label: "Captcha", href: "/admin/settings/captcha", icon: ShieldCheck },
      {
        label: "Plantillas de correo",
        href: "/admin/email-templates",
        icon: Mail,
      },
      {
        label: "Analítica",
        href: "/admin/settings/analytics",
        icon: BarChart3,
      },
      {
        label: "Páginas estáticas",
        href: "/admin/settings/static-pages",
        icon: Globe2,
      },
      { label: "Cache", href: "/admin/settings/cache", icon: Workflow },
      {
        label: "Tareas programadas",
        href: "/admin/settings/crons",
        icon: Cable,
      },
      {
        label: "Sistema",
        href: "/admin/settings/system-information",
        icon: Activity,
      },
      { label: "Auditoría", href: "/admin/audit", icon: Activity },
    ],
  },
]

export function isAdminNavigationItemActive(
  item: AdminNavigationLink,
  pathname: string
) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function getAdminNavigationItem(pathname: string) {
  return adminNavigationGroups
    .flatMap((group) => group.items)
    .find((item) => isAdminNavigationItemActive(item, pathname))
}
