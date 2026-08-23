"use client"

import { useSortable } from "@dnd-kit/react/sortable"

import type { BoardLabel, BoardTask } from "@workspace/contracts"
import { cn } from "@workspace/ui/lib/utils"

import { BoardTaskCard } from "./board-task-card"

export function SortableTaskCard({
  columnId,
  disabled,
  index,
  isTerminal,
  labels,
  onOpen,
  task,
}: {
  columnId: string
  disabled: boolean
  index: number
  isTerminal: boolean
  labels: readonly BoardLabel[]
  onOpen: () => void
  task: BoardTask
}) {
  const { isDragging, ref } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: columnId,
    disabled,
    data: { type: "task", task, columnId },
  })

  return (
    <div className={cn("touch-none", isDragging && "opacity-30")} ref={ref}>
      <BoardTaskCard
        isTerminal={isTerminal}
        labels={labels}
        onOpen={onOpen}
        task={task}
      />
    </div>
  )
}
