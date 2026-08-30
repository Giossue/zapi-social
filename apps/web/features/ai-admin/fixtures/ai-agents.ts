export type AgentCanvasNodeData = {
  description: string
  kind: "agent" | "trigger" | "tool"
  model?: string
  name: string
  tools?: string[]
}

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
      model: "gpt-4o",
      name: "Orquestador",
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
      model: "gpt-4o-mini",
      name: "Agente de contenido",
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
      model: "atlascloud/seedream",
      name: "Agente de media",
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
      model: "gpt-4o-mini",
      name: "Agente de publicación",
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
