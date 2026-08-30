"use client"

import { useMemo, useState, type FormEvent } from "react"
import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { TablePagination } from "@/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"
import { useTranslations } from "next-intl"

export type SupportCatalogItem = {
  id: string
  name: string
  isActive: boolean
}

export type SupportCatalogCopy = {
  createLabel: string
  emptyDescription: string
  emptyTitle: string
  itemLabel: string
  searchPlaceholder: string
  sheetDescription: string
}

const pageSize = 10

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function CatalogSheet({
  copy,
  editing,
  onOpenChange,
  onSave,
  open,
}: {
  copy: SupportCatalogCopy
  editing: SupportCatalogItem | null
  onOpenChange: (open: boolean) => void
  onSave: (values: { name: string; isActive: boolean }) => void
  open: boolean
}) {
  const t = useTranslations("adminSupport")
  const [name, setName] = useState(editing?.name ?? "")
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)
  const complete = Boolean(name.trim())

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete) {
      toast.error(t("missingFields"))
      return
    }
    onSave({ name: name.trim(), isActive })
    onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>
            {editing ? t("edit", { name: editing.name }) : copy.createLabel}
          </SheetTitle>
          <SheetDescription>{copy.sheetDescription}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="catalog-name">
                  {t("name")} <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="catalog-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </Field>
              <Field orientation="horizontal">
                <Switch
                  checked={isActive}
                  id="catalog-active"
                  onCheckedChange={setIsActive}
                />
                <FieldLabel htmlFor="catalog-active">
                  <FieldContent>
                    <FieldTitle>{t("active")}</FieldTitle>
                    <FieldDescription>
                      {t("activeDescription")}
                    </FieldDescription>
                  </FieldContent>
                </FieldLabel>
              </Field>
            </FieldGroup>
          </div>
          <SheetActions>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            <Button disabled={!complete} type="submit">
              <Plus data-icon="inline-start" /> {t("save")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function SupportCatalogPanel({
  copy,
  items,
  onChange,
}: {
  copy: SupportCatalogCopy
  items: readonly SupportCatalogItem[]
  onChange: (items: SupportCatalogItem[]) => void
}) {
  const t = useTranslations("adminSupport")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<SupportCatalogItem | null>(null)
  const [toDelete, setToDelete] = useState<SupportCatalogItem | null>(null)

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es")
    return items.filter(
      (item) =>
        (!term || item.name.toLocaleLowerCase("es").includes(term)) &&
        (status === "all" ||
          (status === "active" ? item.isActive : !item.isActive))
    )
  }, [items, query, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const hasFilters = Boolean(query || status !== "all")

  function clearFilters() {
    setQuery("")
    setStatus("all")
    setPage(1)
  }

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function save(values: { name: string; isActive: boolean }) {
    if (editing) {
      onChange(
        items.map((item) =>
          item.id === editing.id ? { ...item, ...values } : item
        )
      )
      toast.success(t("saved"))
      return
    }
    onChange([
      { id: `local-${copy.itemLabel}-${items.length + 1}`, ...values },
      ...items,
    ])
    setPage(1)
    toast.success(t("recordCreated"))
  }

  function remove(item: SupportCatalogItem) {
    onChange(items.filter((current) => current.id !== item.id))
    setToDelete(null)
    toast.success(t("recordDeleted"))
  }

  return (
    <>
      <Card variant="subtle">
        <DataTableHeader
          action={
            <Button
              className="hidden sm:inline-flex"
              onClick={openCreate}
              size="sm"
              type="button"
            >
              <Plus data-icon="inline-start" /> {copy.createLabel}
            </Button>
          }
          search={{
            ariaLabel: t("searchCatalog", { items: copy.itemLabel }),
            onChange: (value) => {
              setQuery(value)
              setPage(1)
            },
            placeholder: copy.searchPlaceholder,
            value: query,
          }}
        />
        <CardContent className="flex flex-col gap-4 px-0">
          <DataTableToolbar
            actions={
              status !== "all" ? (
                <Button
                  onClick={clearFilters}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <X /> {t("clear")}
                </Button>
              ) : undefined
            }
          >
            <DataTableFilter
              ariaLabel={t("filterStatus")}
              label={t("statusColumn")}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              options={[
                { label: t("all"), value: "all" },
                { label: t("filter.active"), value: "active" },
                { label: t("filter.inactive"), value: "inactive" },
              ]}
              value={status}
            />
          </DataTableToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length ? (
                visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "success" : "neutral"}>
                        {item.isActive
                          ? t("catalogStatus.active")
                          : t("catalogStatus.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={t("openActions", { name: item.name })}
                            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                            size="icon-sm"
                            variant="brand-secondary"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" size="compact">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(item)
                              setSheetOpen(true)
                            }}
                            size="compact"
                          >
                            <Pencil />
                            {t("editAction")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setToDelete(item)}
                            size="compact"
                            variant="destructive"
                          >
                            <Trash2 />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmptyRow
                  action={
                    hasFilters ? (
                      <Button onClick={clearFilters} variant="outline">
                        {t("resetFilters")}
                      </Button>
                    ) : null
                  }
                  colSpan={3}
                  description={
                    hasFilters
                      ? t("emptyFilteredDescription")
                      : copy.emptyDescription
                  }
                  title={hasFilters ? t("noMatches") : copy.emptyTitle}
                />
              )}
            </TableBody>
          </Table>
          <TablePagination
            canGoNext={safePage < pageCount}
            canGoPrevious={safePage > 1}
            itemLabel={copy.itemLabel}
            onNextPage={() =>
              setPage((current) => Math.min(current + 1, pageCount))
            }
            onPreviousPage={() =>
              setPage((current) => Math.max(current - 1, 1))
            }
            rangeEnd={
              filtered.length ? (safePage - 1) * pageSize + visible.length : 0
            }
            rangeStart={filtered.length ? (safePage - 1) * pageSize + 1 : 0}
            total={filtered.length}
          />
        </CardContent>
      </Card>
      <FloatingActionButton label={copy.createLabel} onClick={openCreate} />

      <CatalogSheet
        copy={copy}
        editing={editing}
        key={editing?.id ?? (sheetOpen ? "new" : "closed")}
        onOpenChange={setSheetOpen}
        onSave={save}
        open={sheetOpen}
      />

      <AlertDialog
        onOpenChange={(open) => !open && setToDelete(null)}
        open={Boolean(toDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { name: toDelete?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (toDelete) remove(toDelete)
              }}
              variant="destructive"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
