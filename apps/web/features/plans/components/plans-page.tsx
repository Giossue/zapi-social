"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
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
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { PageLoading } from "@workspace/ui/components/page-loading"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
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

function PermissionGroups({
  selectedIds,
  setSelectedIds,
}: {
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
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Permisos incluidos</legend>
      <p className="text-sm text-muted-foreground">
        Define las capacidades que aparecen para los miembros con este plan.
      </p>
      <div className="grid gap-3">
        {planPermissionGroups.map((group) => {
          const permissionIds = group.permissions.map(
            (permission) => permission.id
          )
          const groupChecked = permissionIds.every((permissionId) =>
            selectedIds.includes(permissionId)
          )
          return (
            <div className="rounded-lg border border-border" key={group.id}>
              <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-4 py-3">
                <span className="text-sm font-medium">{group.label}</span>
                <Checkbox
                  aria-label={`Seleccionar todos los permisos de ${group.label}`}
                  checked={groupChecked}
                  onCheckedChange={(checked) =>
                    toggleGroup(permissionIds, checked === true)
                  }
                />
              </label>
              <div className="divide-y divide-border">
                {group.permissions.map((permission) => (
                  <label
                    className="flex cursor-pointer items-start gap-3 px-4 py-3"
                    key={permission.id}
                  >
                    <Checkbox
                      checked={selectedIds.includes(permission.id)}
                      className="mt-0.5"
                      onCheckedChange={(checked) =>
                        togglePermission(permission.id, checked === true)
                      }
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">
                        {permission.label}
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function PlanEditorDialog({
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
  const [isFree, setIsFree] = useState(plan.isFree)
  const [featured, setFeatured] = useState(plan.featured)
  const [isDefaultSignup, setIsDefaultSignup] = useState(plan.isDefaultSignup)
  const [permissionIds, setPermissionIds] = useState([...plan.permissionIds])
  const [name, setName] = useState(plan.name)
  const [slug, setSlug] = useState(plan.slug)
  const isEditing = Boolean(plan.id)
  const formComplete = Boolean(
    name.trim() && slug.trim() && permissionIds.length > 0
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {isEditing ? `Editar ${plan.name}` : "Crear plan"}
          </DialogTitle>
          <DialogDescription>
            Los cambios se guardarán en la configuración de planes. Aún no
            afectan suscripciones ni usuarios.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea
          className="max-h-[calc(100dvh-10rem)]"
          scrollbarClassName="translate-x-6"
          type="always"
        >
          <form
            className="grid gap-6 px-6 pt-5 pr-12 pb-6"
            noValidate
            onSubmit={submit}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                <span>
                  Nombre{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </span>
                <Input
                  aria-required="true"
                  maxLength={80}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>
                  Slug{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </span>
                <Input
                  aria-required="true"
                  maxLength={80}
                  name="slug"
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="mi-plan"
                  value={slug}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Estado
                <Select defaultValue={plan.status} name="status">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Moneda
                <Select defaultValue={plan.currency} name="currency">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Precio
                <Input
                  defaultValue={plan.price}
                  disabled={isFree}
                  min="0"
                  name="price"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Tipo de cobro
                <Select defaultValue={plan.billingType} name="billingType">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Días de prueba
                <Input
                  defaultValue={plan.trialDays}
                  min="0"
                  name="trialDays"
                  type="number"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Posición
                <Input
                  defaultValue={plan.position}
                  min="1"
                  name="position"
                  type="number"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Descripción
              <Textarea
                defaultValue={plan.description}
                maxLength={500}
                name="description"
                placeholder="Describe para quién es este plan."
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">Plan gratuito</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    No cobra a los suscriptores.
                  </span>
                </span>
                <Switch checked={isFree} onCheckedChange={setIsFree} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">Destacado</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Se resalta en el catálogo.
                  </span>
                </span>
                <Switch checked={featured} onCheckedChange={setFeatured} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">Predeterminado</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Se asigna al registrarse.
                  </span>
                </span>
                <Switch
                  checked={isDefaultSignup}
                  onCheckedChange={setIsDefaultSignup}
                />
              </label>
            </div>
            <PermissionGroups
              selectedIds={permissionIds}
              setSelectedIds={setPermissionIds}
            />
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                onClick={() => onOpenChange(false)}
                type="button"
                variant="brand-secondary"
              >
                Cancelar
              </Button>
              <Button disabled={!formComplete} type="submit">
                {isEditing ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                {isEditing ? "Guardar cambios" : "Crear plan"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function DeletePlanDialog({
  onOpenChange,
  onRemove,
  plan,
}: {
  onOpenChange: (open: boolean) => void
  onRemove: () => void
  plan: AdminPlan
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {plan.name}</DialogTitle>
          <DialogDescription>
            Esta acción elimina el plan de la configuración. Aún no existen
            suscripciones ni usuarios vinculados.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button onClick={() => onOpenChange(false)} variant="brand-secondary">
            Cancelar
          </Button>
          <Button onClick={onRemove} variant="destructive">
            <Trash2 data-icon="inline-start" />
            Eliminar plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [pageSize, setPageSize] = useState(10)
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
      setEditor(null)
      await loadPlans()
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
      setPlanToDelete(null)
      await loadPlans()
    } catch (error) {
      console.error("Plan removal failed", error)
      toast.error("No pudimos eliminar el plan. Inténtalo de nuevo.")
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
      <Card variant="surface">
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
      <Card variant="surface">
        <EmptyState
          action={
            <Button onClick={() => void loadPlans()} variant="brand-secondary">
              Reintentar
            </Button>
          }
          description="No pudimos consultar la configuración de planes."
          icon={Search}
          title="No se pudieron cargar los planes"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Planes</h1>
          <p className="text-sm text-muted-foreground">
            Configura el catálogo, precios, permisos y disponibilidad de cada
            plan.
          </p>
        </div>
        <Button onClick={() => setEditor("create")}>
          <Plus data-icon="inline-start" />
          Crear plan
        </Button>
      </div>
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
            ].map((metric) => {
              const MetricIcon = metric.icon
              return (
                <Card key={metric.label} size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">
                      {metric.label}
                    </CardTitle>
                    <CardAction>
                      <MetricIcon
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-2xl font-semibold tracking-tight">
                      {metric.value}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 xl:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
              <CardTitle>Planes</CardTitle>
              <CardDescription>
                {plans.length} resultados en esta vista.
              </CardDescription>
              <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap gap-2 justify-self-stretch xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:w-auto xl:flex-nowrap xl:justify-self-end">
                <InputGroup className="w-full md:w-64">
                  <InputGroupAddon align="inline-start">
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPageIndex(0)
                    }}
                    placeholder="Buscar por nombre o slug..."
                    value={query}
                  />
                </InputGroup>
                <Select
                  onValueChange={(value) => {
                    setStatusFilter(value as "all" | PlanStatus)
                    setPageIndex(0)
                  }}
                  value={statusFilter}
                >
                  <SelectTrigger
                    aria-label="Filtrar por estado"
                    className="w-full sm:w-40"
                  >
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  onValueChange={(value) => {
                    setBillingFilter(value as "all" | PlanBillingType)
                    setPageIndex(0)
                  }}
                  value={billingFilter}
                >
                  <SelectTrigger
                    aria-label="Filtrar por cobro"
                    className="w-full sm:w-36"
                  >
                    <SelectValue placeholder="Cobro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todo cobro</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  onValueChange={(value) => {
                    setFeaturedFilter(value as "all" | "featured" | "standard")
                    setPageIndex(0)
                  }}
                  value={featuredFilter}
                >
                  <SelectTrigger
                    aria-label="Filtrar por destacado"
                    className="w-full sm:w-40"
                  >
                    <SelectValue placeholder="Visibilidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todos los planes</SelectItem>
                      <SelectItem value="featured">Destacados</SelectItem>
                      <SelectItem value="standard">No destacados</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
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
            </CardContent>
            <CardFooter className="border-t">
              <TablePagination
                canGoNext={currentPageIndex < pageCount - 1}
                canGoPrevious={currentPageIndex > 0}
                itemLabel="planes"
                mode="detailed"
                onFirstPage={() => setPageIndex(0)}
                onLastPage={() => setPageIndex(pageCount - 1)}
                onNextPage={() =>
                  setPageIndex((current) =>
                    Math.min(current + 1, pageCount - 1)
                  )
                }
                onPageSizeChange={(value) => {
                  setPageSize(value)
                  setPageIndex(0)
                }}
                onPreviousPage={() =>
                  setPageIndex((current) => Math.max(current - 1, 0))
                }
                page={currentPageIndex + 1}
                pageCount={pageCount}
                pageSize={pageSize}
                rangeEnd={rangeEnd}
                rangeStart={rangeStart}
                total={plans.length}
              />
            </CardFooter>
          </Card>
        </>
      )}
      {planForEditor ? (
        <PlanEditorDialog
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
