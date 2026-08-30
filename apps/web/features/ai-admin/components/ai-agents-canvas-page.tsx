"use client"

import { useCallback, useState } from "react"
import type { Edge as FlowEdge, Node as FlowNode } from "@xyflow/react"
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react"
import { Zap } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"

import { Canvas } from "@/components/ai-elements/canvas"
import { Connection } from "@/components/ai-elements/connection"
import { Controls } from "@/components/ai-elements/controls"
import { Edge } from "@/components/ai-elements/edge"
import {
  Node,
  NodeContent,
  NodeDescription,
  NodeFooter,
  NodeHeader,
  NodeTitle,
} from "@/components/ai-elements/node"
import { Panel } from "@/components/ai-elements/panel"

import { AiAgentIcon } from "./ai-agent-icon"
import {
  agentCanvasEdges,
  agentCanvasNodes,
  type AgentCanvasNodeData,
} from "../fixtures/ai-agents"

function AgentFlowNode({ data }: { data: AgentCanvasNodeData }) {
  const t = useTranslations("aiAgents.canvas")

  return (
    <Node handles={{ source: true, target: true }}>
      <NodeHeader>
        <div className="flex items-center gap-2">
          <AiAgentIcon className="size-4 shrink-0" />
          <NodeTitle>{data.name}</NodeTitle>
        </div>
        <NodeDescription>{data.description}</NodeDescription>
      </NodeHeader>
      <NodeContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{t("model")}</span>
          <span className="font-medium">{data.model}</span>
        </div>
        {data.tools?.length ? (
          <div className="flex flex-wrap gap-1">
            {data.tools.map((tool) => (
              <Badge key={tool} variant="outline">
                {tool}
              </Badge>
            ))}
          </div>
        ) : null}
      </NodeContent>
      <NodeFooter>
        <span className="text-xs text-muted-foreground">{t("agent")}</span>
      </NodeFooter>
    </Node>
  )
}

function TriggerFlowNode({ data }: { data: AgentCanvasNodeData }) {
  const t = useTranslations("aiAgents.canvas")

  return (
    <Node className="w-64" handles={{ source: true, target: false }}>
      <NodeHeader>
        <div className="flex items-center gap-2">
          <Zap className="size-4 shrink-0" />
          <NodeTitle>{data.name}</NodeTitle>
        </div>
        <NodeDescription>{data.description}</NodeDescription>
      </NodeHeader>
      <NodeFooter>
        <span className="text-xs text-muted-foreground">{t("trigger")}</span>
      </NodeFooter>
    </Node>
  )
}

const nodeTypes = {
  agent: AgentFlowNode,
  trigger: TriggerFlowNode,
}

const edgeTypes = {
  animated: Edge.Animated,
  temporary: Edge.Temporary,
}

const initialNodes: FlowNode[] = agentCanvasNodes.map((node) => ({
  data: node.data,
  id: node.id,
  position: node.position,
  type: node.type,
}))

const initialEdges: FlowEdge[] = agentCanvasEdges.map((edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  type: edge.type,
}))

export function AiAgentsCanvasPage() {
  const t = useTranslations("aiAgents.canvas")
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    []
  )

  return (
    <div className="h-[calc(100svh-var(--dashboard-header-height)-3rem)] min-h-96 overflow-hidden rounded-lg border border-border">
      <Canvas
        connectionLineComponent={Connection}
        edges={edges}
        edgeTypes={edgeTypes}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
      >
        <Controls />
        <Panel position="top-left">
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("preview")}
          </p>
        </Panel>
      </Canvas>
    </div>
  )
}
