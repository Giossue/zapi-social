"use client"

import { ApiError, adminTurnstileApi } from "@workspace/api-client"
import type { AdminTurnstileConfiguration } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { KeyRound, Save, Settings2, ShieldCheck } from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

type Draft = {
  enabled: boolean
  siteKey: string
  secretKey: string
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function Inset({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-0 py-0" variant="inset">
      <CardContent className="px-4 py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm">{value}</p>
      </CardContent>
    </Card>
  )
}

function draftFrom(configuration: AdminTurnstileConfiguration): Draft {
  return {
    enabled: configuration.enabled,
    siteKey: configuration.siteKey ?? "",
    secretKey: "",
  }
}

function isDirty(draft: Draft, configuration: AdminTurnstileConfiguration) {
  return (
    draft.enabled !== configuration.enabled ||
    draft.siteKey !== (configuration.siteKey ?? "") ||
    Boolean(draft.secretKey)
  )
}

export function AdminTurnstileSettingsPage() {
  const [configuration, setConfiguration] =
    useState<AdminTurnstileConfiguration | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setForbidden(false)
    try {
      setConfiguration(await adminTurnstileApi.get())
    } catch (error) {
      setLoadError(true)
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        toast.error("No tienes permiso para administrar Captcha.")
      } else if (error instanceof ApiError && error.status === 401) {
        toast.error("Tu sesión expiró. Vuelve a iniciar sesión.")
      } else {
        toast.error("No pudimos cargar la configuración de Turnstile.")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const complete = Boolean(
    draft &&
    draft.siteKey.trim() &&
    (draft.secretKey.trim() || configuration?.secretConfigured)
  )
  const dirty = Boolean(draft && configuration && isDirty(draft, configuration))
  const status = configuration?.enabled ? "Activo" : "Deshabilitado"
  const statusVariant = configuration?.enabled ? "success" : "neutral"
  const summary = useMemo(
    () => [
      { label: "Estado", value: status },
      { label: "Cobertura", value: "Inicio de sesión y Registro" },
      {
        label: "Credenciales",
        value: configuration?.secretConfigured
          ? "Configuradas"
          : "Sin configurar",
      },
    ],
    [configuration?.secretConfigured, status]
  )

  function open() {
    if (!configuration) return
    setDraft(draftFrom(configuration))
  }

  function close() {
    if (saving) return
    setDraft(null)
  }

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...update } : current))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !configuration) return
    if (draft.enabled && !complete) {
      toast.error(
        "Completa las claves pública y secreta antes de habilitar Turnstile."
      )
      return
    }

    setSaving(true)
    try {
      const saved = await adminTurnstileApi.update({
        enabled: draft.enabled,
        siteKey: draft.siteKey.trim(),
        ...(draft.secretKey.trim()
          ? { secretKey: draft.secretKey.trim() }
          : {}),
      })
      setConfiguration(saved)
      setDraft(null)
      toast.success("Configuración de Turnstile guardada.")
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error("Revisa las claves antes de guardar esta configuración.")
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("No tienes permiso para administrar Captcha.")
      } else {
        toast.error("No pudimos guardar la configuración de Turnstile.")
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />
  if (loadError || !configuration) {
    return (
      <EmptyState
        action={
          forbidden ? undefined : <RetryButton onClick={() => void load()} />
        }
        description={
          forbidden
            ? "Solo administradores de plataforma pueden modificar esta configuración."
            : "No fue posible obtener la configuración de seguridad."
        }
        icon={ShieldCheck}
        title={forbidden ? "Acceso restringido" : "Configuración no disponible"}
      />
    )
  }

  return (
    <>
      <Card variant="subtle">
        <CardHeader className="gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <CardTitle>Cloudflare Turnstile</CardTitle>
                <Badge variant={statusVariant}>{status}</Badge>
              </div>
              <CardDescription>
                Protección contra bots para autenticación pública.
              </CardDescription>
            </div>
            <Button onClick={open} variant="brand-secondary">
              <Settings2 data-icon="inline-start" />
              Configurar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {summary.map((item) => (
            <Inset key={item.label} {...item} />
          ))}
        </CardContent>
      </Card>

      <Sheet open={Boolean(draft)} onOpenChange={(next) => !next && close()}>
        <SheetContent
          className="w-full gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-xl"
          side="right"
        >
          <form className="flex min-h-full flex-col" noValidate onSubmit={save}>
            <SheetHeader className="border-b">
              <SheetTitle>Configurar Cloudflare Turnstile</SheetTitle>
              <SheetDescription>
                Protege Inicio de sesión y Registro con una verificación
                anti-bots.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 p-4">
              <Card className="gap-0 py-0" variant="inset">
                <CardContent className="px-4 py-4">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Disponibilidad</FieldTitle>
                      <p className="text-xs text-muted-foreground">
                        Exige Turnstile antes de iniciar sesión o crear una
                        cuenta.
                      </p>
                    </FieldContent>
                    <Switch
                      aria-label="Habilitar Cloudflare Turnstile"
                      checked={draft?.enabled ?? false}
                      disabled={saving}
                      onCheckedChange={(enabled) => updateDraft({ enabled })}
                    />
                  </Field>
                </CardContent>
              </Card>

              <section
                aria-labelledby="turnstile-credentials"
                className="flex flex-col gap-4 border-t border-border pt-5"
              >
                <div className="flex items-center gap-2">
                  <KeyRound
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <h2
                    className="text-sm font-semibold"
                    id="turnstile-credentials"
                  >
                    Credenciales
                  </h2>
                </div>
                <FieldGroup>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="turnstile-site-key">
                      Clave pública <RequiredMark />
                    </FieldLabel>
                    <Input
                      aria-required="true"
                      disabled={saving}
                      id="turnstile-site-key"
                      onChange={(event) =>
                        updateDraft({ siteKey: event.target.value })
                      }
                      value={draft?.siteKey ?? ""}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="turnstile-secret-key">
                      Clave secreta
                      {configuration.secretConfigured ? null : <RequiredMark />}
                    </FieldLabel>
                    <Input
                      aria-required={!configuration.secretConfigured}
                      disabled={saving}
                      id="turnstile-secret-key"
                      onChange={(event) =>
                        updateDraft({ secretKey: event.target.value })
                      }
                      placeholder={
                        configuration.secretConfigured
                          ? "Deja vacío para conservar la clave actual"
                          : undefined
                      }
                      type="password"
                      value={draft?.secretKey ?? ""}
                    />
                  </Field>
                </FieldGroup>
              </section>
            </div>
            <SheetFooter className="flex-row justify-end border-t">
              <Button
                disabled={saving}
                onClick={close}
                type="button"
                variant="brand-secondary"
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  !dirty || saving || Boolean(draft?.enabled && !complete)
                }
                type="submit"
              >
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {saving ? "Guardando" : "Guardar configuración"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
