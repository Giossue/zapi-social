import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  CreditCard,
  FileQuestion,
  FileText,
  Globe2,
  HandCoins,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  PlugZap,
  Settings2,
  Users,
  Workflow,
} from "lucide-react"

export type AdminNavigationLink = {
  label: string
  href: string
  icon?: LucideIcon
}

export type AdminNavigationDisclosure = {
  label: string
  icon?: LucideIcon
  children: readonly AdminNavigationLink[]
}

export type AdminNavigationItem =
  AdminNavigationLink | AdminNavigationDisclosure

export type AdminNavigationGroup = {
  label: string
  items: readonly AdminNavigationItem[]
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
      {
        label: "Facturación",
        icon: CreditCard,
        children: [
          { label: "Planes", href: "/admin/plans" },
          { label: "Suscripciones", href: "/admin/subscriptions" },
          { label: "Pagos", href: "/admin/payments" },
          { label: "Pagos manuales", href: "/admin/manual-payments" },
          { label: "Reporte de pagos", href: "/admin/payment-report" },
          { label: "Cupones", href: "/admin/coupons" },
          { label: "Créditos", href: "/admin/credits" },
        ],
      },
      { label: "Afiliados", href: "/admin/affiliate", icon: HandCoins },
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
      {
        label: "Blog",
        icon: FileText,
        children: [
          { label: "Entradas", href: "/admin/blogs" },
          { label: "Categorías", href: "/admin/blog-categories" },
          { label: "Etiquetas", href: "/admin/blog-tags" },
        ],
      },
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
      {
        label: "Plantillas AI",
        icon: Bot,
        children: [
          { label: "Plantillas", href: "/admin/ai-templates" },
          { label: "Categorías", href: "/admin/ai-template-categories" },
        ],
      },
      {
        label: "Observabilidad AI",
        icon: BarChart3,
        children: [
          { label: "Uso", href: "/admin/ai-usage-logs" },
          { label: "Reporte", href: "/admin/ai-report" },
        ],
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Ajustes",
        icon: Settings2,
        children: [
          { label: "General", href: "/admin/settings/general" },
          { label: "Autenticación", href: "/admin/settings/auth" },
          { label: "Captcha", href: "/admin/settings/captcha" },
          { label: "Analítica", href: "/admin/settings/analytics" },
        ],
      },
      {
        label: "Plantillas de correo",
        href: "/admin/email-templates",
        icon: Mail,
      },
      {
        label: "Páginas estáticas",
        href: "/admin/settings/static-pages",
        icon: Globe2,
      },
      {
        label: "Operación",
        icon: Workflow,
        children: [
          { label: "Cache", href: "/admin/settings/cache" },
          { label: "Tareas programadas", href: "/admin/settings/crons" },
          { label: "Sistema", href: "/admin/settings/system-information" },
        ],
      },
      { label: "Auditoría", href: "/admin/audit", icon: Activity },
    ],
  },
]

function getDeepestAdminNavigationItem(pathname: string) {
  return adminNavigationGroups
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "children" in item ? [item, ...item.children] : [item]
      )
    )
    .filter((item): item is AdminNavigationLink => "href" in item)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((first, second) => second.href.length - first.href.length)[0]
}

export function isAdminNavigationItemActive(
  item: AdminNavigationItem,
  pathname: string
) {
  return (
    "href" in item &&
    getDeepestAdminNavigationItem(pathname)?.href === item.href
  )
}

export function getAdminNavigationItem(pathname: string) {
  return getDeepestAdminNavigationItem(pathname)
}
