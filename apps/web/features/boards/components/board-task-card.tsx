"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Flame,
  Minus,
  MessageSquare,
  Paperclip,
  type LucideIcon,
} from "lucide-react"

import type {
  BoardLabel,
  BoardTask,
  BoardTaskPriority,
} from "@workspace/contracts"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"

/** Iniciales del nombre para el avatar; dos como mucho. */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase()
}

const priorityIcons: Record<BoardTaskPriority, LucideIcon> = {
  high: Flame,
  medium: ArrowUpRight,
  low: Minus,
}

const priorityVariants: Record<
  BoardTaskPriority,
  "destructive" | "warning" | "neutral"
> = {
  high: "destructive",
  medium: "warning",
  low: "neutral",
}

export function BoardTaskCard({
  isOverlay = false,
  isTerminal = false,
  labels,
  onOpen,
  task,
}: {
  isOverlay?: boolean
  isTerminal?: boolean
  labels: readonly BoardLabel[]
  onOpen?: () => void
  task: BoardTask
}) {
  const t = useTranslations("boards")
  const format = useFormatter()
  const PriorityIcon = priorityIcons[task.priority]
  const taskLabels = labels.filter((label) => task.labelIds.includes(label.id))
  // El progreso solo se pinta cuando hay algo que contar: un cero en cada
  // tarjeta recién creada llenaría la columna de barras vacías.
  const showProgress = !isTerminal && task.progress > 0

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        onOpen && "cursor-pointer hover:border-primary/40",
        isOverlay && "w-68 rotate-1 shadow-lg"
      )}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm leading-none font-medium">
            {task.title}
          </h3>
          <Badge
            className="shrink-0 rounded-md px-2 font-medium"
            variant={priorityVariants[task.priority]}
          >
            <PriorityIcon data-icon="inline-start" />
            {t(`priority.${task.priority}`)}
          </Badge>
        </div>
        {task.description ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </div>

      {taskLabels.length ? (
        <div className="flex flex-wrap gap-1.5">
          {taskLabels.map((label) => (
            <Badge
              key={label.id}
              className="rounded-md border-transparent px-2 font-medium"
              style={{
                backgroundColor: `${label.color}1a`,
                color: label.color,
              }}
              variant="neutral"
            >
              {label.name}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {task.assignee ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-5 after:rounded-sm">
              <AvatarFallback className="rounded-sm text-[10px]">
                {initialsOf(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm text-muted-foreground">
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("unassigned")}
          </span>
        )}

        {task.dueDate ? (
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <span className="truncate text-sm">
              {format.dateTime(new Date(task.dueDate), "date")}
            </span>
            <CalendarDays className="size-3" />
          </span>
        ) : null}
      </div>

      {showProgress ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="leading-none">{t("progress")}</span>
            <span className="leading-none tabular-nums">
              {t("progressValue", { progress: task.progress })}
            </span>
          </div>
          <Progress value={task.progress} />
        </div>
      ) : null}

      <Separator />

      {isTerminal ? (
        <div className="flex items-center gap-1 text-sm font-medium text-success">
          <BadgeCheck className="size-4" />
          {t("done")}
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            {task.commentCount}
          </span>
          <span className="flex items-center gap-1.5">
            <Paperclip className="size-3.5" />
            {task.attachmentCount}
          </span>
        </div>
      )}
    </article>
  )
}
