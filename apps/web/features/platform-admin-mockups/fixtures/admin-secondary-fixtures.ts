import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bot,
  CalendarClock,
  FileQuestion,
  FileText,
  FolderPlus,
  Gauge,
  Globe2,
  KeyRound,
  Languages,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Tags,
} from "lucide-react"

export type AdminSecondaryModuleKey =
  | "blogs"
  | "blog-categories"
  | "blog-tags"
  | "faqs"
  | "languages"
  | "ai-templates"
  | "ai-template-categories"
  | "ai-usage-logs"
  | "ai-report"
  | "settings-general"
  | "settings-auth"
  | "settings-analytics"
  | "settings-static-pages"
  | "settings-cache"
  | "settings-crons"
  | "settings-system-information"

export type AdminMockTone =
  "success" | "warning" | "info" | "neutral" | "destructive"

export type AdminMockRow = {
  id: string
  search: string
  status: string
  tone: AdminMockTone
  values: readonly { primary: string; secondary?: string; mono?: boolean }[]
}

export type AdminMockField = {
  description?: string
  kind: "text" | "textarea" | "select" | "switch" | "display"
  label: string
  name: string
  options?: readonly { label: string; value: string }[]
  placeholder?: string
  required?: boolean
  value: string | boolean
}

export type AdminMockAction = {
  description: string
  fields: readonly AdminMockField[]
  icon: LucideIcon
  label: string
  mode: "create" | "execute"
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

export type AdminSettingsSection = {
  description: string
  fields: readonly AdminMockField[]
  key: string
  label: string
  saveLabel?: string
  title: string
}

export type AdminSettingsDefinition = {
  description: string
  icon: LucideIcon
  kind: "settings"
  metrics?: readonly AdminMockMetric[]
  sections: readonly AdminSettingsSection[]
  title: string
}

export type AdminSecondaryDefinition =
  AdminCollectionDefinition | AdminSettingsDefinition

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

const select = (
  name: string,
  label: string,
  value: string,
  options: readonly string[]
): AdminMockField => ({
  kind: "select",
  label,
  name,
  options: options.map((option) => ({ label: option, value: option })),
  required: true,
  value,
})

const toggle = (
  name: string,
  label: string,
  value: boolean,
  description: string
): AdminMockField => ({
  description,
  kind: "switch",
  label,
  name,
  value,
})

const display = (
  name: string,
  label: string,
  value: string,
  description?: string
): AdminMockField => ({
  description,
  kind: "display",
  label,
  name,
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

export const adminSecondaryDefinitions: Record<
  AdminSecondaryModuleKey,
  AdminSecondaryDefinition
> = {
  blogs: {
    action: createAction(
      "Nuevo artículo",
      "Crear artículo",
      "Prepara el contenido, su clasificación y estado de publicación.",
      [
        text("title", "Título", ""),
        select("category", "Categoría", "Producto", [
          "Producto",
          "Guías",
          "Noticias",
        ]),
        select("status", "Estado", "Borrador", ["Borrador", "Publicado"]),
      ],
      FileText
    ),
    columns: ["Artículo", "Categoría", "Autor", "Actualizado"],
    description: "Contenido editorial, borradores y publicaciones del sitio.",
    filterOptions: allStatuses(["Publicado", "Borrador", "Programado"]),
    icon: FileText,
    kind: "collection",
    metrics: [
      {
        label: "Artículos",
        value: "48",
        description: "Total editorial",
        icon: FileText,
      },
      {
        label: "Publicados",
        value: "36",
        description: "Visibles en el sitio",
        icon: Globe2,
      },
      {
        label: "Borradores",
        value: "9",
        description: "Pendientes de revisión",
        icon: FileQuestion,
      },
      {
        label: "Programados",
        value: "3",
        description: "Próximas publicaciones",
        icon: CalendarClock,
      },
    ],
    rows: [
      row(
        "blog-1",
        [
          {
            primary: "Cómo planificar un mes de contenido",
            secondary: "como-planificar-contenido",
          },
          { primary: "Guías" },
          { primary: "Equipo Zapi" },
          { primary: "Hoy, 09:18" },
        ],
        "Publicado",
        "success"
      ),
      row(
        "blog-2",
        [
          {
            primary: "Novedades de AI Studio",
            secondary: "novedades-ai-studio",
          },
          { primary: "Producto" },
          { primary: "Josue Admin" },
          { primary: "8 ago 2026" },
        ],
        "Borrador",
        "neutral"
      ),
      row(
        "blog-3",
        [
          {
            primary: "Automatizaciones seguras",
            secondary: "automatizaciones-seguras",
          },
          { primary: "Noticias" },
          { primary: "Equipo Zapi" },
          { primary: "7 ago 2026" },
        ],
        "Programado",
        "info"
      ),
    ],
    title: "Blogs",
  },
  "blog-categories": {
    action: createAction(
      "Nueva categoría",
      "Crear categoría",
      "Organiza los artículos y define su orden público.",
      [text("name", "Nombre", ""), text("slug", "Slug", "", false)],
      FolderPlus
    ),
    columns: ["Categoría", "Artículos", "Orden", "Actualizada"],
    description: "Clasificación principal del contenido editorial.",
    filterOptions: allStatuses(["Activa", "Inactiva"]),
    icon: Tags,
    kind: "collection",
    rows: [
      row(
        "category-1",
        [
          { primary: "Guías", secondary: "guias" },
          { primary: "18" },
          { primary: "1" },
          { primary: "8 ago 2026" },
        ],
        "Activa",
        "success"
      ),
      row(
        "category-2",
        [
          { primary: "Producto", secondary: "producto" },
          { primary: "14" },
          { primary: "2" },
          { primary: "7 ago 2026" },
        ],
        "Activa",
        "success"
      ),
      row(
        "category-3",
        [
          { primary: "Casos de éxito", secondary: "casos-exito" },
          { primary: "4" },
          { primary: "4" },
          { primary: "2 ago 2026" },
        ],
        "Inactiva",
        "neutral"
      ),
    ],
    title: "Categorías de blog",
  },
  "blog-tags": {
    action: createAction(
      "Nueva etiqueta",
      "Crear etiqueta",
      "Añade una etiqueta reutilizable para los artículos.",
      [text("name", "Nombre", ""), text("slug", "Slug", "", false)],
      Tags
    ),
    columns: ["Etiqueta", "Artículos", "Orden", "Actualizada"],
    description: "Etiquetas transversales para búsqueda y navegación.",
    filterOptions: allStatuses(["Activa", "Inactiva"]),
    icon: Tags,
    kind: "collection",
    rows: [
      row(
        "tag-1",
        [
          { primary: "Automatización", secondary: "automatizacion" },
          { primary: "21" },
          { primary: "1" },
          { primary: "Hoy" },
        ],
        "Activa",
        "success"
      ),
      row(
        "tag-2",
        [
          { primary: "Instagram", secondary: "instagram" },
          { primary: "16" },
          { primary: "2" },
          { primary: "8 ago 2026" },
        ],
        "Activa",
        "success"
      ),
      row(
        "tag-3",
        [
          { primary: "Legacy", secondary: "legacy" },
          { primary: "2" },
          { primary: "8" },
          { primary: "1 ago 2026" },
        ],
        "Inactiva",
        "neutral"
      ),
    ],
    title: "Etiquetas de blog",
  },
  faqs: {
    action: createAction(
      "Nueva pregunta",
      "Crear pregunta frecuente",
      "Redacta una respuesta breve y define su visibilidad.",
      [
        text("question", "Pregunta", ""),
        {
          kind: "textarea",
          label: "Respuesta",
          name: "answer",
          required: true,
          value: "",
        },
      ],
      FileQuestion
    ),
    columns: ["Pregunta", "Sección", "Orden", "Actualizada"],
    description: "Respuestas públicas para dudas frecuentes del producto.",
    filterOptions: allStatuses(["Visible", "Oculta"]),
    icon: FileQuestion,
    kind: "collection",
    rows: [
      row(
        "faq-1",
        [
          { primary: "¿Cómo conecto Instagram?" },
          { primary: "Canales" },
          { primary: "1" },
          { primary: "Hoy" },
        ],
        "Visible",
        "success"
      ),
      row(
        "faq-2",
        [
          { primary: "¿Cómo funcionan los créditos AI?" },
          { primary: "AI Studio" },
          { primary: "2" },
          { primary: "8 ago 2026" },
        ],
        "Visible",
        "success"
      ),
      row(
        "faq-3",
        [
          { primary: "¿Puedo cancelar mi plan?" },
          { primary: "Facturación" },
          { primary: "3" },
          { primary: "6 ago 2026" },
        ],
        "Oculta",
        "neutral"
      ),
    ],
    title: "Preguntas frecuentes",
  },
  languages: {
    action: createAction(
      "Nuevo idioma",
      "Añadir idioma",
      "Crea el locale y su archivo inicial de traducciones.",
      [text("name", "Nombre", ""), text("locale", "Código locale", "")],
      Languages
    ),
    columns: ["Idioma", "Traducciones", "Cobertura", "Actualizado"],
    description: "Idiomas disponibles y cobertura de traducciones.",
    filterOptions: allStatuses(["Activo", "Incompleto", "Inactivo"]),
    icon: Languages,
    kind: "collection",
    rows: [
      row(
        "language-1",
        [
          { primary: "Español", secondary: "es" },
          { primary: "1.842 líneas" },
          { primary: "100%" },
          { primary: "Hoy" },
        ],
        "Activo",
        "success"
      ),
      row(
        "language-2",
        [
          { primary: "English", secondary: "en" },
          { primary: "1.814 líneas" },
          { primary: "98%" },
          { primary: "8 ago 2026" },
        ],
        "Activo",
        "success"
      ),
      row(
        "language-3",
        [
          { primary: "Português", secondary: "pt-BR" },
          { primary: "1.226 líneas" },
          { primary: "67%" },
          { primary: "2 ago 2026" },
        ],
        "Incompleto",
        "warning"
      ),
    ],
    title: "Idiomas",
  },
  "ai-templates": {
    action: createAction(
      "Nueva plantilla",
      "Crear plantilla AI",
      "Define instrucciones reutilizables y su categoría.",
      [
        text("name", "Nombre", ""),
        select("category", "Categoría", "Marketing", [
          "Marketing",
          "Ventas",
          "Soporte",
        ]),
        {
          kind: "textarea",
          label: "Prompt",
          name: "prompt",
          required: true,
          value: "",
        },
      ],
      Bot
    ),
    columns: ["Plantilla", "Categoría", "Usos", "Actualizada"],
    description: "Prompts administrados y reutilizables por el Portal.",
    filterOptions: allStatuses(["Activa", "Borrador", "Archivada"]),
    icon: Bot,
    kind: "collection",
    metrics: [
      {
        label: "Plantillas",
        value: "28",
        description: "Catálogo total",
        icon: Bot,
      },
      {
        label: "Activas",
        value: "22",
        description: "Disponibles en Portal",
        icon: ShieldCheck,
      },
      {
        label: "Usos",
        value: "3.904",
        description: "Últimos 30 días",
        icon: Activity,
      },
      {
        label: "Borradores",
        value: "4",
        description: "Pendientes",
        icon: FileText,
      },
    ],
    rows: [
      row(
        "template-1",
        [
          { primary: "Caption de lanzamiento", secondary: "caption-launch" },
          { primary: "Marketing" },
          { primary: "1.284" },
          { primary: "Hoy" },
        ],
        "Activa",
        "success"
      ),
      row(
        "template-2",
        [
          { primary: "Respuesta comercial", secondary: "sales-reply" },
          { primary: "Ventas" },
          { primary: "842" },
          { primary: "8 ago 2026" },
        ],
        "Activa",
        "success"
      ),
      row(
        "template-3",
        [
          { primary: "Resumen de ticket", secondary: "ticket-summary" },
          { primary: "Soporte" },
          { primary: "—" },
          { primary: "6 ago 2026" },
        ],
        "Borrador",
        "neutral"
      ),
    ],
    title: "Plantillas AI",
  },
  "ai-template-categories": {
    action: createAction(
      "Nueva categoría",
      "Crear categoría AI",
      "Agrupa plantillas relacionadas y define su orden.",
      [text("name", "Nombre", ""), text("description", "Descripción", "")],
      FolderPlus
    ),
    columns: ["Categoría", "Plantillas", "Orden", "Actualizada"],
    description: "Clasificación del catálogo de plantillas AI.",
    filterOptions: allStatuses(["Activa", "Inactiva"]),
    icon: Tags,
    kind: "collection",
    rows: [
      row(
        "ai-category-1",
        [
          { primary: "Marketing" },
          { primary: "12" },
          { primary: "1" },
          { primary: "Hoy" },
        ],
        "Activa",
        "success"
      ),
      row(
        "ai-category-2",
        [
          { primary: "Ventas" },
          { primary: "8" },
          { primary: "2" },
          { primary: "8 ago 2026" },
        ],
        "Activa",
        "success"
      ),
      row(
        "ai-category-3",
        [
          { primary: "Soporte" },
          { primary: "8" },
          { primary: "3" },
          { primary: "7 ago 2026" },
        ],
        "Activa",
        "success"
      ),
    ],
    title: "Categorías AI",
  },
  "ai-usage-logs": {
    columns: ["Usuario", "Capacidad", "Modelo", "Consumo", "Fecha"],
    description: "Solicitudes AI redactadas con coste y latencia operativa.",
    filterOptions: allStatuses(["Correcto", "Con error", "Reembolsado"]),
    icon: BarChart3,
    kind: "collection",
    metrics: [
      {
        label: "Solicitudes",
        value: "12.842",
        description: "Últimos 30 días",
        icon: Activity,
      },
      {
        label: "Tokens",
        value: "8,4 M",
        description: "Entrada y salida",
        icon: Gauge,
      },
      {
        label: "Coste estimado",
        value: "$184,20",
        description: "Todos los providers",
        icon: BarChart3,
      },
      {
        label: "Errores",
        value: "0,7%",
        description: "Tasa operativa",
        icon: FileQuestion,
      },
    ],
    rows: [
      row(
        "usage-1",
        [
          { primary: "María Andrade", secondary: "Aurora Studio" },
          { primary: "Contenido AI" },
          { primary: "OpenAI · Terra" },
          { primary: "1.842 tokens", secondary: "$0,032" },
          { primary: "Hoy, 10:24" },
        ],
        "Correcto",
        "success"
      ),
      row(
        "usage-2",
        [
          { primary: "Daniel Vera", secondary: "North Lab" },
          { primary: "Imagen" },
          { primary: "AtlasCloud" },
          { primary: "1 imagen", secondary: "$0,041" },
          { primary: "Hoy, 10:12" },
        ],
        "Correcto",
        "success"
      ),
      row(
        "usage-3",
        [
          { primary: "Sofía Torres", secondary: "Demo Workspace" },
          { primary: "Video" },
          { primary: "AtlasCloud" },
          { primary: "0 unidades", secondary: "$0,000" },
          { primary: "Hoy, 09:58" },
        ],
        "Con error",
        "destructive"
      ),
    ],
    title: "Uso AI",
  },
  "ai-report": {
    columns: ["Dimensión", "Solicitudes", "Consumo", "Coste", "Variación"],
    description: "Reporte agregado de adopción, coste y rendimiento AI.",
    filterOptions: allStatuses(["Saludable", "Atención"]),
    icon: Gauge,
    kind: "collection",
    metrics: [
      {
        label: "Solicitudes",
        value: "12.842",
        description: "+18% frente al período anterior",
        icon: BarChart3,
      },
      {
        label: "Usuarios activos",
        value: "684",
        description: "25% de la base",
        icon: Activity,
      },
      {
        label: "Coste por solicitud",
        value: "$0,014",
        description: "Promedio estimado",
        icon: Gauge,
      },
      {
        label: "Latencia media",
        value: "2,4 s",
        description: "Todas las capacidades",
        icon: CalendarClock,
      },
    ],
    rows: [
      row(
        "report-1",
        [
          { primary: "Contenido AI" },
          { primary: "8.420" },
          { primary: "6,8 M tokens" },
          { primary: "$108,40" },
          { primary: "+22%" },
        ],
        "Saludable",
        "success"
      ),
      row(
        "report-2",
        [
          { primary: "Imágenes" },
          { primary: "3.210" },
          { primary: "3.210 unidades" },
          { primary: "$52,10" },
          { primary: "+14%" },
        ],
        "Saludable",
        "success"
      ),
      row(
        "report-3",
        [
          { primary: "Video" },
          { primary: "1.212" },
          { primary: "426 min" },
          { primary: "$23,70" },
          { primary: "+38%" },
        ],
        "Atención",
        "warning"
      ),
    ],
    title: "Reporte AI",
  },
  "settings-general": {
    description:
      "Identidad, localización y comportamiento general de la plataforma.",
    icon: Settings2,
    kind: "settings",
    sections: [
      {
        description: "Nombre público, dominio y datos de contacto.",
        fields: [
          text("siteName", "Nombre de la plataforma", "Zapi Social"),
          text("supportEmail", "Correo de soporte", "soporte@zapi.social"),
          text("siteUrl", "URL pública", "https://zapi.social"),
        ],
        key: "identity",
        label: "Identidad",
        title: "Identidad de plataforma",
      },
      {
        description: "Idioma, zona horaria y formato usados por defecto.",
        fields: [
          select("language", "Idioma predeterminado", "Español", [
            "Español",
            "English",
          ]),
          select(
            "timezone",
            "Zona horaria predeterminada",
            "America/Guayaquil",
            ["America/Guayaquil", "America/Bogota", "UTC"]
          ),
          select("dateFormat", "Formato de fecha", "DD/MM/YYYY", [
            "DD/MM/YYYY",
            "MM/DD/YYYY",
            "YYYY-MM-DD",
          ]),
        ],
        key: "regional",
        label: "Región",
        title: "Configuración regional",
      },
    ],
    title: "Configuración general",
  },
  "settings-auth": {
    description: "Políticas de registro, sesiones y recuperación de acceso.",
    icon: KeyRound,
    kind: "settings",
    sections: [
      {
        description:
          "Controla cómo pueden registrarse y verificar su cuenta los usuarios.",
        fields: [
          toggle(
            "registration",
            "Permitir registros",
            true,
            "Habilita el formulario público de registro."
          ),
          toggle(
            "emailVerification",
            "Exigir verificación de correo",
            true,
            "Bloquea el Portal hasta verificar la dirección."
          ),
          toggle(
            "passwordRecovery",
            "Permitir recuperación de contraseña",
            true,
            "Usa la integración SMTP activa."
          ),
        ],
        key: "access",
        label: "Acceso",
        title: "Registro y acceso",
      },
      {
        description: "Define requisitos mínimos y duración de las sesiones.",
        fields: [
          text("minimumLength", "Longitud mínima", "8"),
          toggle(
            "uppercase",
            "Exigir mayúscula",
            true,
            "Añade una mayúscula a la política."
          ),
          toggle(
            "special",
            "Exigir carácter especial",
            true,
            "Añade un símbolo a la política."
          ),
          text("sessionMinutes", "Duración de sesión en minutos", "120"),
        ],
        key: "security",
        label: "Seguridad",
        title: "Contraseñas y sesiones",
      },
    ],
    title: "Reglas de autenticación",
  },
  "settings-analytics": {
    description: "Medición pública y scripts permitidos en el sitio.",
    icon: BarChart3,
    kind: "settings",
    sections: [
      {
        description:
          "Configura identificadores sin exponer credenciales privadas.",
        fields: [
          toggle(
            "enabled",
            "Analítica habilitada",
            true,
            "Carga únicamente los proveedores configurados."
          ),
          text("google", "Google Analytics ID", "G-ABCD1234"),
          text("meta", "Meta Pixel ID", "1234567890", false),
          {
            kind: "textarea",
            label: "Código adicional de cabecera",
            name: "headCode",
            required: false,
            value: "",
          },
        ],
        key: "tracking",
        label: "Seguimiento",
        title: "Analítica y seguimiento",
      },
    ],
    title: "Analítica",
  },
  "settings-static-pages": {
    action: createAction(
      "Nueva página",
      "Crear página estática",
      "Define una página pública administrada.",
      [text("title", "Título", ""), text("slug", "Slug", "")],
      Globe2
    ),
    columns: ["Página", "Ruta", "Actualizada", "Responsable"],
    description: "Contenido legal e institucional del sitio público.",
    filterOptions: allStatuses(["Publicada", "Borrador"]),
    icon: Globe2,
    kind: "collection",
    rows: [
      row(
        "page-1",
        [
          { primary: "Política de privacidad" },
          { primary: "/privacy-policy", mono: true },
          { primary: "8 ago 2026" },
          { primary: "Josue Admin" },
        ],
        "Publicada",
        "success"
      ),
      row(
        "page-2",
        [
          { primary: "Términos de uso" },
          { primary: "/terms-of-use", mono: true },
          { primary: "8 ago 2026" },
          { primary: "Josue Admin" },
        ],
        "Publicada",
        "success"
      ),
      row(
        "page-3",
        [
          { primary: "Uso aceptable" },
          { primary: "/acceptable-use", mono: true },
          { primary: "2 ago 2026" },
          { primary: "Equipo Zapi" },
        ],
        "Borrador",
        "neutral"
      ),
    ],
    title: "Páginas estáticas",
  },
  "settings-cache": {
    action: createAction(
      "Limpiar cache",
      "Limpiar cache",
      "Selecciona qué grupo de cache debe regenerarse.",
      [
        select("scope", "Alcance", "Aplicación", [
          "Aplicación",
          "Configuración",
          "Rutas",
          "Vistas",
        ]),
      ],
      RotateCcw,
      "execute"
    ),
    columns: ["Grupo", "Entradas", "Tamaño", "Actualizado"],
    description: "Caches operativas que pueden regenerarse de forma segura.",
    filterOptions: allStatuses(["Disponible", "Regenerando"]),
    icon: RotateCcw,
    kind: "collection",
    rows: [
      row(
        "cache-1",
        [
          { primary: "Aplicación" },
          { primary: "842" },
          { primary: "18,4 MB" },
          { primary: "Hace 2 minutos" },
        ],
        "Disponible",
        "success"
      ),
      row(
        "cache-2",
        [
          { primary: "Configuración" },
          { primary: "126" },
          { primary: "1,8 MB" },
          { primary: "Hace 2 minutos" },
        ],
        "Disponible",
        "success"
      ),
      row(
        "cache-3",
        [
          { primary: "Vistas" },
          { primary: "94" },
          { primary: "6,2 MB" },
          { primary: "Hace 18 minutos" },
        ],
        "Disponible",
        "success"
      ),
    ],
    title: "Cache",
  },
  "settings-crons": {
    action: createAction(
      "Ejecutar tarea",
      "Ejecutar tarea programada",
      "Selecciona una tarea para registrarla como ejecución manual.",
      [
        select("task", "Tarea", "Publishing dispatcher", [
          "Publishing dispatcher",
          "RSS schedules",
          "AI automations",
        ]),
      ],
      CalendarClock,
      "execute"
    ),
    columns: ["Tarea", "Frecuencia", "Última ejecución", "Resultado"],
    description: "Tareas periódicas y estado de sus últimas ejecuciones.",
    filterOptions: allStatuses(["Correcta", "En ejecución", "Con error"]),
    icon: CalendarClock,
    kind: "collection",
    rows: [
      row(
        "cron-1",
        [
          { primary: "Publishing dispatcher" },
          { primary: "Cada minuto" },
          { primary: "Hace 18 segundos" },
          { primary: "12 publicaciones evaluadas" },
        ],
        "Correcta",
        "success"
      ),
      row(
        "cron-2",
        [
          { primary: "RSS schedules" },
          { primary: "Cada minuto" },
          { primary: "Hace 42 segundos" },
          { primary: "3 feeds evaluados" },
        ],
        "Correcta",
        "success"
      ),
      row(
        "cron-3",
        [
          { primary: "AI automations" },
          { primary: "Cada minuto" },
          { primary: "En curso" },
          { primary: "2 jobs en cola" },
        ],
        "En ejecución",
        "info"
      ),
    ],
    title: "Tareas programadas",
  },
  "settings-system-information": {
    description: "Estado redactado del runtime y servicios necesarios.",
    icon: Activity,
    kind: "settings",
    metrics: [
      {
        label: "Aplicación",
        value: "Operativa",
        description: "Web y API responden",
        icon: Globe2,
      },
      {
        label: "Base de datos",
        value: "Conectada",
        description: "PostgreSQL disponible",
        icon: ShieldCheck,
      },
      {
        label: "Colas",
        value: "Saludables",
        description: "Workers activos",
        icon: Activity,
      },
      {
        label: "Cache",
        value: "Conectada",
        description: "Redis disponible",
        icon: RotateCcw,
      },
    ],
    sections: [
      {
        description: "Información segura para soporte, sin rutas ni secretos.",
        fields: [
          display("version", "Versión de aplicación", "2.0.0"),
          display("runtime", "Runtime", "Node.js 24"),
          display("database", "Base de datos", "PostgreSQL · conectada"),
          display("redis", "Cache y colas", "Redis · conectado"),
          display(
            "workers",
            "Workers",
            "3 activos",
            "Publishing, media y automatizaciones."
          ),
        ],
        key: "runtime",
        label: "Runtime",
        saveLabel: "Copiar diagnóstico",
        title: "Información del sistema",
      },
    ],
    title: "Sistema",
  },
}
