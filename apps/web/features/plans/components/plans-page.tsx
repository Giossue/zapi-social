"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react"
import {
  Check,
  Ellipsis,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { CardGrid } from "@workspace/ui/components/card-grid"
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
import { Button } from "@workspace/ui/components/button"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableEmptyRow } from "@workspace/ui/components/table-empty-row"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { MetricCard } from "@workspace/ui/components/metric-card"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TablePagination } from "@/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"
import { useFormatter, useTranslations } from "next-intl"

import { planPermissionGroups } from "../fixtures/plans"
import { ApiError, plansApi } from "@workspace/api-client"

import type { AdminPlan, PlanBillingType, PlanStatus } from "../types/plans"

const emptyPlan: AdminPlan = {
  id: "",
  name: "",
  slug: "",
  status: "active",
  featured: false,
  currency: "USD",
  price: 0,
  billingType: "monthly",
  isFree: false,
  isDefaultSignup: false,
  trialDays: 0,
  position: 1,
  description: "",
  subscriberCount: 0,
  permissionIds: ["workspace.view", "publishing.create"],
}

function planInput(plan: AdminPlan) {
  return {
    name: plan.name,
    slug: plan.slug,
    status: plan.status,
    featured: plan.featured,
    currency: plan.currency,
    price: plan.price,
    billingType: plan.billingType,
    isFree: plan.isFree,
    isDefaultSignup: plan.isDefaultSignup,
    trialDays: plan.trialDays,
    position: plan.position,
    description: plan.description,
    permissionIds: [...plan.permissionIds],
  }
}

