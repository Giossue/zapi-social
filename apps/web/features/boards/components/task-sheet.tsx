"use client"

import { useState, type FormEvent } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { CalendarDays, Paperclip, Save, Send, Trash2 } from "lucide-react"

import type {
  BoardColumn,
  BoardLabel,
  BoardMember,
  BoardTaskDetail,
  BoardTaskPriority,
} from "@workspace/contracts"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"

import { initialsOf } from "./board-task-card"

const priorities: readonly BoardTaskPriority[] = ["low", "medium", "high"]

export type TaskDraft = {
  title: string
  description: string
  priority: BoardTaskPriority
  dueDate: string
  progress: number
  assigneeUserId: string
  labelIds: string[]
}

/** Valor del selector cuando no hay responsable: `""` no lo admite Select. */
const unassignedValue = "none"

/**
 * La fecha límite es un día, no un instante. Se ancla al mediodía para que el
 * desfase horario no la corra al día anterior al convertirla.
 */
function dueDateValue(value: string) {
  return value ? new Date(`${value}T12:00:00`) : undefined
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function emptyTaskDraft(): TaskDraft {
  return {
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    progress: 0,
    assigneeUserId: unassignedValue,
    labelIds: [],
  }
}

export function draftFromTask(task: BoardTaskDetail): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    progress: task.progress,
    assigneeUserId: task.assignee?.id ?? unassignedValue,
    labelIds: [...task.labelIds],
  }
}

export function taskDraftToInput(draft: TaskDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    priority: draft.priority,
    dueDate: draft.dueDate || null,
    progress: draft.progress,
    assigneeUserId:
      draft.assigneeUserId === unassignedValue ? null : draft.assigneeUserId,
    labelIds: draft.labelIds,
  }
}

