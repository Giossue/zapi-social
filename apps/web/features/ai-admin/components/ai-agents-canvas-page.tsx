"use client"

import { createContext, useCallback, useContext, useState } from "react"
import type { Edge as FlowEdge, Node as FlowNode } from "@xyflow/react"
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react"
import { EllipsisVertical, Zap } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

import { Canvas } from "@/components/ai-elements/canvas"
import { Connection } from "@/components/ai-elements/connection"
import { Controls } from "@/components/ai-elements/controls"
import { Edge } from "@/components/ai-elements/edge"
import {
  Node,
  NodeAction,
  NodeContent,
  NodeDescription,
  NodeHeader,
  NodeTitle,
} from "@/components/ai-elements/node"
import { Panel } from "@/components/ai-elements/panel"

import { AiAgentIcon } from "./ai-agent-icon"
import { AiConfigurationPage } from "./ai-configuration-page"
import {
  agentCanvasEdges,
  agentCanvasNodes,
  type AgentCanvasNodeData,
} from "../fixtures/ai-agents"

const EditAgentContext = createContext<(id: string) => void>(() => {})

function AgentFlowNode({
  data,
  id,
}: {
  data: AgentCanvasNodeData
  id: string
}) {
  const t = useTranslations("aiAgents.canvas")
  const onEdit = useContext(EditAgentContext)

  return (
    <Node handles={{ source: true, target: true }}>
      <NodeHeader>
        <div className="flex items-center gap-2">
          <AiAgentIcon className="size-4 shrink-0" />
          <NodeTitle>{data.name}</NodeTitle>
        </div>
        <NodeDescription>{data.description}</NodeDescription>
        <NodeAction>
          <Button
            aria-label={t("editAgent", { name: data.name })}
            onClick={() => onEdit(id)}
            size="icon-sm"
            variant="brand-secondary"
          >
            <EllipsisVertical />
          </Button>
        </NodeAction>
      </NodeHeader>
      <NodeContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("model")}</span>
          <Badge variant="secondary">{data.model}</Badge>
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
    </Node>
  )
}

function TriggerFlowNode({ data }: { data: AgentCanvasNodeData }) {
  return (
    <Node className="w-64" handles={{ source: true, target: false }}>
      <NodeHeader className="rounded-b-md border-b-0">
        <div className="flex items-center gap-2">
          <Zap className="size-4 shrink-0" />
          <NodeTitle>{data.name}</NodeTitle>
        </div>
        <NodeDescription>{data.description}</NodeDescription>
      </NodeHeader>
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
  const te = useTranslations("aiAgents.editor")
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [editingId, setEditingId] = useState<string | null>(null)

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

  const editingNode = nodes.find((node) => node.id === editingId)
  const editingData = editingNode?.data as AgentCanvasNodeData | undefined

  const renameAgent = useCallback((id: string, name: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, name } } : node
      )
    )
  }, [])

  return (
    <EditAgentContext.Provider value={setEditingId}>
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

      <Sheet
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        open={Boolean(editingNode)}
      >
        <SheetContent
          className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
          side="right"
        >
          <SheetHeader className="border-b">
            <SheetTitle>{editingData?.name}</SheetTitle>
            <SheetDescription>{te("description")}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <div className="mx-auto grid w-full max-w-5xl gap-4">
              <Field>
                <FieldLabel htmlFor="agent-name">
                  {te("name")}{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="agent-name"
                  onChange={(event) => {
                    if (editingNode)
                      renameAgent(editingNode.id, event.target.value)
                  }}
                  value={editingData?.name ?? ""}
                />
              </Field>
              <AiConfigurationPage />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </EditAgentContext.Provider>
  )
}
