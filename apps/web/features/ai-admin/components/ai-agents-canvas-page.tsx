"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  Edge as FlowEdge,
  Node as FlowNode,
  OnNodeDrag,
} from "@xyflow/react"
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react"
import { CircleAlert, EllipsisVertical, Save, Zap } from "lucide-react"
import { useTranslations } from "next-intl"

import { adminAiApi } from "@workspace/api-client"
import type { AdminAiAgent, AdminAiModel } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

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

const TRIGGER_NODE_ID = "trigger-chat"

type AgentDraft = {
  description: string
  enabled: boolean
  modelId: string | null
  name: string
  systemPrompt: string
}

const EditAgentContext = createContext<(id: string) => void>(() => {})

function useAgentToolLabel() {
  const t = useTranslations("aiAgents.tools")
  return (key: string) => t(key as Parameters<typeof t>[0])
}

function AgentFlowNode({
  data,
  id,
}: {
  data: { agent: AdminAiAgent; modelLabel: string | null }
  id: string
}) {
  const t = useTranslations("aiAgents.canvas")
  const toolLabel = useAgentToolLabel()
  const onEdit = useContext(EditAgentContext)

  return (
    <Node handles={{ source: true, target: true }}>
      <NodeHeader>
        <div className="flex items-center gap-2">
          <AiAgentIcon className="size-4 shrink-0" />
          <NodeTitle>{data.agent.name}</NodeTitle>
        </div>
        <NodeDescription>{data.agent.description}</NodeDescription>
        <NodeAction>
          <Button
            aria-label={t("editAgent", { name: data.agent.name })}
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
          {data.modelLabel ? (
            <Badge variant="secondary">{data.modelLabel}</Badge>
          ) : (
            <Badge variant="warning">{t("modelMissing")}</Badge>
          )}
        </div>
        {data.agent.tools.length ? (
          <div className="flex flex-wrap gap-1">
            {data.agent.tools.map((tool) => (
              <Badge key={tool} variant="outline">
                {toolLabel(tool)}
              </Badge>
            ))}
          </div>
        ) : null}
        {!data.agent.enabled ? (
          <Badge variant="neutral">{t("disabled")}</Badge>
        ) : null}
      </NodeContent>
    </Node>
  )
}