export function TaskSheet({
  canDelete,
  column,
  labels,
  members,
  onAddComment,
  onDelete,
  onOpenChange,
  onRemoveAttachment,
  onSubmit,
  open,
  pending,
  task,
}: {
  canDelete: boolean
  column: BoardColumn | null
  labels: readonly BoardLabel[]
  members: readonly BoardMember[]
  onAddComment: (body: string) => Promise<boolean>
  onDelete: () => void
  onOpenChange: (open: boolean) => void
  onRemoveAttachment: (attachmentId: string) => void
  onSubmit: (draft: TaskDraft) => Promise<boolean>
  open: boolean
  pending: boolean
  task: BoardTaskDetail | null
}) {
  const t = useTranslations("boards")
  const format = useFormatter()
  const [draft, setDraft] = useState<TaskDraft>(emptyTaskDraft)
  const [comment, setComment] = useState("")
  const [lastTaskId, setLastTaskId] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)

  // Ajustar el estado durante el render en vez de en un efecto: la hoja parte
  // de la tarea elegida sin encadenar un segundo render.
  const taskId = task?.id ?? null
  if (open !== wasOpen || taskId !== lastTaskId) {
    setWasOpen(open)
    setLastTaskId(taskId)
    if (open) {
      setDraft(task ? draftFromTask(task) : emptyTaskDraft())
      setComment("")
    }
  }

  function toggleLabel(labelId: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      labelIds: checked
        ? [...new Set([...current.labelIds, labelId])]
        : current.labelIds.filter((id) => id !== labelId),
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await onSubmit(draft)
    if (saved) onOpenChange(false)
  }

  async function sendComment() {
    const body = comment.trim()
    if (!body) return
    if (await onAddComment(body)) setComment("")
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{task ? t("editTask") : t("createTask")}</SheetTitle>
          <SheetDescription>
            {column
              ? t("taskInColumn", { name: column.name })
              : t("taskSheetDescription")}
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="board-task-title">
                  {t("titleLabel")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="board-task-title"
                  maxLength={200}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder={t("titlePlaceholder")}
                  value={draft.title}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="board-task-description">
                  {t("descriptionLabel")}
                </FieldLabel>
                <Textarea
                  disabled={pending}
                  id="board-task-description"
                  maxLength={5000}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder={t("descriptionPlaceholder")}
                  rows={4}
                  value={draft.description}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="board-task-priority">
                    {t("priorityLabel")}
                  </FieldLabel>
                  <Select
                    disabled={pending}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        priority: value as BoardTaskPriority,
                      }))
                    }
                    value={draft.priority}
                  >
                    <SelectTrigger id="board-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {priorities.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {t(`priority.${priority}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="board-task-assignee">
                    {t("assigneeLabel")}
                  </FieldLabel>
                  <Select
                    disabled={pending}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        assigneeUserId: value,
                      }))
                    }
                    value={draft.assigneeUserId}
                  >
                    <SelectTrigger id="board-task-assignee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={unassignedValue}>
                          {t("unassigned")}
                        </SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="board-task-due">
                    {t("dueDateLabel")}
                  </FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        className="justify-start"
                        disabled={pending}
                        id="board-task-due"
                        role="combobox"
                        type="button"
                        variant="surface"
                      >
                        <CalendarDays data-icon="inline-start" />
                        {draft.dueDate
                          ? format.dateTime(
                              dueDateValue(draft.dueDate)!,
                              "date"
                            )
                          : t("noDueDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        onSelect={(next) =>
                          setDraft((current) => ({
                            ...current,
                            dueDate: next ? toDateKey(next) : "",
                          }))
                        }
                        selected={dueDateValue(draft.dueDate)}
                      />
                      <div className="border-t p-2">
                        <Button
                          className="w-full"
                          onClick={() =>
                            setDraft((current) => ({ ...current, dueDate: "" }))
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {t("clearDueDate")}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </Field>
                <Field>
                  <FieldLabel htmlFor="board-task-progress">
                    {t("progressLabel")}
                  </FieldLabel>
                  <Input
                    disabled={pending}
                    id="board-task-progress"
                    max={100}
                    min={0}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        progress: Math.max(
                          0,
                          Math.min(100, Number(event.target.value) || 0)
                        ),
                      }))
                    }
                    type="number"
                    value={String(draft.progress)}
                  />
                </Field>
              </div>
              {labels.length ? (
                <FieldSet data-disabled={pending}>
                  <FieldLegend variant="label">{t("labelsLegend")}</FieldLegend>
                  <FieldGroup className="gap-3" data-slot="checkbox-group">
                    {labels.map((label) => {
                      const controlId = `board-label-${label.id}`
                      return (
                        <Field key={label.id} orientation="horizontal">
                          <Checkbox
                            checked={draft.labelIds.includes(label.id)}
                            disabled={pending}
                            id={controlId}
                            onCheckedChange={(value) =>
                              toggleLabel(label.id, value === true)
                            }
                          />
                          <FieldLabel htmlFor={controlId}>
                            <FieldContent>
                              <FieldTitle>{label.name}</FieldTitle>
                            </FieldContent>
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                </FieldSet>
              ) : null}
            </FieldGroup>

            {task ? (
              <FieldSet>
                <FieldLegend variant="label">
                  {t("attachmentsLegend")}
                </FieldLegend>
                {task.attachments.length ? (
                  <ul className="grid gap-2">
                    {task.attachments.map((attachment) => (
                      <li
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                        key={attachment.id}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <span className="truncate text-sm">
                            {attachment.name}
                          </span>
                        </span>
                        <Button
                          aria-label={t("removeAttachment", {
                            name: attachment.name,
                          })}
                          disabled={pending}
                          onClick={() => onRemoveAttachment(attachment.id)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <FieldDescription>{t("noAttachments")}</FieldDescription>
                )}
              </FieldSet>
            ) : null}

            {task ? (
              <FieldSet>
                <FieldLegend variant="label">{t("commentsLegend")}</FieldLegend>
                {task.comments.length ? (
                  <ul className="grid gap-3">
                    {task.comments.map((entry) => (
                      <li className="grid gap-1" key={entry.id}>
                        <span className="flex items-center gap-2">
                          <Avatar className="size-5 after:rounded-sm">
                            <AvatarFallback className="rounded-sm text-[10px]">
                              {initialsOf(entry.author?.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {entry.author?.name ?? t("unknownAuthor")}
                          </span>
                          <Badge variant="neutral">
                            {format.dateTime(new Date(entry.createdAt), "date")}
                          </Badge>
                        </span>
                        <p className="text-sm whitespace-pre-line text-muted-foreground">
                          {entry.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <FieldDescription>{t("noComments")}</FieldDescription>
                )}
                <Field>
                  <FieldLabel htmlFor="board-task-comment">
                    {t("addComment")}
                  </FieldLabel>
                  <Textarea
                    disabled={pending}
                    id="board-task-comment"
                    maxLength={5000}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={t("commentPlaceholder")}
                    rows={3}
                    value={comment}
                  />
                  <Button
                    className="justify-self-end"
                    disabled={pending || !comment.trim()}
                    onClick={() => void sendComment()}
                    type="button"
                    variant="brand-secondary"
                  >
                    <Send data-icon="inline-start" />
                    {t("sendComment")}
                  </Button>
                </Field>
              </FieldSet>
            ) : null}
          </div>
          <SheetFooter className="flex-row justify-between border-t">
            {task && canDelete ? (
              <Button
                disabled={pending}
                onClick={onDelete}
                type="button"
                variant="destructive"
              >
                <Trash2 data-icon="inline-start" />
                {t("deleteTask")}
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button
                disabled={pending}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={pending || !draft.title.trim()} type="submit">
                {pending ? (
                  <Spinner data-icon="inline-start" size={16} />
                ) : (
                  <Save aria-hidden="true" data-icon="inline-start" />
                )}
                {t("save")}
              </Button>
            </span>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
