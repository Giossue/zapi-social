"use client"

/* eslint-disable react-hooks/refs -- `@dnd-kit` entrega su `ref` como un valor
   que hay que leer en el render para registrar el elemento arrastrable. El
   compilador de React lo cuenta como acceso a una referencia durante el
   render; es la forma que la librería documenta y no se arregla desde aquí. */

import { CollisionPriority } from "@dnd-kit/abstract"
import { useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { useTranslations } from "next-intl"
import { GripVertical, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react"

import type { BoardColumn, BoardLabel, BoardTask } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { SortableTaskCard } from "./sortable-task-card"

export function BoardColumnSection({
  canManageColumns,
  canManageTasks,
  column,
  index,
  labels,
  onAddTask,
  onDeleteColumn,
  onEditColumn,
  onOpenTask,
  tasks,
}: {
  canManageColumns: boolean
  canManageTasks: boolean
  column: BoardColumn
  index: number
  labels: readonly BoardLabel[]
  onAddTask: () => void
  onDeleteColumn: () => void
  onEditColumn: () => void
  onOpenTask: (task: BoardTask) => void
  tasks: readonly BoardTask[]
}) {
  const t = useTranslations("boards")
  const columnSortable = useSortable({
    id: `column:${column.id}`,
    index,
    type: "column",
    accept: "column",
    group: "columns",
    disabled: !canManageColumns,
    data: { type: "column", columnId: column.id },
  })
  const taskDropTarget = useDroppable({
    id: column.id,
    type: "task-container",
    accept: "task",
    collisionPriority: CollisionPriority.Low,
    data: { type: "task-container", columnId: column.id },
  })
  const overWipLimit =
    column.wipLimit !== null && tasks.length > column.wipLimit

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-t-xl border bg-muted/50 transition-colors",
        (columnSortable.isDropTarget || taskDropTarget.isDropTarget) &&
          "bg-muted/70",
        columnSortable.isDragging && "opacity-60"
      )}
      ref={columnSortable.ref}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1">
            {canManageColumns ? (
              <Button
                aria-label={t("dragColumn", { name: column.name })}
                className="-ml-2 cursor-grab text-foreground/70 active:cursor-grabbing"
                ref={columnSortable.handleRef}
                size="icon-xs"
                variant="ghost"
              >
                <GripVertical />
              </Button>
            ) : null}
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: column.color }}
            />
            <h2 className="truncate text-base leading-none font-medium">
              {column.name}
            </h2>
          </div>
          <p
            className={cn(
              "text-sm leading-none tabular-nums",
              overWipLimit ? "text-warning" : "text-muted-foreground"
            )}
          >
            {column.wipLimit === null
              ? t("taskCount", { count: tasks.length })
              : t("taskCountWithLimit", {
                  count: tasks.length,
                  limit: column.wipLimit,
                })}
          </p>
        </div>
        <div className="-mr-2 flex items-center gap-0.5 text-muted-foreground">
          {canManageTasks ? (
            <Button
              aria-label={t("addTaskTo", { name: column.name })}
              onClick={onAddTask}
              size="icon-sm"
              variant="ghost"
            >
              <Plus />
            </Button>
          ) : null}
          {canManageColumns ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("columnActions", { name: column.name })}
                  size="icon-sm"
                  variant="ghost"
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEditColumn}>
                  <Pencil />
                  {t("editColumn")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDeleteColumn}
                  variant="destructive"
                >
                  <Trash2 />
                  {t("deleteColumn")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
        ref={taskDropTarget.ref}
      >
        {tasks.map((task, taskIndex) => (
          <SortableTaskCard
            columnId={column.id}
            disabled={!canManageTasks}
            index={taskIndex}
            isTerminal={column.isTerminal}
            key={task.id}
            labels={labels}
            onOpen={() => onOpenTask(task)}
            task={task}
          />
        ))}
        {tasks.length ? null : (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {t("emptyColumn")}
          </p>
        )}
      </div>
    </section>
  )
}
