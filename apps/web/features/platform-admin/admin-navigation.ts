import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bot,
  Braces,
  BrainCircuit,
  Cable,
  CreditCard,
  FileQuestion,
  FileText,
  Gauge,
  Globe2,
  HandCoins,
  KeyRound,
  Languages,
  LayoutDashboard,
  Mail,
  Menu,
  PackageCheck,
  Palette,
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
    items: [{ label: "Resumen", href: "/admin", icon: LayoutDashboard }],
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
        label: "Suscripciones",
        href: "/admin/subscriptions",
        icon: ReceiptText,
      },
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
      { label: "Menú público", href: "/admin/menu-builder", icon: Menu },
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
      { label: "Correo SMTP", href: "/admin/integrations", icon: Mail },
      {
        label: "Reglas de autenticación",
        href: "/admin/settings/auth",
        icon: KeyRound,
      },
      { label: "Captcha", href: "/admin/settings/captcha", icon: ShieldCheck },
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
      { label: "Temas", href: "/admin/themes", icon: Palette },
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
    ],
  },
]

export function isAdminNavigationItemActive(
  item: AdminNavigationLink,
  pathname: string
) {
  return (
    pathname === item.href ||
    (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
  )
}

export function getAdminNavigationItem(pathname: string) {
  return adminNavigationGroups
    .flatMap((group) => group.items)
    .find((item) => isAdminNavigationItemActive(item, pathname))
}
