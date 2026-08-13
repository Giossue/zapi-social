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
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"
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
import { PageLoading } from "@workspace/ui/components/page-loading"
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
import { TablePagination } from "@workspace/ui/components/table-pagination"
import { toast } from "@workspace/ui/components/toast"

import { planPermissionGroups } from "../fixtures/plans"
import { ApiError, plansApi } from "@workspace/api-client"

import type { AdminPlan, PlanBillingType, PlanStatus } from "../types/plans"

const billingLabels: Record<PlanBillingType, string> = {
  monthly: "Mensual",
  yearly: "Anual",
}

const statusLabels: Record<PlanStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
}

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

function formatPrice(plan: AdminPlan) {
  if (plan.isFree) return "Gratis"

  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.price)
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
        Permisos incluidos <RequiredMark />
      </FieldLegend>
      <FieldDescription>
        Selecciona al menos una capacidad para los miembros con este plan.
      </FieldDescription>
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
                    aria-label={`Seleccionar todos los permisos de ${group.label}`}
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
  const submitLabel = isEditing ? "Guardar cambios" : "Crear plan"
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
      toast.error("El nombre del plan debe tener al menos 2 caracteres.")
      return
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast.error("El slug usa minúsculas, números y guiones, sin espacios.")
      return
    }
    if (existingSlugs.includes(slug) && slug !== plan.slug) {
      toast.error("Ya existe un plan con este slug.")
      return
    }
    if (!isFree && (!Number.isFinite(price) || price < 0)) {
      toast.error("Indica un precio válido de cero o mayor.")
      return
    }
    if (
      !Number.isInteger(trialDays) ||
      trialDays < 0 ||
      !Number.isInteger(position) ||
      position < 1
    ) {
      toast.error("Los días de prueba y la posición deben ser números válidos.")
      return
    }
    if (permissionIds.length === 0) {
      toast.error("Selecciona al menos un permiso para el plan.")
      return
    }

    if (
      isDefaultSignup &&
      (!isFree || String(formData.get("status")) !== "active")
    ) {
      toast.error("El plan predeterminado debe estar activo y ser gratuito.")
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
        currency: String(formData.get("currency")) as AdminPlan["currency"],
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
            {isEditing ? `Editar ${plan.name}` : "Crear plan"}
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
                  Nombre <RequiredMark />
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
                  placeholder="mi-plan"
                  value={slug}
                />
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-status">
                  Estado <RequiredMark />
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
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-currency">
                  Moneda <RequiredMark />
                </FieldLabel>
                <Select
                  defaultValue={plan.currency}
                  disabled={isSaving}
                  name="currency"
                >
                  <SelectTrigger aria-required="true" id="plan-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
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
                  Tipo de cobro <RequiredMark />
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
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-disabled={isSaving || undefined}>
                <FieldLabel htmlFor="plan-trial-days">
                  Días de prueba <RequiredMark />
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
                  Posición <RequiredMark />
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
              <FieldLabel htmlFor="plan-description">Descripción</FieldLabel>
              <Textarea
                defaultValue={plan.description}
                disabled={isSaving}
                id="plan-description"
                maxLength={500}
                name="description"
                placeholder="Describe para quién es este plan."
              />
            </Field>
            <FieldGroup className="grid sm:grid-cols-3">
              <Field
                data-disabled={isSaving || undefined}
                orientation="horizontal"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <FieldLabel htmlFor="plan-free">Plan gratuito</FieldLabel>
                  <FieldDescription>
                    No cobra a los suscriptores.
                  </FieldDescription>
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
                  <FieldLabel htmlFor="plan-featured">Destacado</FieldLabel>
                  <FieldDescription>
                    Se resalta en el catálogo.
                  </FieldDescription>
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
                  <FieldLabel htmlFor="plan-default">Predeterminado</FieldLabel>
                  <FieldDescription>Se asigna al registrarse.</FieldDescription>
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
                Cancelar
              </Button>
              <Button disabled={!formComplete || isSaving} type="submit">
                {isSaving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SubmitIcon data-icon="inline-start" />
                )}
                {isSaving ? "Guardando..." : submitLabel}
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
  const deletingLock = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const hasSubscribers = plan.subscriberCount > 0
  const subscriberLabel =
    plan.subscriberCount === 1
      ? "1 suscriptor"
      : `${plan.subscriberCount.toLocaleString("es")} suscriptores`

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
              ? `No se puede eliminar ${plan.name}`
              : `¿Eliminar ${plan.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasSubscribers
              ? `Este plan está asignado a ${subscriberLabel}. Mueve esas cuentas a otro plan antes de eliminarlo.`
              : "El plan se eliminará de la configuración. Esta acción no se puede deshacer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} variant="brand-secondary">
            Cancelar
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
            {isDeleting ? "Eliminando..." : "Eliminar plan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function PlansPage() {
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
        toast.error("Tu sesión expiró. Vuelve a iniciar sesión.")
      } else {
        console.error("Plans request failed", error)
        toast.error("No pudimos cargar los planes. Inténtalo de nuevo.")
      }
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [billingFilter, featuredFilter, query, statusFilter])

  useEffect(() => {
    void loadPlans()
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
        toast.success("Plan actualizado.")
      } else {
        await plansApi.create(planInput(plan))
        toast.success("Plan creado.")
      }
      await loadPlans()
      setEditor(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("El nombre, slug o plan predeterminado ya existe.")
      } else if (error instanceof ApiError && error.status === 400) {
        toast.error("Revisa los datos del plan antes de guardarlo.")
      } else {
        console.error("Plan save failed", error)
        toast.error("No pudimos guardar el plan. Inténtalo de nuevo.")
      }
      throw error
    }
  }

  async function removePlan() {
    if (!planToDelete) return
    try {
      await plansApi.remove(planToDelete.id)
      toast.success("Plan eliminado.")
      await loadPlans()
      setPlanToDelete(null)
    } catch (error) {
      console.error("Plan removal failed", error)
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          "Este plan todavía tiene suscriptores. Muévelos a otro plan antes de eliminarlo."
        )
      } else {
        toast.error("No pudimos eliminar el plan. Inténtalo de nuevo.")
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
          description="Tu cuenta no tiene acceso para administrar planes."
          icon={Users}
          title="Acceso restringido"
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
          description="No pudimos consultar la configuración de planes."
          icon={Search}
          title="No se pudieron cargar los planes"
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Planes</h1>
        <p className="text-sm text-muted-foreground">
          Configura el catálogo, precios, permisos y disponibilidad de cada
          plan.
        </p>
      </header>
      {isLoading ? (
        <PageLoading className="min-h-80" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Planes",
                value: plans.length.toLocaleString("es"),
                description: "Opciones visibles",
                icon: WalletCards,
              },
              {
                label: "Activos",
                value: activePlans.toLocaleString("es"),
                description: "Disponibles hoy",
                icon: Check,
              },
              {
                label: "Suscriptores",
                value: subscriberCount.toLocaleString("es"),
                description: "Cuentas en esta vista",
                icon: Users,
              },
              {
                label: "Destacados",
                value: featuredPlans.toLocaleString("es"),
                description: "Ofertas principales",
                icon: Sparkles,
              },
            ].map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <Card variant="subtle">
            <DataTableHeader
              action={
                <Button onClick={() => setEditor("create")} size="sm">
                  <Plus data-icon="inline-start" />
                  Crear plan
                </Button>
              }
              search={{
                ariaLabel: "Buscar planes",
                onChange: (value) => {
                  setQuery(value)
                  setPageIndex(0)
                },
                placeholder: "Buscar por nombre o slug...",
                value: query,
              }}
            />
            <CardContent className="flex flex-col gap-4 px-0">
              <DataTableToolbar>
                <DataTableFilter
                  ariaLabel="Filtrar por estado"
                  label="Estado"
                  onValueChange={(value) => {
                    setStatusFilter(value as "all" | PlanStatus)
                    setPageIndex(0)
                  }}
                  options={[
                    { label: "Todos los estados", value: "all" },
                    { label: "Activos", value: "active" },
                    { label: "Inactivos", value: "inactive" },
                  ]}
                  value={statusFilter}
                />
                <DataTableFilter
                  ariaLabel="Filtrar por cobro"
                  label="Cobro"
                  onValueChange={(value) => {
                    setBillingFilter(value as "all" | PlanBillingType)
                    setPageIndex(0)
                  }}
                  options={[
                    { label: "Todo cobro", value: "all" },
                    { label: "Mensual", value: "monthly" },
                    { label: "Anual", value: "yearly" },
                  ]}
                  value={billingFilter}
                />
                <DataTableFilter
                  ariaLabel="Filtrar por destacado"
                  label="Visibilidad"
                  onValueChange={(value) => {
                    setFeaturedFilter(value as "all" | "featured" | "standard")
                    setPageIndex(0)
                  }}
                  options={[
                    { label: "Todos los planes", value: "all" },
                    { label: "Destacados", value: "featured" },
                    { label: "No destacados", value: "standard" },
                  ]}
                  value={featuredFilter}
                />
              </DataTableToolbar>
              {plans.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Cobro</TableHead>
                      <TableHead>Prueba</TableHead>
                      <TableHead>Suscriptores</TableHead>
                      <TableHead>Permisos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
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
                                  Destacado
                                </Badge>
                              ) : null}
                              {plan.isDefaultSignup ? (
                                <Badge variant="neutral">Predeterminado</Badge>
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              /{plan.slug}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(plan)}
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-0.5">
                            <span>
                              {plan.isFree
                                ? "—"
                                : billingLabels[plan.billingType]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Orden #{plan.position}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {plan.trialDays > 0
                            ? `${plan.trialDays} días`
                            : "Sin prueba"}
                        </TableCell>
                        <TableCell>
                          {plan.subscriberCount.toLocaleString("es")}
                        </TableCell>
                        <TableCell>{plan.permissionIds.length}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              plan.status === "active" ? "success" : "neutral"
                            }
                          >
                            {statusLabels[plan.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Acciones para ${plan.name}`}
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
                                  Editar plan
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
                                  Eliminar plan
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  action={
                    hasActiveFilters ? (
                      <Button onClick={resetFilters} variant="brand-secondary">
                        Restablecer filtros
                      </Button>
                    ) : undefined
                  }
                  description={
                    hasActiveFilters
                      ? "No hay planes que coincidan con los filtros actuales."
                      : "Aún no hay planes configurados. Crea el primero para comenzar."
                  }
                  icon={Search}
                  title={
                    hasActiveFilters ? "No encontramos planes" : "No hay planes"
                  }
                />
              )}
              <TablePagination
                canGoNext={currentPageIndex < pageCount - 1}
                canGoPrevious={currentPageIndex > 0}
                itemLabel="planes"
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
