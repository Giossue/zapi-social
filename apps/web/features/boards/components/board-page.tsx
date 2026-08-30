"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { move } from "@dnd-kit/helpers"
import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/react"
import { CircleAlert, KanbanSquare, Plus, Search } from "lucide-react"

import { ApiError, boardsApi } from "@workspace/api-client"
import type {
  BoardColumn,
  BoardResponse,
  BoardTask,
  BoardTaskDetail,
} from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { DataTableFilter } from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { toast } from "@workspace/ui/components/toast"

import { DataTableToolbar } from "@/components/data-table-toolbar"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"

import { BoardColumnSection } from "./board-column"
import { BoardTaskCard } from "./board-task-card"
import { ColumnSheet } from "./column-sheet"
import { TaskSheet, taskDraftToInput, type TaskDraft } from "./task-sheet"

type BoardState = Record<string, BoardTask[]>

const allAssignees = "all"
const allPriorities = "all"

function groupByColumn(
  columns: readonly BoardColumn[],
  tasks: readonly BoardTask[]
): BoardState {
  const state: BoardState = {}
  for (const column of columns) state[column.id] = []
  for (const task of tasks) {
    state[task.columnId]?.push(task)
  }
  return state
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function BoardPage() {
  const t = useTranslations("boards")
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [data, setData] = useState<BoardResponse | null>(null)
  const [board, setBoard] = useState<BoardState>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState("")
  const [assignee, setAssignee] = useState(allAssignees)
  const [priority, setPriority] = useState(allPriorities)

  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<BoardTaskDetail | null>(null)
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null)
  const [columnSheetOpen, setColumnSheetOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<BoardColumn | null>(null)

  const boardBeforeDrag = useRef<BoardState>({})

  const starterNames = useMemo(
    () => ({
      todo: t("starter.todo"),
      doing: t("starter.doing"),
      done: t("starter.done"),
    }),
    [t]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadFailed(false)
    try {
      const response = await boardsApi.board(
        {
          q: query.trim() || undefined,
          assigneeId: assignee === allAssignees ? undefined : assignee,
          priority:
            priority === allPriorities
              ? undefined
              : (priority as BoardTask["priority"]),
        },
        starterNames
      )
      setData(response)
      setBoard(groupByColumn(response.columns, response.tasks))
      setColumnOrder(response.columns.map((column) => column.id))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPath())
        return
      }
      setLoadFailed(true)
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsLoading(false)
    }
  }, [apiErrorMessage, assignee, priority, query, router, starterNames])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const columns = useMemo(
    () =>
      columnOrder.flatMap(
        (id) => data?.columns.find((column) => column.id === id) ?? []
      ),
    [columnOrder, data?.columns]
  )
  const abilities = data?.abilities
  const canManageTasks = Boolean(abilities?.manageTasks)
  const canManageColumns = Boolean(abilities?.manageColumns)

  function handleDragStart(event: DragStartEvent) {
    if (event.operation.source?.type === "task") boardBeforeDrag.current = board
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.operation.source?.type === "task") {
      setBoard((current) => move(current, event))
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation
    if (!source) return

    if (event.canceled) {
      if (source.type === "task") setBoard(boardBeforeDrag.current)
      return
    }

    if (source.type === "column") {
      const previous = columnOrder
      const next = move(columnOrder, event)
      setColumnOrder(next)
      try {
        await boardsApi.reorderColumns({ columnIds: next })
      } catch (error) {
        setColumnOrder(previous)
        toast.error(apiErrorMessage(errorCode(error)))
      }
      return
    }

    const taskId = String(source.id)
    const columnId = Object.keys(board).find((id) =>
      board[id]?.some((task) => task.id === taskId)
    )
    if (!columnId) return
    const position = board[columnId]!.findIndex((task) => task.id === taskId)

    try {
      await boardsApi.moveTask(taskId, { columnId, position })
    } catch (error) {
      setBoard(boardBeforeDrag.current)
      toast.error(apiErrorMessage(errorCode(error)))
    }
  }

  function openNewTask(columnId: string) {
    setActiveTask(null)
    setTargetColumnId(columnId)
    setTaskSheetOpen(true)
  }

  async function openTask(task: BoardTask) {
    setTargetColumnId(task.columnId)
    setTaskSheetOpen(true)
    try {
      setActiveTask(await boardsApi.task(task.id))
    } catch (error) {
      setTaskSheetOpen(false)
      toast.error(apiErrorMessage(errorCode(error)))
    }
  }

  async function saveTask(draft: TaskDraft) {
    setPending(true)
    try {
      const input = taskDraftToInput(draft)
      if (activeTask) {
        await boardsApi.updateTask(activeTask.id, input)
      } else if (targetColumnId) {
        await boardsApi.createTask({
          ...input,
          columnId: targetColumnId,
          publishingPostId: null,
        })
      }
      await load()
      toast.success(t("taskSaved"))
      return true
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
      return false
    } finally {
      setPending(false)
    }
  }

  async function addComment(body: string) {
    if (!activeTask) return false
    setPending(true)
    try {
      setActiveTask(await boardsApi.addComment(activeTask.id, { body }))
      await load()
      return true
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
      return false
    } finally {
      setPending(false)
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!activeTask) return
    setPending(true)
    try {
      setActiveTask(
        await boardsApi.removeAttachment(activeTask.id, attachmentId)
      )
      await load()
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function deleteTask() {
    if (!activeTask) return
    setPending(true)
    try {
      await boardsApi.deleteTask(activeTask.id)
      setTaskSheetOpen(false)
      await load()
      toast.success(t("taskDeleted"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  async function deleteColumn(column: BoardColumn) {
    setPending(true)
    try {
      await boardsApi.deleteColumn(column.id)
      await load()
      toast.success(t("columnDeleted"))
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setPending(false)
    }
  }

  if (isLoading && !data) return <PageLoading />

  if (loadFailed && !data) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailed")}
      />
    )
  }

  return (
    <div
      className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden"
      data-content-padding="false"
    >
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{t("pageTitle")}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {t("pageDescription")}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
          <InputGroup className="min-w-0 sm:w-64">
            <InputGroupInput
              aria-label={t("searchLabel")}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              type="text"
              value={query}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <DataTableToolbar className="w-full px-0 sm:w-auto">
            <DataTableFilter
              ariaLabel={t("assigneeFilter")}
              onValueChange={setAssignee}
              options={[
                { label: t("allAssignees"), value: allAssignees },
                { label: t("assignedToMe"), value: "me" },
                ...(data?.members.map((member) => ({
                  label: member.name,
                  value: member.id,
                })) ?? []),
              ]}
              value={assignee}
            />
            <DataTableFilter
              ariaLabel={t("priorityFilter")}
              onValueChange={setPriority}
              options={[
                { label: t("allPriorities"), value: allPriorities },
                { label: t("priority.high"), value: "high" },
                { label: t("priority.medium"), value: "medium" },
                { label: t("priority.low"), value: "low" },
              ]}
              value={priority}
            />
          </DataTableToolbar>
          {canManageColumns ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setEditingColumn(null)
                setColumnSheetOpen(true)
              }}
              variant="brand-secondary"
            >
              <Plus data-icon="inline-start" />
              {t("addColumn")}
            </Button>
          ) : null}
          {canManageTasks && columns.length ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => openNewTask(columns[0]!.id)}
            >
              <Plus data-icon="inline-start" />
              {t("addTask")}
            </Button>
          ) : null}
        </div>
      </div>

      {columns.length ? (
        <DragDropProvider
          onDragEnd={(event) => void handleDragEnd(event)}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
        >
          <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/25 px-4 pt-4 pb-0 [scrollbar-color:var(--border)_transparent] lg:px-5 lg:pt-5 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            <div
              className="inline-grid h-full min-w-full gap-4"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(20rem, 1fr))`,
              }}
            >
              {columns.map((column, index) => (
                <BoardColumnSection
                  canManageColumns={canManageColumns}
                  canManageTasks={canManageTasks}
                  column={column}
                  index={index}
                  key={column.id}
                  labels={data?.labels ?? []}
                  onAddTask={() => openNewTask(column.id)}
                  onDeleteColumn={() => void deleteColumn(column)}
                  onEditColumn={() => {
                    setEditingColumn(column)
                    setColumnSheetOpen(true)
                  }}
                  onOpenTask={(task) => void openTask(task)}
                  tasks={board[column.id] ?? []}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {(source) => {
              const dragged = source.data as
                { type: "task"; task: BoardTask } | undefined
              if (source.type !== "task" || !dragged) return null
              return (
                <BoardTaskCard
                  isOverlay
                  labels={data?.labels ?? []}
                  task={dragged.task}
                />
              )
            }}
          </DragOverlay>
        </DragDropProvider>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/25 p-6">
          <EmptyState
            description={t("emptyBoardDescription")}
            icon={KanbanSquare}
            title={t("emptyBoard")}
          />
        </div>
      )}

      <TaskSheet
        canDelete={Boolean(abilities?.deleteTasks)}
        column={columns.find((column) => column.id === targetColumnId) ?? null}
        labels={data?.labels ?? []}
        members={data?.members ?? []}
        onAddComment={addComment}
        onDelete={() => void deleteTask()}
        onOpenChange={setTaskSheetOpen}
        onRemoveAttachment={(id) => void removeAttachment(id)}
        onSubmit={saveTask}
        open={taskSheetOpen}
        pending={pending}
        task={activeTask}
      />

      <ColumnSheet
        column={editingColumn}
        onOpenChange={setColumnSheetOpen}
        onSaved={() => void load()}
        open={columnSheetOpen}
      />
    </div>
  )
}
