import type { PortalDashboard } from "@/features/dashboard/types/dashboard"

/** Datos sintéticos; estructura equivalente a Dashboard.php de Laravel. */
export const portalDashboardFixture: PortalDashboard = {
  welcome: {
    name: "Giossue",
  },
  primaryAction: {
    label: "Crear publicación",
    href: "/portal/publishing/calendar",
  },
  workspace: [
    {
      label: "Canales",
      value: "4",
      description: "3 activos",
      icon: "channels",
    },
    {
      label: "Publicaciones",
      value: "18",
      description: "5 programadas",
      icon: "calendar",
    },
    {
      label: "Créditos AI",
      value: "1,280",
      description: "96 usados este ciclo",
      icon: "ai",
    },
    {
      label: "Ejecuciones AI",
      value: "37",
      description: "34 exitosas",
      icon: "ai",
    },
  ],
  tools: [
    {
      label: "Contenido AI",
      href: "/portal/ai-studio/ai-content",
      uses: 12,
      icon: "content",
    },
    {
      label: "Crear con AI",
      href: "/portal/ai-studio/image",
      uses: 8,
      icon: "image",
    },
    {
      label: "Reutilizar",
      href: "/portal/ai-studio/repurpose",
      uses: 6,
      icon: "repurpose",
    },
    {
      label: "Mejor horario",
      href: "/portal/ai-studio/timing",
      uses: 4,
      icon: "timing",
    },
  ],
  publishing: [
    { label: "Programadas", value: "5", icon: "calendar" },
    { label: "Publicadas", value: "12", icon: "channels" },
    { label: "Total publicaciones", value: "18", icon: "templates" },
  ],
  library: [
    { label: "Archivos", value: "46", icon: "files" },
    { label: "Almacenamiento usado", value: "312.6 MB", icon: "storage" },
    { label: "Plantillas AI", value: "12", icon: "templates" },
  ],
  attention: [
    {
      label: "1 canal inactivo",
      description:
        "Reconecta o pausa canales antes de planificar nuevas publicaciones.",
      href: "/portal/channels",
      icon: "channels",
    },
    {
      label: "1 publicación fallida",
      description:
        "Revisa errores de publicación antes de que afecten tu próxima cola.",
      href: "/portal/publishing/calendar",
      icon: "publishing",
    },
    {
      label: "3 ejecuciones AI necesitan revisión",
      description: "Comprueba trabajo AI fallido antes de volver a intentarlo.",
      href: "/portal/ai-studio/prompt-history",
      icon: "ai",
    },
  ],
}
