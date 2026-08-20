import type { AiRequestKind } from "@workspace/contracts"

/** Herramientas conversacionales: cada una era una ruta propia de AI Studio. */
export type ChatTool = Exclude<AiRequestKind, "ai_publishing">

export type ToolOptionField =
  | { kind: "text"; label: string; name: string; placeholder?: string }
  | { kind: "number"; label: string; max: number; min: number; name: string }
  | { kind: "date"; label: string; name: string }
  | {
      kind: "select"
      label: string
      name: string
      options: readonly { label: string; value: string }[]
    }
  | {
      kind: "toggles"
      label: string
      name: string
      options: readonly { label: string; value: string }[]
    }
  | { kind: "switch"; label: string; name: string }

export type ToolDefinition = {
  description: string
  fields: readonly ToolOptionField[]
  label: string
  placeholder: string
  promptLabel: string
  values: Record<string, unknown>
}

const platforms = [
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "TikTok", value: "tiktok" },
  { label: "X", value: "x" },
  { label: "YouTube", value: "youtube" },
  { label: "Correo", value: "email" },
] as const

const languages = [
  { label: "Español", value: "es" },
  { label: "Inglés", value: "en" },
  { label: "Portugués", value: "pt" },
] as const

const tones = [
  { label: "Cercano", value: "cercano" },
  { label: "Profesional", value: "profesional" },
  { label: "Divertido", value: "divertido" },
  { label: "Inspirador", value: "inspirador" },
  { label: "Directo", value: "directo" },
] as const

/**
 * Cada herramienta declara los mismos campos que tenía su formulario cuando era
 * una pantalla independiente, para no perder ninguna opción al unificarlas.
 */
