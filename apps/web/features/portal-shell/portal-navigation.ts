import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  Droplets,
  FileText,
  FolderOpen,
  HandCoins,
  Image,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  PenLine,
  Rss,
  Share2,
  ShoppingBag,
  Sparkles,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react"

export type PortalNavigationLink = {
  label: string
  href: string
  icon?: LucideIcon
}

export type PortalNavigationDisclosure = {
  label: string
  icon?: LucideIcon
  children: readonly PortalNavigationLink[]
}

export type PortalNavigationItem =
  PortalNavigationLink | PortalNavigationDisclosure

export type PortalNavigationGroup = {
  label: string
  items: readonly PortalNavigationItem[]
}

/**
 * Equivalencia del registro de sidebar de Laravel. Visibilidad por plan/equipo
 * todavía es mock: se muestran todas las opciones para diseñar cada módulo.
 */
export const portalNavigationGroups: readonly PortalNavigationGroup[] = [
  {
    label: "General",
    items: [
      { label: "Resumen", href: "/portal/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Espacio de trabajo",
    items: [
      { label: "Canales", href: "/portal/channels", icon: Share2 },
      {
        label: "Publicación",
        icon: CalendarDays,
        children: [
          { label: "Calendario", href: "/portal/publishing/calendar" },
          { label: "Cola", href: "/portal/publishing/queue" },
          { label: "Borradores", href: "/portal/publishing/drafts" },
        ],
      },
      { label: "Programaciones RSS", href: "/portal/rss-schedules", icon: Rss },
      {
        label: "Publicaciones masivas",
        href: "/portal/bulk-posts",
        icon: FileText,
      },
      { label: "AI Publishing", href: "/portal/ai-publishing", icon: Sparkles },
      { label: "API de automatización", href: "/portal/automation", icon: Zap },
    ],
  },
  {
    label: "Herramientas de contenido",
    items: [
      { label: "Equipos", href: "/portal/teams", icon: Users },
      { label: "Captions", href: "/portal/captions", icon: PenLine },
      {
        label: "AI Studio",
        icon: WandSparkles,
        children: [
          { label: "Inicio", href: "/portal/ai-studio" },
          { label: "Contenido AI", href: "/portal/ai-studio/ai-content" },
          { label: "Imágenes", href: "/portal/ai-studio/image" },
          { label: "Video", href: "/portal/ai-studio/video" },
          { label: "Reutilizar", href: "/portal/ai-studio/repurpose" },
          {
            label: "Planificador de calendario",
            href: "/portal/ai-studio/planner",
          },
          { label: "Revisión AI", href: "/portal/ai-studio/review" },
          { label: "Mejor horario", href: "/portal/ai-studio/timing" },
          { label: "Investigación", href: "/portal/ai-studio/search" },
          { label: "Historial", href: "/portal/ai-studio/history" },
          {
            label: "Automatizaciones",
            href: "/portal/ai-studio/automation",
          },
          { label: "Ajustes AI", href: "/portal/ai-studio/settings" },
          { label: "Créditos", href: "/portal/ai-studio/credits" },
        ],
      },
      { label: "Grupos", href: "/portal/groups", icon: Layers3 },
      { label: "Marca de agua", href: "/portal/watermarks", icon: Droplets },
    ],
  },
  {
    label: "Biblioteca",
    items: [
      { label: "Archivos", href: "/portal/files", icon: FolderOpen },
      {
        label: "Buscar medios online",
        href: "/portal/files/search-online",
        icon: Image,
      },
    ],
  },
  {
    label: "Ayuda",
    items: [{ label: "Soporte", href: "/portal/support", icon: LifeBuoy }],
  },
  {
    label: "Commerce",
    items: [{ label: "Commerce", href: "/portal/commerce", icon: ShoppingBag }],
  },
  {
    label: "Aplicaciones",
    items: [{ label: "Afiliados", href: "/portal/affiliate", icon: HandCoins }],
  },
]

function getDeepestPortalNavigationItem(pathname: string) {
  return portalNavigationGroups
    .flatMap((group) =>
      group.items.flatMap((item) =>
        "children" in item ? [item, ...item.children] : [item]
      )
    )
    .filter((item): item is PortalNavigationLink => "href" in item)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((first, second) => second.href.length - first.href.length)[0]
}

export function isPortalNavigationItemActive(
  item: PortalNavigationItem,
  pathname: string
) {
  return (
    "href" in item &&
    getDeepestPortalNavigationItem(pathname)?.href === item.href
  )
}

export function getPortalNavigationItem(pathname: string) {
  return getDeepestPortalNavigationItem(pathname)
}