/** El precio se formatea con el idioma activo; «Gratis» lo pone la vista. */
function planPrice(
  plan: AdminPlan,
  format: ReturnType<typeof useFormatter>,
  freeLabel: string
) {
  if (plan.isFree) return freeLabel
  return format.number(plan.price, {
    currency: plan.currency,
    maximumFractionDigits: 0,
    style: "currency",
  })
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function PermissionGroups({
  disabled,
  selectedIds,
  setSelectedIds,
}: {
  disabled: boolean
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const t = useTranslations("plans")

  function togglePermission(permissionId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, permissionId])]
        : current.filter((id) => id !== permissionId)
    )
  }

  function toggleGroup(permissionIds: readonly string[], checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, ...permissionIds])]
        : current.filter((id) => !permissionIds.includes(id))
    )
  }

  return (
    <FieldSet aria-required="true" disabled={disabled}>
      <FieldLegend className="flex items-center gap-1" variant="label">
        {t("includedPermissions")} <RequiredMark />
      </FieldLegend>
      <FieldDescription>{t("includedPermissionsHint")}</FieldDescription>
      <div className="grid gap-3">
        {planPermissionGroups.map((group) => {
          const permissionIds = group.permissions.map(
            (permission) => permission.id
          )
          const groupChecked = permissionIds.every((permissionId) =>
            selectedIds.includes(permissionId)
          )
          return (
            <Card key={group.id} variant="inset">
              <CardHeader className="border-b">
                <CardTitle>{group.label}</CardTitle>
                <CardAction>
                  <Checkbox
                    aria-label={t("selectGroupPermissions", {
                      group: group.label,
                    })}
                    checked={groupChecked}
                    onCheckedChange={(checked) =>
                      toggleGroup(permissionIds, checked === true)
                    }
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {group.permissions.map((permission) => (
                  <Field
                    data-disabled={disabled || undefined}
                    key={permission.id}
                    orientation="horizontal"
                  >
                    <Checkbox
                      aria-label={permission.label}
                      checked={selectedIds.includes(permission.id)}
                      id={`plan-permission-${permission.id}`}
                      onCheckedChange={(checked) =>
                        togglePermission(permission.id, checked === true)
                      }
                    />
                    <div className="flex flex-col gap-0.5">
                      <FieldLabel htmlFor={`plan-permission-${permission.id}`}>
                        {permission.label}
                      </FieldLabel>
                      <FieldDescription>
                        {permission.description}
                      </FieldDescription>
                    </div>
                  </Field>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </FieldSet>
  )
}

function PlanEditorSheet({
  existingSlugs,
  onOpenChange,
  onSave,
  plan,
}: {
  existingSlugs: readonly string[]
  onOpenChange: (open: boolean) => void
  onSave: (plan: AdminPlan) => Promise<void>
  plan: AdminPlan
}) {
  const t = useTranslations("plans")
  const savingLock = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFree, setIsFree] = useState(plan.isFree)
  const [featured, setFeatured] = useState(plan.featured)
  const [isDefaultSignup, setIsDefaultSignup] = useState(plan.isDefaultSignup)
  const [permissionIds, setPermissionIds] = useState([...plan.permissionIds])
  const [name, setName] = useState(plan.name)
  const [slug, setSlug] = useState(plan.slug)
  const [price, setPrice] = useState(String(plan.price))
  const [trialDays, setTrialDays] = useState(String(plan.trialDays))
  const [position, setPosition] = useState(String(plan.position))
  const isEditing = Boolean(plan.id)
  const SubmitIcon = isEditing ? Check : Plus
  const submitLabel = isEditing ? t("saveChanges") : t("create")
  const formComplete = Boolean(
    name.trim() &&
    slug.trim() &&
    (isFree || price.trim()) &&
    trialDays.trim() &&
    position.trim() &&
    permissionIds.length > 0
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formComplete || savingLock.current) return
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") ?? "").trim()
    const slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
    const price = Number(formData.get("price") ?? 0)
    const trialDays = Number(formData.get("trialDays") ?? 0)
    const position = Number(formData.get("position") ?? 0)

    if (name.length < 2) {
      toast.error(t("nameTooShort"))
      return
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast.error(t("invalidSlug"))
      return
    }
    if (existingSlugs.includes(slug) && slug !== plan.slug) {
      toast.error(t("slugTaken"))
      return
    }
    if (!isFree && (!Number.isFinite(price) || price < 0)) {
      toast.error(t("invalidPrice"))
      return
    }
    if (
      !Number.isInteger(trialDays) ||
      trialDays < 0 ||
      !Number.isInteger(position) ||
      position < 1
    ) {
      toast.error(t("invalidNumbers"))
      return
    }
    if (permissionIds.length === 0) {
      toast.error(t("permissionRequired"))
      return
    }

    if (
      isDefaultSignup &&
      (!isFree || String(formData.get("status")) !== "active")
    ) {
      toast.error(t("defaultPlanRules"))
      return
    }

    savingLock.current = true
    setIsSaving(true)
    try {
      await onSave({
        id: plan.id,
        name,
        slug,
        status: String(formData.get("status")) as PlanStatus,
        featured,
        currency: "USD",
        price: isFree ? 0 : price,
        billingType: String(formData.get("billingType")) as PlanBillingType,
        isFree,
        isDefaultSignup,
        trialDays,
        position,
        description: String(formData.get("description") ?? "").trim(),
        subscriberCount: plan.subscriberCount,
        permissionIds,
      })
    } catch {
      // El error ya se comunica desde el contenedor de la pantalla.
    } finally {
      savingLock.current = false
      setIsSaving(false)
    }
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!isSaving) onOpenChange(open)
      }}
      open
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>
            {isEditing ? t("editTitle", { name: plan.name }) : t("create")}
          </SheetTitle>
          <SheetDescription>
            Configura el precio, disponibilidad y permisos que recibirá este
            plan.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea
          className="min-h-0 flex-1"
          scrollbarClassName="translate-x-6"
          type="always"
        >
          <form
            className="flex flex-col gap-6 px-6 pt-5 pr-12 pb-6"
            noValidate
            onSubmit={submit}
          >
            <FieldGroup className="grid sm:grid-cols-2">
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-name">
                  {t("name")}
                  <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={isSaving}
                  id="plan-name"
                  maxLength={80}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-slug">
                  Slug <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={isSaving}
                  id="plan-slug"
                  maxLength={80}
                  name="slug"
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder={t("slugPlaceholder")}
                  value={slug}
                />
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-status">
                  {t("statusColumn")}
                  <RequiredMark />
                </FieldLabel>
                <Select
                  defaultValue={plan.status}
                  disabled={isSaving}
                  name="status"
                >
                  <SelectTrigger aria-required="true" id="plan-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">
                        {t("status.active")}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {t("status.inactive")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-disabled={isFree || isSaving || undefined}>
                <FieldLabel htmlFor="plan-price">
                  Precio {!isFree ? <RequiredMark /> : null}
                </FieldLabel>
                <Input
                  aria-required={!isFree || undefined}
                  disabled={isFree || isSaving}
                  id="plan-price"
                  min="0"
                  name="price"
                  onChange={(event) => setPrice(event.target.value)}
                  step="0.01"
                  type="number"
                  value={price}
                />
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-billing">
                  {t("billingType")} <RequiredMark />
                </FieldLabel>
                <Select
                  defaultValue={plan.billingType}
                  disabled={isSaving}
                  name="billingType"
                >
                  <SelectTrigger aria-required="true" id="plan-billing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="monthly">
                        {t("billing.monthly")}
                      </SelectItem>
                      <SelectItem value="yearly">
                        {t("billing.yearly")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-trial-days">
                  {t("trialDays")} <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={isSaving}
                  id="plan-trial-days"
                  min="0"
                  name="trialDays"
                  onChange={(event) => setTrialDays(event.target.value)}
                  type="number"
                  value={trialDays}
                />
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-position">
                  {t("position")} <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  disabled={isSaving}
                  id="plan-position"
                  min="1"
                  name="position"
                  onChange={(event) => setPosition(event.target.value)}
                  type="number"
                  value={position}
                />
              </Field>
            </FieldGroup>
            <Field data-disabled={isSaving || undefined}>
              <FieldLabel htmlFor="plan-description">
                {t("description")}
              </FieldLabel>
              <Textarea
                defaultValue={plan.description}
                disabled={isSaving}
                id="plan-description"
                maxLength={500}
                name="description"
                placeholder={t("descriptionPlaceholder")}
              />
            </Field>
            <FieldGroup className="grid sm:grid-cols-3">
              <Field
                data-disabled={isSaving || undefined}
                orientation="horizontal"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <FieldLabel htmlFor="plan-free">{t("freePlan")}</FieldLabel>
                  <FieldDescription>{t("freePlanHint")}</FieldDescription>
                </div>
                <Switch
                  checked={isFree}
                  disabled={isSaving}
                  id="plan-free"
                  onCheckedChange={setIsFree}
                />
              </Field>
              <Field
                data-disabled={isSaving || undefined}
                orientation="horizontal"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <FieldLabel htmlFor="plan-featured">
                    {t("featured")}
                  </FieldLabel>
                  <FieldDescription>{t("featuredHint")}</FieldDescription>
                </div>
                <Switch
                  checked={featured}
                  disabled={isSaving}
                  id="plan-featured"
                  onCheckedChange={setFeatured}
                />
              </Field>
              <Field
                data-disabled={isSaving || undefined}
                orientation="horizontal"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <FieldLabel htmlFor="plan-default">{t("default")}</FieldLabel>
                  <FieldDescription>{t("defaultHint")}</FieldDescription>
                </div>
                <Switch
                  checked={isDefaultSignup}
                  disabled={isSaving}
                  id="plan-default"
                  onCheckedChange={setIsDefaultSignup}
                />
              </Field>
            </FieldGroup>
            <PermissionGroups
              disabled={isSaving}
              selectedIds={permissionIds}
              setSelectedIds={setPermissionIds}
            />
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="brand-secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={!formComplete || isSaving} type="submit">
                {isSaving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SubmitIcon data-icon="inline-start" />
                )}
                {isSaving ? t("saving") : submitLabel}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function DeletePlanDialog({
  onOpenChange,
  onRemove,
  plan,
}: {
  onOpenChange: (open: boolean) => void
  onRemove: () => Promise<void>
  plan: AdminPlan
}) {
  const t = useTranslations("plans")
  const deletingLock = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const hasSubscribers = plan.subscriberCount > 0
  const subscriberLabel = t("subscriberCount", { count: plan.subscriberCount })

  async function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (hasSubscribers || deletingLock.current) return

    deletingLock.current = true
    setIsDeleting(true)
    try {
      await onRemove()
    } finally {
      deletingLock.current = false
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!isDeleting) onOpenChange(open)
      }}
      open
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasSubscribers
              ? t("deleteBlockedTitle", { plan: plan.name })
              : t("deleteConfirmTitle", { plan: plan.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasSubscribers
              ? t("deleteBlockedDescription", { subscribers: subscriberLabel })
              : t("deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} variant="brand-secondary">
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={hasSubscribers || isDeleting}
            onClick={confirmDelete}
            variant="destructive"
          >
            {isDeleting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            {isDeleting ? t("deleting") : t("deleteAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function PlansPage() {
  const t = useTranslations("plans")
  const format = useFormatter()
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | PlanStatus>("all")
  const [billingFilter, setBillingFilter] = useState<"all" | PlanBillingType>(
    "all"
  )
  const [featuredFilter, setFeaturedFilter] = useState<
    "all" | "featured" | "standard"
  >("all")
  const [pageIndex, setPageIndex] = useState(0)
  const pageSize = 10
  const [editor, setEditor] = useState<AdminPlan | "create" | null>(null)
  const [planToDelete, setPlanToDelete] = useState<AdminPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hasPermission, setHasPermission] = useState(true)

  const loadPlans = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const response = await plansApi.list({
        q: query.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        billingType: billingFilter === "all" ? undefined : billingFilter,
        featured:
          featuredFilter === "all" ? undefined : featuredFilter === "featured",
      })
      setPlans(response.plans)
      setHasPermission(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setHasPermission(false)
        return
      }
      if (error instanceof ApiError && error.status === 401) {
        toast.error(t("sessionExpired"))
      } else {
        console.error("Plans request failed", error)
        toast.error(t("loadFailed"))
      }
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [billingFilter, featuredFilter, query, statusFilter, t])

  useEffect(() => {
    // El temporizador saca el primer `setState` del cuerpo del efecto y cancela
    // la carga anterior cuando el efecto se repite.
    const timer = setTimeout(() => void loadPlans(), 0)
    return () => clearTimeout(timer)
  }, [loadPlans])

  function resetFilters() {
    setQuery("")
    setStatusFilter("all")
    setBillingFilter("all")
    setFeaturedFilter("all")
    setPageIndex(0)
  }

  async function savePlan(plan: AdminPlan) {
    try {
      if (plan.id) {
        await plansApi.update(plan.id, planInput(plan))
        toast.success(t("updated"))
      } else {
        await plansApi.create(planInput(plan))
        toast.success(t("created"))
      }
      await loadPlans()
      setEditor(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t("conflict"))
      } else if (error instanceof ApiError && error.status === 400) {
        toast.error(t("validationFailed"))
      } else {
        console.error("Plan save failed", error)
        toast.error(t("saveFailed"))
      }
      throw error
    }
  }

  async function removePlan() {
    if (!planToDelete) return
    try {
      await plansApi.remove(planToDelete.id)
      toast.success(t("deleted"))
      await loadPlans()
      setPlanToDelete(null)
    } catch (error) {
      console.error("Plan removal failed", error)
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t("hasSubscribers"))
      } else {
        toast.error(t("deleteFailed"))
      }
    }
  }

  const planForEditor = editor === "create" ? emptyPlan : editor
  const hasActiveFilters = Boolean(
    query ||
    statusFilter !== "all" ||
    billingFilter !== "all" ||
    featuredFilter !== "all"
  )
  const pageCount = Math.max(1, Math.ceil(plans.length / pageSize))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const paginatedPlans = plans.slice(
    currentPageIndex * pageSize,
    (currentPageIndex + 1) * pageSize
  )
  const rangeStart = plans.length === 0 ? 0 : currentPageIndex * pageSize + 1
  const rangeEnd = Math.min((currentPageIndex + 1) * pageSize, plans.length)
  const activePlans = plans.filter((plan) => plan.status === "active").length
  const subscriberCount = plans.reduce(
    (total, plan) => total + plan.subscriberCount,
    0
  )
  const featuredPlans = plans.filter((plan) => plan.featured).length

  if (!hasPermission) {
    return (
      <Card variant="subtle">
        <EmptyState
          description={t("forbiddenDescription")}
          icon={Users}
          title={t("forbiddenTitle")}
        />
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card variant="subtle">
        <EmptyState
          action={
            <RetryButton
              onClick={() => void loadPlans()}
              variant="brand-secondary"
            />
          }
          description={t("loadFailedDescription")}
          icon={Search}
          title={t("loadFailedTitle")}
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura el catálogo, precios, permisos y disponibilidad de cada
          plan.
        </p>
      </header>
      {isLoading ? (
        <PageLoading className="min-h-80" />
      ) : (
        <>
          <CardGrid>
            {[
              {
                label: t("metrics.plans"),
                value: plans.length.toLocaleString("es"),
                description: t("metrics.plansDescription"),
                icon: WalletCards,
              },
              {
                label: t("metrics.active"),
                value: activePlans.toLocaleString("es"),
                description: t("metrics.activeDescription"),
                icon: Check,
              },
              {
                label: t("metrics.subscribers"),
                value: subscriberCount.toLocaleString("es"),
                description: t("metrics.subscribersDescription"),
                icon: Users,
              },
              {
                label: t("metrics.featured"),
                value: featuredPlans.toLocaleString("es"),
                description: t("metrics.featuredDescription"),
                icon: Sparkles,
              },
            ].map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </CardGrid>

          <Card variant="subtle">
            <DataTableHeader
              action={
                <Button
                  className="hidden sm:inline-flex"
                  onClick={() => setEditor("create")}
                  size="sm"
                >
                  <Plus data-icon="inline-start" />
                  {t("create")}
                </Button>
              }
              search={{
                ariaLabel: t("searchLabel"),
                onChange: (value) => {
                  setQuery(value)
                  setPageIndex(0)
                },
                placeholder: t("searchPlaceholder"),
                value: query,
              }}
            />
            <CardContent className="flex flex-col gap-4 px-0">
              <DataTableToolbar>
                <DataTableFilter
                  ariaLabel={t("filterStatus")}
                  label={t("statusColumn")}
                  onValueChange={(value) => {
                    setStatusFilter(value as "all" | PlanStatus)
                    setPageIndex(0)
                  }}
                  options={[
                    { label: t("filter.allStatuses"), value: "all" },
                    { label: t("filter.active"), value: "active" },
                    { label: t("filter.inactive"), value: "inactive" },
                  ]}
                  value={statusFilter}
                />
                <DataTableFilter
                  ariaLabel={t("filterBilling")}
                  label={t("billingColumn")}
                  onValueChange={(value) => {
                    setBillingFilter(value as "all" | PlanBillingType)
                    setPageIndex(0)
                  }}
                  options={[
                    { label: t("filter.allBilling"), value: "all" },
                    { label: t("billing.monthly"), value: "monthly" },
                    { label: t("billing.yearly"), value: "yearly" },
                  ]}
                  value={billingFilter}
                />
                <DataTableFilter
                  ariaLabel={t("filterFeatured")}
                  label={t("visibility")}
                  onValueChange={(value) => {
                    setFeaturedFilter(value as "all" | "featured" | "standard")
                    setPageIndex(0)
                  }}
                  options={[
                    { label: t("filter.allPlans"), value: "all" },
                    { label: t("filter.featured"), value: "featured" },
                    { label: t("filter.standard"), value: "standard" },
                  ]}
                  value={featuredFilter}
                />
              </DataTableToolbar>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("plan")}</TableHead>
                    <TableHead>{t("price")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("billingColumn")}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("trialing")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("subscribers")}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t("permissions")}
                    </TableHead>
                    <TableHead>{t("statusColumn")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="grid gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{plan.name}</span>
                            {plan.featured ? (
                              <Badge variant="warning">
                                <Sparkles aria-hidden="true" />
                                {t("featured")}
                              </Badge>
                            ) : null}
                            {plan.isDefaultSignup ? (
                              <Badge variant="neutral">{t("default")}</Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            /{plan.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {planPrice(plan, format, t("free"))}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="grid gap-0.5">
                          <span>
                            {plan.isFree
                              ? "—"
                              : t(`billing.${plan.billingType}`)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Orden #{plan.position}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {plan.trialDays > 0
                          ? t("trialDaysValue", { count: plan.trialDays })
                          : t("noTrial")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {plan.subscriberCount.toLocaleString("es")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {plan.permissionIds.length}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            plan.status === "active" ? "success" : "neutral"
                          }
                        >
                          {t(`status.${plan.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={t("rowActions", { plan: plan.name })}
                              size="icon-sm"
                              variant="brand-secondary"
                            >
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" size="compact">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => setEditor(plan)}
                                size="compact"
                              >
                                <Pencil />
                                {t("editPlan")}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => setPlanToDelete(plan)}
                                size="compact"
                                variant="destructive"
                              >
                                <Trash2 />
                                {t("deleteAction")}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 ? (
                    <TableEmptyRow
                      action={
                        hasActiveFilters ? (
                          <Button
                            onClick={resetFilters}
                            variant="brand-secondary"
                          >
                            {t("resetFilters")}
                          </Button>
                        ) : undefined
                      }
                      colSpan={8}
                      description={
                        hasActiveFilters
                          ? t("emptyFilteredDescription")
                          : t("emptyDescription")
                      }
                      title={
                        hasActiveFilters ? t("noMatches") : t("emptyTitle")
                      }
                    />
                  ) : null}
                </TableBody>
              </Table>
              <TablePagination
                canGoNext={currentPageIndex < pageCount - 1}
                canGoPrevious={currentPageIndex > 0}
                itemLabel={t("itemLabel")}
                onNextPage={() =>
                  setPageIndex((current) =>
                    Math.min(current + 1, pageCount - 1)
                  )
                }
                onPreviousPage={() =>
                  setPageIndex((current) => Math.max(current - 1, 0))
                }
                rangeEnd={rangeEnd}
                rangeStart={rangeStart}
                total={plans.length}
              />
            </CardContent>
          </Card>

          <FloatingActionButton
            label={t("create")}
            onClick={() => setEditor("create")}
          />
        </>
      )}
      {planForEditor ? (
        <PlanEditorSheet
          existingSlugs={plans.map((plan) => plan.slug)}
          key={planForEditor.id || "create"}
          onOpenChange={(open) => !open && setEditor(null)}
          onSave={savePlan}
          plan={planForEditor}
        />
      ) : null}
      {planToDelete ? (
        <DeletePlanDialog
          onOpenChange={(open) => !open && setPlanToDelete(null)}
          onRemove={removePlan}
          plan={planToDelete}
        />
      ) : null}
    </div>
  )
}
