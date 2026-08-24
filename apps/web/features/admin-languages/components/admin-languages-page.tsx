"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  CircleAlert,
  Languages,
  MoreVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react"

import { ApiError, adminLanguagesApi } from "@workspace/api-client"
import type {
  AdminPlatformLanguage,
  AdminPlatformLanguagesResponse,
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
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { DataTableHeader } from "@workspace/ui/components/data-table-controls"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Progress } from "@workspace/ui/components/progress"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { ShieldX } from "lucide-react"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { PageLoading } from "@/components/page-loading"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { loginPath } from "@/features/identity/login-redirect"

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined
}

export function AdminLanguagesPage() {
  const t = useTranslations("adminLanguages")
  const router = useRouter()
  const apiErrorMessage = useApiErrorMessage()

  const [data, setData] = useState<AdminPlatformLanguagesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState<AdminPlatformLanguage | null>(null)
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadFailed(false)
    try {
      setData(await adminLanguagesApi.list())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPath())
        return
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return
      }
      setLoadFailed(true)
      toast.error(apiErrorMessage(errorCode(error)))
    } finally {
      setIsLoading(false)
    }
  }, [apiErrorMessage, router])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  async function mutate(
    code: string,
    action: () => Promise<AdminPlatformLanguagesResponse>,
    success: string
  ) {
    setPendingCode(code)
    try {
      setData(await action())
      toast.success(success)
      return true
    } catch (error) {
      toast.error(apiErrorMessage(errorCode(error)))
      return false
    } finally {
      setPendingCode(null)
    }
  }

  async function addLanguage(code: string) {
    setAddOpen(false)
    await mutate(code, () => adminLanguagesApi.create({ code }), t("created"))
  }

  async function toggleActive(language: AdminPlatformLanguage) {
    await mutate(
      language.code,
      () =>
        adminLanguagesApi.update(language.code, {
          isActive: !language.isActive,
        }),
      language.isActive ? t("deactivated") : t("activated")
    )
  }

  async function makeDefault(language: AdminPlatformLanguage) {
    await mutate(
      language.code,
      () => adminLanguagesApi.update(language.code, { isDefault: true }),
      t("defaultChanged")
    )
  }

  async function confirmDelete() {
    if (!deleting) return
    const removed = await mutate(
      deleting.code,
      () => adminLanguagesApi.remove(deleting.code),
      t("deleted")
    )
    if (removed) setDeleting(null)
  }

  if (forbidden) {
    return (
      <EmptyState
        description={t("forbiddenDescription")}
        icon={ShieldX}
        title={t("forbiddenTitle")}
      />
    )
  }

  if (isLoading && !data) return <PageLoading aria-label={t("loading")} />

  if (loadFailed && !data) {
    return (
      <EmptyState
        action={<RetryButton onClick={() => void load()} />}
        description={t("loadFailedDescription")}
        icon={CircleAlert}
        title={t("loadFailedTitle")}
      />
    )
  }

  const languages = data?.languages ?? []
  const catalog = data?.catalog ?? []

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollectionHeader
          description={t("pageDescription")}
          title={t("pageTitle")}
        />
        <Card variant="subtle">
          <DataTableHeader
            action={
              <Button onClick={() => setAddOpen(true)} size="sm" type="button">
                <Plus data-icon="inline-start" />
                {t("addLanguage")}
              </Button>
            }
            search={{
              ariaLabel: t("searchLabel"),
              onChange: setQuery,
              placeholder: t("searchPlaceholder"),
              value: query,
            }}
          />
          <CardContent className="px-0">
            {languages.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("languageColumn")}</TableHead>
                    <TableHead className="max-lg:hidden">
                      {t("directionColumn")}
                    </TableHead>
                    <TableHead className="max-md:hidden">
                      {t("progressColumn")}
                    </TableHead>
                    <TableHead>{t("statusColumn")}</TableHead>
                    <TableHead>{t("activeColumn")}</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">{t("actionsColumn")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {languages
                    .filter((language) => {
                      const needle = query.trim().toLowerCase()
                      if (!needle) return true
                      return (
                        language.name.toLowerCase().includes(needle) ||
                        language.nativeName.toLowerCase().includes(needle) ||
                        language.code.toLowerCase().includes(needle)
                      )
                    })
                    .map((language) => (
                      <TableRow key={language.code}>
                        <TableCell>
                          <div className="grid gap-0.5">
                            <span className="font-medium">{language.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {language.nativeName} · {language.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-lg:hidden">
                          {language.direction === "rtl" ? t("rtl") : t("ltr")}
                        </TableCell>
                        <TableCell className="max-md:hidden">
                          <div className="flex min-w-32 items-center gap-2">
                            <Progress
                              className="w-24"
                              value={
                                language.total
                                  ? (language.translated / language.total) * 100
                                  : 0
                              }
                            />
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {t("progressValue", {
                                translated: language.translated,
                                total: language.total,
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {language.isDefault ? (
                              <Badge variant="info">{t("default")}</Badge>
                            ) : null}
                            {language.isBase ? (
                              <Badge variant="neutral">{t("base")}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            aria-label={t("activeSwitch", {
                              name: language.name,
                            })}
                            checked={language.isActive}
                            disabled={
                              language.isDefault ||
                              pendingCode === language.code
                            }
                            onCheckedChange={() => void toggleActive(language)}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={t("rowActions", {
                                  name: language.name,
                                })}
                                disabled={pendingCode === language.code}
                                size="icon-sm"
                                variant="brand-secondary"
                              >
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/admin/languages/${language.code}`}
                                >
                                  <Pencil />
                                  {t("editTranslations")}
                                </Link>
                              </DropdownMenuItem>
                              {language.isDefault ? null : (
                                <DropdownMenuItem
                                  onClick={() => void makeDefault(language)}
                                >
                                  <Star />
                                  {t("makeDefault")}
                                </DropdownMenuItem>
                              )}
                              {language.isBase || language.isDefault ? null : (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleting(language)}
                                    variant="destructive"
                                  >
                                    <Trash2 />
                                    {t("delete")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6">
                <EmptyState
                  description={t("emptyDescription")}
                  icon={Languages}
                  title={t("emptyTitle")}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent className="p-0 sm:max-w-md">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("addLanguage")}</DialogTitle>
            <DialogDescription>{t("addLanguageHint")}</DialogDescription>
          </DialogHeader>
          <Command className="rounded-none bg-transparent">
            <CommandInput placeholder={t("catalogSearchPlaceholder")} />
            <CommandList className="max-h-72">
              <CommandEmpty>{t("catalogEmpty")}</CommandEmpty>
              <CommandGroup>
                {catalog.map((entry) => (
                  <CommandItem
                    key={entry.code}
                    onSelect={() => void addLanguage(entry.code)}
                    value={`${entry.name} ${entry.nativeName} ${entry.code}`}
                  >
                    <span className="flex-1">{entry.name}</span>
                    <span className="text-muted-foreground">
                      {entry.nativeName} · {entry.code}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        open={Boolean(deleting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: deleting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
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
