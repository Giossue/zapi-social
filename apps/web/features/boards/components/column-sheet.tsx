"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"

import { ApiError, boardsApi } from "@workspace/api-client"
import type { BoardColumn } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { useApiErrorMessage } from "@/lib/api-error-message"

const columnColors = [
  { labelKey: "color.blue", value: "#2563eb" },
  { labelKey: "color.green", value: "#16a34a" },
  { labelKey: "color.amber", value: "#d97706" },
  { labelKey: "color.red", value: "#dc2626" },
  { labelKey: "color.violet", value: "#7c3aed" },
  { labelKey: "color.gray", value: "#475569" },
] as const

type ColumnDraft = {
  name: string
  color: string
  isTerminal: boolean
  wipLimit: string
}

const emptyDraft: ColumnDraft = {
  name: "",
  color: columnColors[0].value,
  isTerminal: false,
  wipLimit: "",
}

function draftFrom(column: BoardColumn): ColumnDraft {
  return {
    name: column.name,
    color: column.color,
    isTerminal: column.isTerminal,
    wipLimit: column.wipLimit === null ? "" : String(column.wipLimit),
  }
}

export function ColumnSheet({
  column,
  onOpenChange,
  onSaved,
  open,
}: {
  column: BoardColumn | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  open: boolean
}) {
  const t = useTranslations("boards")
  const apiErrorMessage = useApiErrorMessage()
  const [draft, setDraft] = useState<ColumnDraft>(emptyDraft)
  const [pending, setPending] = useState(false)
  const [lastColumnId, setLastColumnId] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)

  const columnId = column?.id ?? null
  if (open !== wasOpen || columnId !== lastColumnId) {
    setWasOpen(open)
    setLastColumnId(columnId)
    if (open) setDraft(column ? draftFrom(column) : emptyDraft)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    if (!name) return
    const wipLimit = draft.wipLimit ? Number(draft.wipLimit) : null
    setPending(true)
    try {
      const input = {
        name,
        color: draft.color,
        isTerminal: draft.isTerminal,
        wipLimit,
      }
      if (column) {
        await boardsApi.updateColumn(column.id, input)
      } else {
        await boardsApi.createColumn(input)
      }
      onSaved()
      onOpenChange(false)
      toast.success(t("columnSaved"))
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>
            {column ? t("editColumnTitle") : t("createColumnTitle")}
          </SheetTitle>
          <SheetDescription>{t("columnSheetDescription")}</SheetDescription>
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
                <FieldLabel htmlFor="board-column-name">
                  {t("columnNameLabel")}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={pending}
                  id="board-column-name"
                  maxLength={60}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={draft.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="board-column-color">
                  {t("columnColorLabel")}
                </FieldLabel>
                <Select
                  disabled={pending}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, color: value }))
                  }
                  value={draft.color}
                >
                  <SelectTrigger id="board-column-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {columnColors.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          {t(color.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="board-column-wip">
                  {t("wipLimitLabel")}
                </FieldLabel>
                <Input
                  disabled={pending}
                  id="board-column-wip"
                  max={999}
                  min={1}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      wipLimit: event.target.value,
                    }))
                  }
                  placeholder={t("wipLimitPlaceholder")}
                  type="number"
                  value={draft.wipLimit}
                />
                <FieldDescription>{t("wipLimitHint")}</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  checked={draft.isTerminal}
                  disabled={pending}
                  id="board-column-terminal"
                  onCheckedChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      isTerminal: value === true,
                    }))
                  }
                />
                <FieldLabel htmlFor="board-column-terminal">
                  <FieldContent>
                    <FieldTitle>{t("terminalLabel")}</FieldTitle>
                    <FieldDescription>{t("terminalHint")}</FieldDescription>
                  </FieldContent>
                </FieldLabel>
              </Field>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={pending || !draft.name.trim()} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" size={16} />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {t("save")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}
