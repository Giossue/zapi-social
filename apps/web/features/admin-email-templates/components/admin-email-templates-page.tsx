"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { CircleAlert, Pencil, RotateCcw, Save, ShieldX, X } from "lucide-react"

import {
  adminEmailTemplatesApi,
  ApiError,
  i18nApi,
} from "@workspace/api-client"
import { DEFAULT_EMAIL_TEMPLATE_LOCALE } from "@workspace/contracts"
import type {
  AdminEmailTemplate,
  AdminEmailTemplateCopy,
  AdminEmailTemplatesResponse,
} from "@workspace/contracts"
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
import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useTranslations } from "next-intl"

const pageSize = 10

type FormValues = {
  subject: string
  title: string
  body: string
  actionLabel: string
  notice: string
  isActive: boolean
}

function toForm(copy: AdminEmailTemplateCopy): FormValues {
  return {
    subject: copy.subject,
    title: copy.title,
    body: copy.body,
    actionLabel: copy.actionLabel ?? "",
    notice: copy.notice ?? "",
    isActive: copy.isActive,
  }
}

function copyFor(
  template: AdminEmailTemplate,
  locale: string
): AdminEmailTemplateCopy {
  if (locale === DEFAULT_EMAIL_TEMPLATE_LOCALE) return template.defaultCopy
  return (
    template.overrides.find((copy) => copy.locale === locale) ??
    template.defaultCopy
  )
}

