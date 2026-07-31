'use client'

import { ApiError, integrationsApi } from '@workspace/api-client'
import type { UpdateProviderIntegrationInput } from '@workspace/contracts'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@workspace/ui/components/dialog'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { Input } from '@workspace/ui/components/input'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Switch } from '@workspace/ui/components/switch'
import { toast } from '@workspace/ui/components/toast'
import { CheckCircle2, CircleAlert, PlugZap, Settings2, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { IntegrationProvider, IntegrationStatus } from '../types/integrations'

const statusCopy: Record<IntegrationStatus, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  ready: { label: 'Listo', variant: 'success' },
  incomplete: { label: 'Incompleto', variant: 'warning' },
  disabled: { label: 'Deshabilitado', variant: 'neutral' },
}

const updateErrorMessages: Record<string, string> = {
  AUTH_WORKSPACE_UNAVAILABLE: 'No tienes permiso para administrar integraciones.',
  VALIDATION_FAILED: 'Revisa los datos de configuración e inténtalo de nuevo.',
}

export function IntegrationsPage() {
  const router = useRouter()
  const [providers, setProviders] = useState<IntegrationProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [updatingProviderKey, setUpdatingProviderKey] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)

    try {
      setProviders(await integrationsApi.list())
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_SESSION_EXPIRED') {
        router.replace('/login')
        return
      }

      console.error('Integrations request failed', error)
      toast.error('No pudimos cargar las integraciones. Inténtalo de nuevo.')
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const updateProvider = useCallback(async (
    provider: IntegrationProvider,
    input: UpdateProviderIntegrationInput,
    successMessage: string,
  ) => {
    setUpdatingProviderKey(provider.providerKey)

    try {
      const updatedProvider = await integrationsApi.update(provider.providerKey, input)
      setProviders((current) => current.map((item) => (
        item.providerKey === updatedProvider.providerKey ? updatedProvider : item
      )))
      setSelectedProvider((current) => (
        current?.providerKey === updatedProvider.providerKey ? updatedProvider : current
      ))
      toast.success(successMessage)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_SESSION_EXPIRED') {
        router.replace('/login')
        return false
      }

      console.error('Integration update failed', error)
      toast.error(
        error instanceof ApiError
          ? (updateErrorMessages[error.code] ?? 'No pudimos guardar la integración. Inténtalo de nuevo.')
          : 'No pudimos guardar la integración. Inténtalo de nuevo.',
      )
      return false
    } finally {
      setUpdatingProviderKey(null)
    }
  }, [router])

  async function toggleProvider(provider: IntegrationProvider, enabled: boolean) {
    await updateProvider(
      provider,
      { enabled },
      enabled ? 'Proveedor habilitado.' : 'Proveedor deshabilitado.',
    )
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProvider) return

    const values = new FormData(event.currentTarget)
    const configuration: Record<string, string> = {}

    for (const field of selectedProvider.configurationFields) {
      const value = values.get(field.key)
      if (typeof value !== 'string' || !value.trim()) {
        toast.error(`Ingresa ${field.label}.`)
        return
      }
      configuration[field.key] = value.trim()
    }

    const saved = await updateProvider(
      selectedProvider,
      { enabled: selectedProvider.enabled, configuration },
      'Configuración guardada de forma segura.',
    )

    if (saved) {
      event.currentTarget.reset()
      setSelectedProvider(null)
    }
  }

  if (isLoading) return <IntegrationsLoading />

  if (hasError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="No pudimos cargar las integraciones"
        description="Comprueba tu conexión e inténtalo de nuevo."
        action={<Button onClick={() => void loadProviders()}>Reintentar</Button>}
      />
    )
  }

  if (providers.length === 0) {
    return (
      <EmptyState
        icon={PlugZap}
        title="No hay proveedores configurables"
        description="Vuelve a intentarlo más tarde o contacta al equipo de plataforma."
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card variant="surface">
        <CardHeader>
          <CardTitle>Proveedores de canales</CardTitle>
          <CardDescription>
            Configura qué proveedores pueden conectarse desde los workspaces. Los secretos no se muestran después de guardarlos.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Proveedores configurables">
        {providers.map((provider) => {
          const status = statusCopy[provider.readiness]
          const StatusIcon = provider.readiness === 'ready' ? CheckCircle2 : CircleAlert
          const isUpdating = updatingProviderKey === provider.providerKey

          return (
            <Card key={provider.providerKey} variant="surface" className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="flex items-center gap-2"><PlugZap className="size-4 text-muted-foreground" />{provider.label}</CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </div>
                <Badge variant={status.variant}><StatusIcon aria-hidden="true" />{status.label}</Badge>
              </CardHeader>
              <CardContent className="mt-auto space-y-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{provider.capabilities.join(' · ')}</p>
                  <p>{provider.configuredFields} de {provider.requiredFields} campos configurados</p>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm font-medium">Habilitado</span>
                  <Switch
                    aria-label={`Habilitar ${provider.label}`}
                    checked={provider.enabled}
                    disabled={isUpdating}
                    onCheckedChange={(enabled) => void toggleProvider(provider, enabled)}
                  />
                </div>
                <Dialog
                  onOpenChange={(open) => setSelectedProvider(open ? provider : null)}
                  open={selectedProvider?.providerKey === provider.providerKey}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="brand-secondary"><Settings2 data-icon="inline-start" />Configurar</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configurar {provider.label}</DialogTitle>
                      <DialogDescription>
                        Los secretos se envían una sola vez, se cifran al guardarse y nunca se devuelven al navegador.
                      </DialogDescription>
                    </DialogHeader>
                    <form className="grid gap-4" onSubmit={saveConfiguration}>
                      {provider.configurationFields.map((field) => (
                        <label key={field.key} className="grid gap-1.5 text-sm font-medium">
                          {field.label}
                          <Input
                            autoComplete={field.secret ? 'new-password' : 'off'}
                            disabled={isUpdating}
                            name={field.key}
                            required
                            type={field.secret ? 'password' : 'text'}
                          />
                        </label>
                      ))}
                      <Button disabled={isUpdating} type="submit">
                        {isUpdating ? 'Guardando…' : 'Guardar configuración'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </div>
  )
}

function IntegrationsLoading() {
  return (
    <div className="space-y-6" aria-label="Cargando integraciones" aria-busy="true">
      <Card variant="surface">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Card key={index} variant="surface">
            <CardHeader className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