export const chatTools: Record<ChatTool, ToolDefinition> = {
  content: {
    description: "Publicaciones, anuncios y textos por canal.",
    fields: [
      { kind: "text", label: "Objetivo", name: "objective" },
      { kind: "select", label: "Tono", name: "tone", options: tones },
      { kind: "select", label: "Idioma", name: "language", options: languages },
      {
        kind: "toggles",
        label: "Plataformas",
        name: "platforms",
        options: platforms,
      },
      {
        kind: "number",
        label: "Variantes",
        max: 8,
        min: 1,
        name: "variantCount",
      },
      { kind: "switch", label: "Incluir hashtags", name: "includeHashtags" },
      {
        kind: "text",
        label: "Llamada a la acción",
        name: "callToAction",
        placeholder: "Opcional",
      },
    ],
    label: "Contenido",
    placeholder: "Describe la publicación que necesitas…",
    promptLabel: "Brief",
    values: {
      callToAction: "",
      includeHashtags: true,
      language: "es",
      objective: "engagement",
      platforms: ["instagram"],
      tone: "cercano",
      variantCount: 3,
    },
  },
  image: {
    description: "Imágenes generadas o editadas desde una referencia.",
    fields: [
      { kind: "text", label: "Objetivo", name: "objective" },
      {
        kind: "select",
        label: "Proporción",
        name: "aspectRatio",
        options: [
          { label: "Cuadrada 1:1", value: "1:1" },
          { label: "Vertical 9:16", value: "9:16" },
          { label: "Horizontal 16:9", value: "16:9" },
        ],
      },
      {
        kind: "select",
        label: "Calidad",
        name: "quality",
        options: [
          { label: "Baja", value: "low" },
          { label: "Media", value: "medium" },
          { label: "Alta", value: "high" },
        ],
      },
    ],
    label: "Imagen",
    placeholder: "Describe la imagen que quieres generar…",
    promptLabel: "Prompt",
    values: { aspectRatio: "1:1", objective: "engagement", quality: "medium" },
  },
  video: {
    description: "Video corto desde texto o desde una referencia.",
    fields: [
      { kind: "text", label: "Objetivo", name: "objective" },
      {
        kind: "select",
        label: "Proporción",
        name: "aspectRatio",
        options: [
          { label: "Vertical 9:16", value: "9:16" },
          { label: "Horizontal 16:9", value: "16:9" },
          { label: "Cuadrada 1:1", value: "1:1" },
        ],
      },
      {
        kind: "select",
        label: "Duración",
        name: "durationSeconds",
        options: [
          { label: "4 segundos", value: "4" },
          { label: "8 segundos", value: "8" },
          { label: "12 segundos", value: "12" },
        ],
      },
    ],
    label: "Video",
    placeholder: "Describe el video que quieres generar…",
    promptLabel: "Prompt",
    values: {
      aspectRatio: "9:16",
      durationSeconds: 8,
      objective: "engagement",
    },
  },
  repurpose: {
    description: "Adapta contenido existente a otros canales.",
    fields: [
      { kind: "text", label: "Objetivo", name: "objective" },
      { kind: "select", label: "Tono", name: "tone", options: tones },
      { kind: "select", label: "Idioma", name: "language", options: languages },
      {
        kind: "toggles",
        label: "Plataformas destino",
        name: "platforms",
        options: platforms,
      },
    ],
    label: "Reutilizar",
    placeholder: "Pega el contenido original que quieres adaptar…",
    promptLabel: "Contenido original",
    values: {
      language: "es",
      objective: "adaptar",
      platforms: ["instagram"],
      tone: "cercano",
    },
  },
  review: {
    description: "Analiza un texto y propone correcciones.",
    fields: [
      { kind: "text", label: "Objetivo", name: "objective" },
      { kind: "select", label: "Idioma", name: "language", options: languages },
      {
        kind: "toggles",
        label: "Plataformas",
        name: "platforms",
        options: platforms,
      },
    ],
    label: "Revisión",
    placeholder: "Pega el contenido que quieres analizar…",
    promptLabel: "Contenido para analizar",
    values: { language: "es", objective: "calidad", platforms: [] },
  },
  planner: {
    description: "Calendario de contenidos por días y frecuencia.",
    fields: [
      { kind: "number", label: "Días", max: 31, min: 3, name: "durationDays" },
      {
        kind: "number",
        label: "Publicaciones por semana",
        max: 14,
        min: 1,
        name: "frequencyPerWeek",
      },
      {
        kind: "toggles",
        label: "Plataformas",
        name: "platforms",
        options: platforms,
      },
      { kind: "date", label: "Fecha inicial", name: "startDate" },
    ],
    label: "Planificador",
    placeholder: "Describe la campaña que quieres planificar…",
    promptLabel: "Brief de campaña",
    values: {
      durationDays: 7,
      frequencyPerWeek: 4,
      platforms: ["instagram"],
      startDate: "",
    },
  },
  timing: {
    description: "Mejores horarios según tu histórico de publicación.",
    fields: [
      { kind: "text", label: "Zona horaria", name: "timezone" },
      {
        kind: "number",
        label: "Días de histórico",
        max: 365,
        min: 7,
        name: "historyDays",
      },
    ],
    label: "Mejor horario",
    placeholder: "Indica qué cuentas o campaña quieres analizar…",
    promptLabel: "Contexto",
    values: { historyDays: 90, socialAccountIds: [], timezone: "UTC" },
  },
  search: {
    description: "Busca dentro de tu contenido y generaciones previas.",
    fields: [
      {
        kind: "toggles",
        label: "Dónde buscar",
        name: "types",
        options: [
          { label: "Captions", value: "caption" },
          { label: "Publicaciones", value: "publishing_post" },
          { label: "Generaciones", value: "ai_request" },
        ],
      },
      { kind: "number", label: "Resultados", max: 50, min: 1, name: "limit" },
    ],
    label: "Investigación",
    placeholder: "¿Qué quieres encontrar?",
    promptLabel: "Consulta",
    values: { limit: 20, types: [] },
  },
}

export const chatToolKeys = Object.keys(chatTools) as ChatTool[]

export function isChatTool(value: string | null): value is ChatTool {
  return Boolean(value) && chatToolKeys.includes(value as ChatTool)
}