function TriggerFlowNode() {
  const t = useTranslations("aiAgents.canvas")

  return (
    <Node className="w-64" handles={{ source: true, target: false }}>
      <NodeHeader className="rounded-b-md border-b-0">
        <div className="flex items-center gap-2">
          <Zap className="size-4 shrink-0" />
          <NodeTitle>{t("triggerName")}</NodeTitle>
        </div>
        <NodeDescription>{t("triggerDescription")}</NodeDescription>
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

function modelLabelFor(models: AdminAiModel[], modelId: string | null) {
  const model = models.find((candidate) => candidate.id === modelId)
  return model ? model.label : null
}

export function AiAgentsCanvasPage() {
  const t = useTranslations("aiAgents.canvas")
  const te = useTranslations("aiAgents.editor")
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [edges, setEdges] = useState<FlowEdge[]>([])
  const [models, setModels] = useState<AdminAiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AgentDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await adminAiApi.agents()
      const orchestrator = data.agents.find(
        (agent) => agent.kind === "orchestrator"
      )
      setModels(data.models)
      setNodes([
        {
          data: {},
          id: TRIGGER_NODE_ID,
          position: { x: 0, y: 220 },
          type: "trigger",
        },
        ...data.agents.map((agent) => ({
          data: {
            agent,
            modelLabel: modelLabelFor(data.models, agent.modelId),
          },
          id: agent.id,
          position: agent.canvasPosition,
          type: "agent" as const,
        })),
      ])
      setEdges([
        ...(orchestrator
          ? [
              {
                id: "edge-trigger-orchestrator",
                source: TRIGGER_NODE_ID,
                target: orchestrator.id,
                type: "animated" as const,
              },
            ]
          : []),
        ...data.edges.map((edge) => ({
          id: edge.id,
          source: edge.sourceAgentId,
          target: edge.targetAgentId,
          type: "animated" as const,
        })),
      ])
    } catch (error) {
      console.error("AI agents request failed", error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

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

  const persistPosition = useCallback<OnNodeDrag>(
    (_event, node) => {
      if (node.id === TRIGGER_NODE_ID) return
      void adminAiApi
        .updateAgent(node.id, {
          canvasPosition: {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
          },
        })
        .catch(() => toast.error(te("positionFailed")))
    },
    [te]
  )

  const openEditor = useCallback(
    (id: string) => {
      const node = nodes.find((candidate) => candidate.id === id)
      const agent = (node?.data as { agent?: AdminAiAgent } | undefined)?.agent
      if (!agent) return
      setDraft({
        description: agent.description,
        enabled: agent.enabled,
        modelId: agent.modelId,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
      })
      setEditingId(id)
    },
    [nodes]
  )

  const editingNode = nodes.find((node) => node.id === editingId)
  const editingAgent = (
    editingNode?.data as { agent?: AdminAiAgent } | undefined
  )?.agent

  const saveDraft = useCallback(async () => {
    if (!editingAgent || !draft) return
    setSaving(true)
    try {
      const updated = await adminAiApi.updateAgent(editingAgent.id, {
        description: draft.description,
        enabled: draft.enabled,
        modelId: draft.modelId,
        name: draft.name,
        systemPrompt: draft.systemPrompt,
      })
      setNodes((current) =>
        current.map((node) =>
          node.id === updated.id
            ? {
                ...node,
                data: {
                  agent: updated,
                  modelLabel: modelLabelFor(models, updated.modelId),
                },
              }
            : node
        )
      )
      toast.success(te("saved"))
      setEditingId(null)
    } catch {
      toast.error(te("saveFailed"))
    } finally {
      setSaving(false)
    }
  }, [draft, editingAgent, models, te])

  const selectableModels = useMemo(
    () => models.filter((model) => model.enabled && !model.deprecated),
    [models]
  )

  if (loading) {
    return <PageLoading className="h-[60svh]" />
  }

  if (loadError) {
    return (
      <div className="flex h-[60svh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            description={t("loadFailedDescription")}
            icon={CircleAlert}
            title={t("loadFailedTitle")}
          />
          <RetryButton onClick={() => void load()}>{t("retry")}</RetryButton>
        </div>
      </div>
    )
  }

  return (
    <EditAgentContext.Provider value={openEditor}>
      <div className="h-[calc(100svh-var(--dashboard-header-height)-3rem)] min-h-96 overflow-hidden rounded-lg border border-border">
        <Canvas
          connectionLineComponent={Connection}
          edges={edges}
          edgeTypes={edgeTypes}
          nodes={nodes}
          nodeTypes={nodeTypes}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={persistPosition}
          onNodesChange={onNodesChange}
        >
          <Controls />
          <Panel position="top-left">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {t("hint")}
            </p>
          </Panel>
        </Canvas>
      </div>

      <Sheet
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        open={Boolean(editingAgent)}
      >
        <SheetContent
          className="w-full gap-0 p-0 sm:max-w-none data-[side=right]:sm:w-full data-[side=right]:sm:border-l-0"
          side="right"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <AiAgentIcon className="size-5 shrink-0" />
              {editingAgent?.name}
            </SheetTitle>
            <SheetDescription>{te("description")}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <Tabs defaultValue="parameters">
                <TabsList className="flex h-auto flex-wrap">
                  <TabsTrigger value="parameters">
                    {te("parameters")}
                  </TabsTrigger>
                  <TabsTrigger value="settings">{te("settings")}</TabsTrigger>
                </TabsList>
                <TabsContent
                  className="flex flex-col gap-4 pt-3"
                  value="parameters"
                >
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
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, name: event.target.value }
                            : current
                        )
                      }
                      value={draft?.name ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="agent-system-prompt">
                      {te("systemPrompt")}{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    </FieldLabel>
                    <Textarea
                      aria-required="true"
                      className="min-h-40"
                      id="agent-system-prompt"
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, systemPrompt: event.target.value }
                            : current
                        )
                      }
                      value={draft?.systemPrompt ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="agent-model">{te("model")}</FieldLabel>
                    <Select
                      onValueChange={(next) =>
                        setDraft((current) =>
                          current ? { ...current, modelId: next } : current
                        )
                      }
                      value={draft?.modelId ?? ""}
                    >
                      <SelectTrigger className="w-full" id="agent-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>{te("tools")}</FieldLabel>
                    <AgentToolBadges tools={editingAgent?.tools ?? []} />
                  </Field>
                </TabsContent>
                <TabsContent
                  className="flex flex-col gap-4 pt-3"
                  value="settings"
                >
                  <Field>
                    <FieldLabel htmlFor="agent-description">
                      {te("descriptionLabel")}
                    </FieldLabel>
                    <Textarea
                      className="min-h-24"
                      id="agent-description"
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, description: event.target.value }
                            : current
                        )
                      }
                      value={draft?.description ?? ""}
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <Switch
                      checked={draft?.enabled ?? false}
                      id="agent-enabled"
                      onCheckedChange={(checked) =>
                        setDraft((current) =>
                          current ? { ...current, enabled: checked } : current
                        )
                      }
                    />
                    <FieldLabel htmlFor="agent-enabled">
                      {te("enabled")}
                    </FieldLabel>
                  </Field>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  disabled={
                    saving ||
                    !draft?.name.trim() ||
                    !draft?.systemPrompt.trim()
                  }
                  onClick={() => void saveDraft()}
                >
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  {te("save")}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </EditAgentContext.Provider>
  )
}

function AgentToolBadges({ tools }: { tools: string[] }) {
  const toolLabel = useAgentToolLabel()
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tools.map((tool) => (
        <Badge key={tool} variant="outline">
          {toolLabel(tool)}
        </Badge>
      ))}
    </div>
  )
}