function TemplateSheet({
  languages,
  locale,
  onLocaleChange,
  onOpenChange,
  onSubmit,
  open,
  pending,
  template,
}: {
  languages: { code: string; label: string }[]
  locale: string
  onLocaleChange: (locale: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (values: FormValues) => Promise<boolean>
  open: boolean
  pending: boolean
  template: AdminEmailTemplate | null
}) {
  const t = useTranslations("adminEmailTemplates")
  const [values, setValues] = useState<FormValues>({
    subject: "",
    title: "",
    body: "",
    actionLabel: "",
    notice: "",
    isActive: true,
  })

  const formKey = open && template ? `${template.key}:${locale}` : null
  const [lastFormKey, setLastFormKey] = useState(formKey)

  if (formKey !== lastFormKey) {
    setLastFormKey(formKey)
    if (open && template) setValues(toForm(copyFor(template, locale)))
  }

  const canSubmit = Boolean(
    values.subject.trim() && values.title.trim() && values.body.trim()
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      toast.error(t("missingFields"))
      return
    }
    const saved = await onSubmit(values)
    if (saved) onOpenChange(false)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{template?.name ?? t("template")}</SheetTitle>
          <SheetDescription>
            {t("sheetDescription", {
              description: template?.description ?? "",
            })}
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <Field>
              <FieldLabel htmlFor="template-locale">
                {t("localeLabel")}
              </FieldLabel>
              <Select onValueChange={onLocaleChange} value={locale}>
                <SelectTrigger id="template-locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_EMAIL_TEMPLATE_LOCALE}>
                    {t("defaultCopy")}
                  </SelectItem>
                  {languages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.label}
                      {template?.overrides.some(
                        (copy) => copy.locale === language.code
                      )
                        ? ` · ${t("status.customized")}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {locale === DEFAULT_EMAIL_TEMPLATE_LOCALE
                  ? t("defaultCopyHint")
                  : t("overrideHint")}
              </FieldDescription>
            </Field>
            {template?.variables.length ? (
              <Card variant="inset">
                <CardContent className="flex flex-col gap-2 py-3">
                  <p className="text-sm font-medium">{t("variables")}</p>
                  <ul className="flex flex-col gap-1">
                    {template.variables.map((variable) => (
                      <li
                        className="text-sm text-muted-foreground"
                        key={variable.token}
                      >
                        <code className="font-mono text-xs">
                          {variable.token}
                        </code>{" "}
                        · {variable.description}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="template-subject">
                  {t("subject")}{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="template-subject"
                  maxLength={250}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  value={values.subject}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-title">
                  Título{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="template-title"
                  maxLength={250}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={values.title}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-body">
                  Mensaje{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> {t("required")}</span>
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="template-body"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  rows={4}
                  value={values.body}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="template-action">
                  {t("buttonText")}
                </FieldLabel>
                <Input
                  id="template-action"
                  maxLength={120}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      actionLabel: event.target.value,
                    }))
                  }
                  value={values.actionLabel}
                />
                <FieldDescription>{t("buttonUrlHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="template-notice">{t("notice")}</FieldLabel>
                <Textarea
                  id="template-notice"
                  maxLength={2000}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      notice: event.target.value,
                    }))
                  }
                  rows={3}
                  value={values.notice}
                />
              </Field>
              <Field orientation="horizontal">
                <Switch
                  checked={values.isActive}
                  id="template-active"
                  onCheckedChange={(checked) =>
                    setValues((current) => ({ ...current, isActive: checked }))
                  }
                />
                <FieldLabel htmlFor="template-active">
                  <FieldContent>
                    <FieldTitle>{t("activeTitle")}</FieldTitle>
                    <FieldDescription>{t("activeHint")}</FieldDescription>
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
            <Button disabled={!canSubmit || pending} type="submit">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {t("save")}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AdminEmailTemplatesPage() {
  const t = useTranslations("adminEmailTemplates")
  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "customized" | "default"
  >("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [editing, setEditing] = useState<AdminEmailTemplate | null>(null)
  const [editingLocale, setEditingLocale] = useState<string>(
    DEFAULT_EMAIL_TEMPLATE_LOCALE
  )
  const [languages, setLanguages] = useState<{ code: string; label: string }[]>(
    []
  )

  useEffect(() => {
    void i18nApi
      .languages()
      .then((response) =>
        setLanguages(
          response.languages.map((language) => ({
            code: language.code,
            label: language.nativeName || language.name,
          }))
        )
      )
      .catch(() => setLanguages([]))
  }, [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [resetting, setResetting] = useState<AdminEmailTemplate | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await adminEmailTemplatesApi.list()
      setTemplates(response.templates)
      setForbidden(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      console.error("Email templates request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  if (forbidden) {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (isLoading && !templates.length && !loadError) {
    return <PageLoading aria-label={t("loading")} />
  }

  if (loadError) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredTemplates = templates.filter((template) => {
    const matchesQuery =
      !normalizedQuery ||
      template.name.toLowerCase().includes(normalizedQuery) ||
      [template.defaultCopy, ...template.overrides].some((copy) =>
        copy.subject.toLowerCase().includes(normalizedQuery)
      )
    const customized =
      template.defaultCopy.customized || template.overrides.length > 0
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "customized" ? customized : !customized)
    return matchesQuery && matchesStatus
  })
  const hasFilters = Boolean(query || statusFilter !== "all")
  const pageCount = Math.max(1, Math.ceil(filteredTemplates.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const visibleTemplates = filteredTemplates.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )
  const rangeStart = filteredTemplates.length
    ? (safePage - 1) * pageSize + 1
    : 0
  const rangeEnd = filteredTemplates.length
    ? rangeStart + visibleTemplates.length - 1
    : 0

  function clearFilters() {
    setQuery("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Card variant="subtle">
          <DataTableHeader
            search={{
              ariaLabel: t("searchLabel"),
              onChange: (value) => {
                setQuery(value)
                setCurrentPage(1)
              },
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="flex flex-col gap-4 px-0">
            <DataTableToolbar
              actions={
                hasFilters ? (
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
                  setStatusFilter(value as "all" | "customized" | "default")
                  setCurrentPage(1)
                }}
                options={[
                  { label: t("all"), value: "all" },
                  { label: t("status.customized"), value: "customized" },
                  { label: t("status.default"), value: "default" },
                ]}
                value={statusFilter}
              />
            </DataTableToolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("subjectColumn")}
                  </TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTemplates.length ? (
                  visibleTemplates.map((template) => (
                    <TableRow key={template.key}>
                      <TableCell>
                        <div className="flex min-w-48 flex-col">
                          <span className="font-medium">{template.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {template.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {template.defaultCopy.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant={
                              template.defaultCopy.customized
                                ? "info"
                                : "secondary"
                            }
                          >
                            {t("defaultCopy")} ·{" "}
                            {template.defaultCopy.customized
                              ? t("status.customized")
                              : t("status.default")}
                          </Badge>
                          {template.overrides.length ? (
                            <Badge variant="info">
                              {t("overrideCount", {
                                count: template.overrides.length,
                              })}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => {
                              setEditing(template)
                              setEditingLocale(DEFAULT_EMAIL_TEMPLATE_LOCALE)
                              setSheetOpen(true)
                            }}
                            size="sm"
                            variant="brand-secondary"
                          >
                            <Pencil data-icon="inline-start" /> {t("edit")}
                          </Button>
                          {template.defaultCopy.customized ||
                          template.overrides.length ? (
                            <Button
                              aria-label={t("resetAria", {
                                name: template.name,
                              })}
                              onClick={() => setResetting(template)}
                              size="icon-sm"
                              variant="brand-secondary"
                            >
                              <RotateCcw />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyRow
                    action={
                      hasFilters ? (
                        <Button onClick={clearFilters} variant="outline">
                          {t("clearFilters")}
                        </Button>
                      ) : null
                    }
                    colSpan={4}
                    description={
                      hasFilters
                        ? t("emptyFilteredDescription")
                        : t("emptyDescription")
                    }
                    title={hasFilters ? t("noMatches") : t("emptyTitle")}
                  />
                )}
              </TableBody>
            </Table>
            <TablePagination
              canGoNext={safePage < pageCount}
              canGoPrevious={safePage > 1}
              itemLabel={t("itemLabel")}
              onNextPage={() =>
                setCurrentPage((current) => Math.min(current + 1, pageCount))
              }
              onPreviousPage={() =>
                setCurrentPage((current) => Math.max(current - 1, 1))
              }
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              total={filteredTemplates.length}
            />
          </CardContent>
        </Card>
      </div>
      <TemplateSheet
        languages={languages}
        locale={editingLocale}
        onLocaleChange={setEditingLocale}
        onOpenChange={setSheetOpen}
        onSubmit={async (values) => {
          if (!editing) return false
          setPending(true)
          try {
            const response = await adminEmailTemplatesApi.update(editing.key, {
              locale: editingLocale,
              subject: values.subject.trim(),
              title: values.title.trim(),
              body: values.body.trim(),
              actionLabel: values.actionLabel.trim() || undefined,
              notice: values.notice.trim() || undefined,
              isActive: values.isActive,
            })
            setTemplates(response.templates)
            toast.success(t("updated"))
            return true
          } catch (error) {
            console.error("Email template save failed", error)
            toast.error(t("saveFailed"))
            return false
          } finally {
            setPending(false)
          }
        }}
        open={sheetOpen}
        pending={pending}
        template={editing}
      />
      <AlertDialog
        onOpenChange={(open) => (open ? null : setResetting(null))}
        open={Boolean(resetting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("resetDescription", { name: resetting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                const target = resetting
                if (!target) return
                setPending(true)
                const customized = [
                  target.defaultCopy,
                  ...target.overrides,
                ].filter((copy) => copy.customized)
                void customized
                  .reduce<Promise<AdminEmailTemplatesResponse | null>>(
                    (chain, copy) =>
                      chain.then(() =>
                        adminEmailTemplatesApi.reset(target.key, {
                          locale: copy.locale,
                        })
                      ),
                    Promise.resolve<AdminEmailTemplatesResponse | null>(null)
                  )
                  .then((response) => {
                    if (response) setTemplates(response.templates)
                    setResetting(null)
                    toast.success(t("reset"))
                  })
                  .catch((error: unknown) => {
                    console.error("Email template reset failed", error)
                    toast.error(t("resetFailed"))
                  })
                  .finally(() => setPending(false))
              }}
            >
              <RotateCcw data-icon="inline-start" /> {t("reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
