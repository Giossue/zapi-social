"use client"

import { ApiError, integrationsApi } from "@workspace/api-client"
import { WhatsAppStatusIntegrationCard } from "./whatsapp-status-integration-card"
import { EmailSmtpIntegrationCard } from "./email-smtp-integration-card"
import { IntegrationCardLoading } from "./integration-card-loading"
import { IntegrationInsetCard } from "./integration-inset-card"
import type { MetaIntegration } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Copy,
  KeyRound,
  Link,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

type CapabilityKey = MetaIntegration["capabilities"][number]["key"]
type MetaScope = MetaIntegration["capabilityScopes"][CapabilityKey][number]
type ScopeOption = { label: string; required: boolean; scope: MetaScope }

const capabilityScopeOptions = {
  facebook_page: [
    {
      label: "Información básica del perfil",
      required: true,
      scope: "public_profile",
    },
    { label: "Ver páginas", required: true, scope: "pages_show_list" },
    {
      label: "Leer actividad de páginas",
      required: true,
      scope: "pages_read_engagement",
    },
    {
      label: "Publicar en páginas",
      required: true,
      scope: "pages_manage_posts",
    },
    {
      label: "Administrar negocios",
      required: false,
      scope: "business_management",
    },
  ],
  instagram_profile: [
    {
      label: "Información básica del perfil",
      required: true,
      scope: "public_profile",
    },
    { label: "Ver páginas", required: true, scope: "pages_show_list" },
    {
      label: "Leer actividad de páginas",
      required: true,
      scope: "pages_read_engagement",
    },
    {
      label: "Leer perfiles de Instagram",
      required: true,
      scope: "instagram_basic",
    },
    {
      label: "Publicar en Instagram",
      required: true,
      scope: "instagram_content_publish",
    },
    {
      label: "Administrar negocios",
      required: false,
      scope: "business_management",
    },
  ],
} satisfies Record<CapabilityKey, readonly ScopeOption[]>

type Draft = {
  enabled: boolean
  enabledCapabilityKeys: MetaIntegration["capabilities"][number]["key"][]
  clientId: string
  clientSecret: string
  capabilityScopes: MetaIntegration["capabilityScopes"]
}

type TestState = "not-tested" | "testing" | "passed" | "failed"

const statusCopy = {
  ready: { label: "Listo", variant: "success" as const },
  incomplete: { label: "Incompleto", variant: "warning" as const },
  untested: { label: "Sin probar", variant: "warning" as const },
  disabled: { label: "Deshabilitado", variant: "neutral" as const },
}

function ProviderStatus({
  readiness,
}: {
  readiness: MetaIntegration["readiness"]
}) {
  const status = statusCopy[readiness]
  const Icon =
    readiness === "ready"
      ? CheckCircle2
      : readiness === "disabled"
        ? Circle
        : CircleAlert

  return (
    <Badge variant={status.variant}>
      <Icon aria-hidden="true" />
      {status.label}
    </Badge>
  )
}

function draftFrom(integration: MetaIntegration): Draft {
  return {
    enabled: integration.enabled,
    enabledCapabilityKeys: integration.capabilities
      .filter((capability) => capability.enabled)
      .map((capability) => capability.key),
    clientId: integration.clientId ?? "",
    clientSecret: "",
    capabilityScopes: {
      facebook_page: [...integration.capabilityScopes.facebook_page],
      instagram_profile: [...integration.capabilityScopes.instagram_profile],
    },
  }
}

function sameSet(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((key) => right.includes(key))
  )
}

function isDirty(draft: Draft, integration: MetaIntegration) {
  const configuredCapabilities = integration.capabilities
    .filter((capability) => capability.enabled)
    .map((capability) => capability.key)

  return (
    draft.enabled !== integration.enabled ||
    !sameSet(draft.enabledCapabilityKeys, configuredCapabilities) ||
    draft.clientId !== (integration.clientId ?? "") ||
    draft.clientSecret.length > 0 ||
    !sameSet(
      draft.capabilityScopes.facebook_page,
      integration.capabilityScopes.facebook_page
    ) ||
    !sameSet(
      draft.capabilityScopes.instagram_profile,
      integration.capabilityScopes.instagram_profile
    )
  )
}

