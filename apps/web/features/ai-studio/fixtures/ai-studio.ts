import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  Coins,
  FileClock,
  FileSearch,
  ImageIcon,
  ListChecks,
  MessageSquareText,
  Repeat2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles,
  Workflow,
} from "lucide-react"

export type AiStudioView =
  | "overview"
  | "content"
  | "image"
  | "video"
  | "repurpose"
  | "planner"
  | "review"
  | "timing"
  | "search"
  | "history"
  | "automation"
  | "settings"
  | "credits"

export interface StudioDestination {
  description: string
  href: string
  icon: LucideIcon
  label: string
  view: AiStudioView
}

export const studioDestinations: StudioDestination[] = [
  {
    description: "Actividad, herramientas y trabajos recientes.",
    href: "/portal/ai-studio",
    icon: Sparkles,
    label: "Inicio",
    view: "overview",
  },
  {
    description: "Publicaciones, anuncios y textos por canal.",
    href: "/portal/ai-studio/ai-content",
    icon: MessageSquareText,
    label: "Contenido",
    view: "content",
  },
  {
    description: "Creatividades desde una instrucción o referencia.",
    href: "/portal/ai-studio/image",
    icon: ImageIcon,
    label: "Imágenes",
    view: "image",
  },
  {
    description: "Guiones, escenas y clips listos para publicar.",
    href: "/portal/ai-studio/video",
    icon: Video,
    label: "Video",
    view: "video",
  },
  {
    description: "Convierte una pieza en formatos para cada red.",
    href: "/portal/ai-studio/repurpose",
    icon: Repeat2,
    label: "Reutilizar",
    view: "repurpose",
  },
  {
    description: "Genera planes editoriales y campañas completas.",
    href: "/portal/ai-studio/planner",
    icon: CalendarDays,
    label: "Planificador",
    view: "planner",
  },
  {
    description: "Evalúa calidad, claridad, marca y riesgo.",
    href: "/portal/ai-studio/review",
    icon: ShieldCheck,
    label: "Revisión",
    view: "review",
  },
  {
    description: "Encuentra las mejores horas para cada cuenta.",
    href: "/portal/ai-studio/timing",
    icon: Clock3,
    label: "Mejor hora",
    view: "timing",
  },
  {
    description: "Busca ideas, tendencias y conversaciones.",
    href: "/portal/ai-studio/search",
    icon: FileSearch,
    label: "Investigación",
    view: "search",
  },
  {
    description: "Consulta y reutiliza generaciones anteriores.",
    href: "/portal/ai-studio/history",
    icon: FileClock,
    label: "Historial",
    view: "history",
  },
  {
    description: "Reglas que producen borradores automáticamente.",
    href: "/portal/ai-studio/automation",
    icon: Workflow,
    label: "Automatizaciones",
    view: "automation",
  },
  {
    description: "Voz de marca, idioma y preferencias de salida.",
    href: "/portal/settings/ai-studio",
    icon: Settings2,
    label: "Configuración",
    view: "settings",
  },
  {
    description: "Consumo, presupuesto y movimientos de créditos.",
    href: "/portal/ai-studio/credits",
    icon: Coins,
    label: "Créditos",
    view: "credits",
  },
]

export const recentJobs = [
  {
    cost: "4 créditos",
    id: "AI-2048",
    kind: "Imagen",
    name: "Campaña hamburguesa agosto",
    status: "Completado",
    time: "Hace 12 min",
  },
  {
    cost: "2 créditos",
    id: "AI-2047",
    kind: "Contenido",
    name: "Lanzamiento menú ejecutivo",
    status: "Borrador",
    time: "Hace 34 min",
  },
  {
    cost: "12 créditos",
    id: "AI-2046",
    kind: "Video",
    name: "Reel producto destacado",
    status: "Procesando",
    time: "Hace 1 h",
  },
  {
    cost: "1 crédito",
    id: "AI-2045",
    kind: "Revisión",
    name: "Texto de promoción semanal",
    status: "Requiere cambios",
    time: "Ayer",
  },
]

export const historyRows = [
  ...recentJobs,
  {
    cost: "3 créditos",
    id: "AI-2044",
    kind: "Plan",
    name: "Calendario editorial septiembre",
    status: "Completado",
    time: "Ayer",
  },
  {
    cost: "2 créditos",
    id: "AI-2043",
    kind: "Reutilizar",
    name: "Artículo a carrusel",
    status: "Completado",
    time: "2 ago",
  },
]

export const plannerRows = [
  {
    channel: "Instagram",
    date: "Lun 10 ago · 09:30",
    format: "Carrusel",
    idea: "5 ingredientes que nos hacen diferentes",
    status: "Listo",
  },
  {
    channel: "TikTok",
    date: "Mar 11 ago · 18:45",
    format: "Video corto",
    idea: "Así preparamos el producto estrella",
    status: "Por generar",
  },
  {
    channel: "Facebook",
    date: "Mié 12 ago · 12:15",
    format: "Imagen",
    idea: "Promoción de mitad de semana",
    status: "En revisión",
  },
  {
    channel: "LinkedIn",
    date: "Vie 14 ago · 08:20",
    format: "Publicación",
    idea: "Historia del equipo y cultura",
    status: "Listo",
  },
]

export const automations = [
  {
    cadence: "Cada lunes · 08:00",
    drafts: "4 borradores",
    name: "Resumen semanal de tendencias",
    next: "Mañana",
    status: true,
  },
  {
    cadence: "Diario · 16:30",
    drafts: "1 borrador",
    name: "Producto destacado",
    next: "Hoy, 16:30",
    status: true,
  },
  {
    cadence: "Cada 15 días",
    drafts: "6 borradores",
    name: "Plan educativo quincenal",
    next: "22 ago",
    status: false,
  },
]

export const timingRows = [
  {
    account: "Instagram · Zapi Burger",
    best: "Martes · 18:30",
    confidence: "Alta",
    improvement: "+24% alcance",
  },
  {
    account: "Facebook · Zapi Burger",
    best: "Miércoles · 12:15",
    confidence: "Alta",
    improvement: "+18% alcance",
  },
  {
    account: "TikTok · Zapi Burger",
    best: "Viernes · 20:00",
    confidence: "Media",
    improvement: "+11% vistas",
  },
]

export const searchResults = [
  {
    channel: "Instagram",
    engagement: "8.4% interacción",
    summary:
      "Formatos de comparación antes/después mantienen crecimiento durante la semana.",
    title: "Antes y después del producto",
  },
  {
    channel: "TikTok",
    engagement: "42 mil vistas",
    summary:
      "Los videos cortos de preparación con audio ambiente superan a las piezas narradas.",
    title: "Proceso detrás de cámara",
  },
  {
    channel: "Google Trends",
    engagement: "+31% en 7 días",
    summary:
      "Las búsquedas locales de promociones para almuerzo muestran intención creciente.",
    title: "Menú ejecutivo cerca de mí",
  },
]

export const overviewMetrics = [
  {
    detail: "Se renuevan el 1 de septiembre",
    icon: Coins,
    label: "Créditos disponibles",
    value: "84",
  },
  {
    detail: "1 video y 1 investigación",
    icon: WandSparkles,
    label: "En proceso",
    value: "2",
  },
  {
    detail: "Listos para revisar",
    icon: ListChecks,
    label: "Borradores",
    value: "6",
  },
  {
    detail: "Últimos 30 días",
    icon: ChartNoAxesCombined,
    label: "Piezas creadas",
    value: "47",
  },
]
