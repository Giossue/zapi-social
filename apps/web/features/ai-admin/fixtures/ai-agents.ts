export type AgentCanvasNodeData = {
  description: string
  kind: "agent" | "trigger" | "tool"
  model?: string
  name: string
  systemPrompt?: string
  tools?: string[]
}

export const agentModelVariants = ["5.6-terra", "5.6-sol", "5.6-luna"] as const

export type AgentCanvasNode = {
  data: AgentCanvasNodeData
  id: string
  position: { x: number; y: number }
  type: "agent" | "trigger"
}

export type AgentCanvasEdge = {
  id: string
  source: string
  target: string
  type: "animated"
}

export const agentCanvasNodes: AgentCanvasNode[] = [
  {
    data: {
      description: "Mensaje del usuario en AI Studio",
      kind: "trigger",
      name: "Chat del Portal",
    },
    id: "trigger-chat",
    position: { x: 0, y: 220 },
    type: "trigger",
  },
  {
    data: {
      description: "Analiza la petición y decide qué agente responde",
      kind: "agent",
      model: "5.6-luna",
      name: "Orquestador",
      systemPrompt:
        "Eres el orquestador de la marca. Tu único trabajo es entender la petición del usuario, elegir el agente especialista adecuado y pasarle una orden clara y completa. Nunca ejecutas la tarea tú mismo.",
      tools: ["Buscar contenido previo", "Mejores horarios"],
    },
    id: "agent-orchestrator",
    position: { x: 480, y: 180 },
    type: "agent",
  },
  {
    data: {
      description: "Redacta captions por plataforma con la voz de la marca",
      kind: "agent",
      model: "5.6-sol",
      name: "Agente de contenido",
      systemPrompt:
        "Eres un copywriter experto en redes sociales. Escribes captions con la voz de la marca, adaptados a las reglas y límites de cada plataforma.",
      tools: ["Guardar caption", "Buscar captions"],
    },
    id: "agent-content",
    position: { x: 1000, y: 0 },
    type: "agent",
  },
  {
    data: {
      description: "Genera imágenes y videos promocionales",
      kind: "agent",
      model: "5.6-sol",
      name: "Agente de media",
      systemPrompt:
        "Eres un director de arte. Conviertes peticiones en prompts visuales detallados y generas imágenes y videos consistentes con la identidad de la marca.",
      tools: ["Generar imagen", "Generar video", "Guardar en Files"],
    },
    id: "agent-media",
    position: { x: 1000, y: 260 },
    type: "agent",
  },
  {
    data: {
      description: "Convierte el resultado en borrador de publicación",
      kind: "agent",
      model: "5.6-luna",
      name: "Agente de publicación",
      systemPrompt:
        "Preparas borradores de publicación y los programas en los mejores horarios. Eres preciso con fechas, zonas horarias y límites de cada red.",
      tools: ["Crear borrador", "Programar publicación"],
    },
    id: "agent-publishing",
    position: { x: 1000, y: 520 },
    type: "agent",
  },
]

export const agentCanvasEdges: AgentCanvasEdge[] = [
  {
    id: "edge-trigger-orchestrator",
    source: "trigger-chat",
    target: "agent-orchestrator",
    type: "animated",
  },
  {
    id: "edge-orchestrator-content",
    source: "agent-orchestrator",
    target: "agent-content",
    type: "animated",
  },
  {
    id: "edge-orchestrator-media",
    source: "agent-orchestrator",
    target: "agent-media",
    type: "animated",
  },
  {
    id: "edge-orchestrator-publishing",
    source: "agent-orchestrator",
    target: "agent-publishing",
    type: "animated",
  },
]