export function IntegrationsPage() {
  const [integration, setIntegration] = useState<MetaIntegration | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [testState, setTestState] = useState<TestState>("not-tested")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeProvider, setActiveProvider] = useState<
    "meta" | "whatsapp" | "email"
  >("meta")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setIntegration(await integrationsApi.getMeta())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("Tu sesión expiró. Vuelve a iniciar sesión.")
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("No tienes permiso para administrar integraciones.")
      } else {
        toast.error("No pudimos cargar la integración Meta.")
      }
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => Boolean(draft && integration && isDirty(draft, integration)),
    [draft, integration]
  )

  function openConfiguration() {
    if (!integration) return
    setDraft(draftFrom(integration))
    setTestState("not-tested")
  }

  function closeConfiguration() {
    setDraft(null)
    setTestState("not-tested")
  }

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...update } : current))
    setTestState("not-tested")
  }

  function toggleCapability(
    key: Draft["enabledCapabilityKeys"][number],
    enabled: boolean
  ) {
    if (!draft) return
    updateDraft({
      enabledCapabilityKeys: enabled
        ? [...draft.enabledCapabilityKeys, key]
        : draft.enabledCapabilityKeys.filter((item) => item !== key),
    })
  }

  function toggleScope(
    capabilityKey: CapabilityKey,
    scope: MetaScope,
    selected: boolean
  ) {
    if (!draft) return
    const option = capabilityScopeOptions[capabilityKey].find(
      (item) => item.scope === scope
    )
    if (option?.required) return

    const scopes = draft.capabilityScopes[capabilityKey]
    updateDraft({
      capabilityScopes: {
        ...draft.capabilityScopes,
        [capabilityKey]: selected
          ? [...scopes, scope]
          : scopes.filter((item) => item !== scope),
      },
    })
  }

  async function copyCallbackUrl(label: string, value: string) {
    if (!navigator.clipboard) {
      toast.error("Tu navegador no permite copiar esta URL.")
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copiada.`)
    } catch {
      toast.error("No pudimos copiar la URL. Inténtalo de nuevo.")
    }
  }

  async function testConfiguration() {
    if (!draft) return
    if (!draft.clientId.trim()) {
      toast.error("El ID de la aplicación es obligatorio.")
      return
    }
    if (!draft.clientSecret.trim() && !integration?.secretConfigured) {
      toast.error("El secreto de la aplicación es obligatorio.")
      return
    }

    setTestState("testing")
    try {
      await integrationsApi.testMeta({
        configuration: {
          clientId: draft.clientId,
          ...(draft.clientSecret ? { clientSecret: draft.clientSecret } : {}),
          capabilityScopes: draft.capabilityScopes,
        },
      })
      setTestState("passed")
      toast.success("Meta validó el borrador. Ya puedes guardarlo.")
    } catch (error) {
      setTestState("failed")
      if (error instanceof ApiError && error.status === 400) {
        toast.error("Revisa el ID y el secreto de la aplicación.")
      } else {
        toast.error("Meta no pudo validar el borrador. Inténtalo de nuevo.")
      }
    }
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !integration) return

    if (draft.enabled && testState !== "passed") {
      toast.error("Prueba esta configuración antes de guardarla.")
      return
    }

    setSaving(true)
    try {
      const saved = await integrationsApi.saveMeta({
        enabled: draft.enabled,
        enabledCapabilityKeys: draft.enabledCapabilityKeys,
        ...(draft.clientId !== (integration.clientId ?? "") ||
        draft.clientSecret ||
        !sameSet(
          draft.capabilityScopes.facebook_page,
          integration.capabilityScopes.facebook_page
        ) ||
        !sameSet(
          draft.capabilityScopes.instagram_profile,
          integration.capabilityScopes.instagram_profile
        )
          ? {
              configuration: {
                clientId: draft.clientId,
                ...(draft.clientSecret
                  ? { clientSecret: draft.clientSecret }
                  : {}),
                capabilityScopes: draft.capabilityScopes,
              },
            }
          : {}),
      })
      setIntegration(saved)
      setDraft(draftFrom(saved))
      setTestState("not-tested")
      toast.success("Configuración Meta guardada.")
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(
          "El borrador probado ya no coincide con la configuración a guardar."
        )
      } else {
        toast.error("No pudimos guardar la configuración Meta.")
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Tabs
          onValueChange={(value) =>
            setActiveProvider(value as "meta" | "whatsapp" | "email")
          }
          value={activeProvider}
        >
          <TabsList aria-label="Proveedor de integración">
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Status</TabsTrigger>
            <TabsTrigger value="email">Correo SMTP</TabsTrigger>
          </TabsList>
        </Tabs>
        <IntegrationCardLoading />
      </div>
    )
  }

  if (loadError || !integration) {
    return (
      <EmptyState
        action={<Button onClick={() => void load()}>Reintentar</Button>}
        description="No fue posible obtener el estado de Meta."
        icon={PlugZap}
        title="Integración no disponible"
      />
    )
  }

  return (
    <div className="space-y-6">
      <Tabs
        onValueChange={(value) =>
          setActiveProvider(value as "meta" | "whatsapp" | "email")
        }
        value={activeProvider}
      >
        <TabsList aria-label="Proveedor de integración">
          <TabsTrigger value="meta">Meta</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Status</TabsTrigger>
          <TabsTrigger value="email">Correo SMTP</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeProvider === "meta" ? (
        <>
          <Card variant="subtle">
            <CardHeader className="gap-4 border-b border-border pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{integration.label}</CardTitle>
                    <ProviderStatus readiness={integration.readiness} />
                    <Badge variant="neutral">OAuth 2.0</Badge>
                  </div>
                  <CardDescription>{integration.description}</CardDescription>
                </div>
                <Button onClick={openConfiguration} variant="brand-secondary">
                  <Settings2 data-icon="inline-start" />
                  Ver y configurar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-7">
              <section
                aria-labelledby="capabilities-title"
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <KeyRound
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h2 id="capabilities-title" className="text-sm font-semibold">
                    Tipos de canal
                  </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {integration.capabilities.map((capability) => (
                    <IntegrationInsetCard key={capability.key}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {capability.label}
                        </p>
                        <Badge
                          variant={capability.enabled ? "success" : "neutral"}
                        >
                          {capability.enabled ? "Activa" : "Desactivada"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {capability.description}
                      </p>
                    </IntegrationInsetCard>
                  ))}
                </div>
              </section>

              <section
                aria-labelledby="configuration-title"
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <LockKeyhole
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h2
                    id="configuration-title"
                    className="text-sm font-semibold"
                  >
                    Resumen de configuración
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <IntegrationInsetCard>
                    <p className="text-xs font-medium text-muted-foreground">
                      ID de la aplicación
                    </p>
                    <p className="mt-1 text-sm break-all">
                      {integration.clientId ?? "Sin configurar"}
                    </p>
                  </IntegrationInsetCard>
                  <IntegrationInsetCard>
                    <p className="text-xs font-medium text-muted-foreground">
                      Secreto de la aplicación
                    </p>
                    <p className="mt-1 text-sm">
                      {integration.secretConfigured
                        ? "Configurado"
                        : "Sin configurar"}
                    </p>
                  </IntegrationInsetCard>
                </div>
              </section>

              <section aria-labelledby="callbacks-title" className="space-y-3">
                <div className="flex items-start gap-2">
                  <Link
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <div>
                    <h2 id="callbacks-title" className="text-sm font-semibold">
                      URLs de retorno OAuth
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Son datos de solo lectura generados por la API.
                      Regístralos en Meta.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 pl-6">
                  {integration.capabilities.map((capability) => (
                    <div className="grid gap-1.5" key={capability.key}>
                      <p className="text-sm font-medium">{capability.label}</p>
                      <div className="flex items-center gap-2">
                        <Input
                          className="font-mono text-xs"
                          readOnly
                          value={capability.callbackUrl}
                        />
                        <Button
                          aria-label={`Copiar URL de retorno de ${capability.label}`}
                          onClick={() =>
                            void copyCallbackUrl(
                              capability.label,
                              capability.callbackUrl
                            )
                          }
                          size="icon"
                          type="button"
                          variant="surface"
                        >
                          <Copy />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        </>
      ) : activeProvider === "whatsapp" ? (
        <WhatsAppStatusIntegrationCard />
      ) : (
        <EmailSmtpIntegrationCard />
      )}

      <Dialog
        onOpenChange={(open) => !open && closeConfiguration()}
        open={draft !== null}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          {draft ? (
            <>
              <DialogHeader>
                <DialogTitle>Configurar Meta</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-5"
                noValidate
                onSubmit={saveConfiguration}
              >
                <IntegrationInsetCard className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Disponibilidad del proveedor
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {draft.enabled
                          ? "Puede ofrecer tipos de canal cuando la configuración esté probada."
                          : "Sus tipos de canal no estarán disponibles en el portal."}
                      </p>
                    </div>
                    <Switch
                      aria-label="Habilitar Meta"
                      checked={draft.enabled}
                      onCheckedChange={(enabled) => updateDraft({ enabled })}
                    />
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-medium">Tipos de canal</p>
                    <div className="mt-3 grid gap-3">
                      {integration.capabilities.map((capability) => {
                        const enabled = draft.enabledCapabilityKeys.includes(
                          capability.key
                        )
                        return (
                          <IntegrationInsetCard
                            className="flex items-center justify-between gap-4 px-3 py-3"
                            key={capability.key}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {capability.label}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {capability.description}
                              </p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    className="mt-3"
                                    type="button"
                                    variant="surface"
                                  >
                                    {
                                      draft.capabilityScopes[capability.key]
                                        .length
                                    }{" "}
                                    permisos seleccionados
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  {capabilityScopeOptions[capability.key].map(
                                    (option) => {
                                      const checked =
                                        option.required ||
                                        draft.capabilityScopes[
                                          capability.key
                                        ].includes(option.scope)
                                      return (
                                        <DropdownMenuCheckboxItem
                                          checked={checked}
                                          disabled={option.required}
                                          key={option.scope}
                                          onCheckedChange={(next) =>
                                            toggleScope(
                                              capability.key,
                                              option.scope,
                                              next
                                            )
                                          }
                                        >
                                          <span className="flex items-center gap-2">
                                            {option.label}
                                            {option.required ? (
                                              <Badge variant="neutral">
                                                Obligatorio
                                              </Badge>
                                            ) : null}
                                          </span>
                                        </DropdownMenuCheckboxItem>
                                      )
                                    }
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <Switch
                              aria-label={`Habilitar ${capability.label}`}
                              checked={enabled}
                              onCheckedChange={(next) =>
                                toggleCapability(capability.key, next)
                              }
                            />
                          </IntegrationInsetCard>
                        )
                      })}
                    </div>
                  </div>
                </IntegrationInsetCard>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">
                      ID de la aplicación
                    </span>
                    <Input
                      onChange={(event) =>
                        updateDraft({ clientId: event.target.value })
                      }
                      required
                      value={draft.clientId}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">
                      Secreto de la aplicación
                    </span>
                    <Input
                      onChange={(event) =>
                        updateDraft({ clientSecret: event.target.value })
                      }
                      placeholder={
                        integration.secretConfigured
                          ? "••••••••••••"
                          : undefined
                      }
                      required={!integration.secretConfigured}
                      type="password"
                      value={draft.clientSecret}
                    />
                  </label>
                </div>

                {draft.enabled ? (
                  <section
                    aria-labelledby="test-title"
                    className="space-y-3 border-t border-border pt-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 id="test-title" className="text-sm font-semibold">
                          Probar borrador
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          La prueba valida el borrador con Meta antes de
                          cifrarlo y guardarlo.
                        </p>
                      </div>
                      <Button
                        disabled={
                          testState === "testing" || testState === "passed"
                        }
                        onClick={() => void testConfiguration()}
                        type="button"
                        variant={testState === "passed" ? "success" : "surface"}
                      >
                        {testState === "testing" ? (
                          <LoaderCircle
                            className="animate-spin"
                            data-icon="inline-start"
                          />
                        ) : testState === "passed" ? (
                          <CheckCircle2 data-icon="inline-start" />
                        ) : (
                          <ShieldCheck data-icon="inline-start" />
                        )}
                        {testState === "testing"
                          ? "Probando configuración"
                          : testState === "passed"
                            ? "Borrador validado"
                            : "Probar configuración"}
                      </Button>
                    </div>
                    {testState === "failed" ? (
                      <p className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle aria-hidden="true" className="size-4" />
                        No se pudo validar el borrador.
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                  <Button
                    onClick={closeConfiguration}
                    type="button"
                    variant="brand-secondary"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={
                      !dirty ||
                      saving ||
                      (draft.enabled && testState !== "passed")
                    }
                    type="submit"
                  >
                    <Save data-icon="inline-start" />
                    {saving ? "Guardando" : "Guardar configuración"}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
