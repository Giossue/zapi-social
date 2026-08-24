"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { CircleAlert, CircleCheck, PlugZap, Save } from "lucide-react"

import { ApiError, integrationsApi } from "@workspace/api-client"
import type { ChannelProviderIntegration } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { useApiErrorMessage } from "@/lib/api-error-message"
import { useChannelLabels } from "@/lib/channel-labels"

import { IntegrationInsetCard } from "./integration-inset-card"

const readinessVariants = {
  disabled: "neutral",
  incomplete: "warning",
  untested: "warning",
  ready: "success",
} as const

/**
 * Pantalla de un proveedor de canal, pintada desde su definición.
 *
 * No sabe de qué red se trata: los campos, sus tipos y sus capabilities vienen
 * del catálogo. Añadir una red no toca este archivo.
 */
export function ChannelProviderIntegrationCard({
  onSaved,
  provider,
}: {
  onSaved: (provider: ChannelProviderIntegration) => void
  provider: ChannelProviderIntegration
}) {
  const t = useTranslations("integrations.channelProvider")
  const tIssue = useTranslations("integrations.issue")
  const labels = useChannelLabels()
  const apiErrorMessage = useApiErrorMessage()

  const [enabled, setEnabled] = useState(provider.enabled)
  const [values, setValues] = useState<Record<string, string>>(provider.values)
  const [capabilityKeys, setCapabilityKeys] = useState<string[]>(() =>
    provider.capabilities
      .filter((capability) => capability.enabled)
      .map((capability) => capability.key)
  )
  const [pending, setPending] = useState(false)
  const [tested, setTested] = useState(provider.readiness === "ready")

  const [firstIssue] = provider.issues
  const editableFields = provider.definition.fields.filter(
    (field) => !field.readOnly
  )
  const missingRequired = editableFields.some(
    (field) =>
      field.required &&
      !values[field.key]?.trim() &&
      !provider.secretsConfigured.includes(field.key)
  )

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    // Cambiar una credencial invalida la prueba: la API hace lo mismo al
    // guardar, y aquí se refleja para que el botón no mienta.
    setTested(false)
  }

  function toggleCapability(key: string, checked: boolean) {
    setCapabilityKeys((current) =>
      checked
        ? [...new Set([...current, key])]
        : current.filter((value) => value !== key)
    )
  }

  async function test() {
    setPending(true)
    try {
      const result = await integrationsApi.testChannelProvider(
        provider.providerKey,
        { values: editableValues() }
      )
      setTested(result.ok)
      if (result.ok) {
        toast.success(t("testPassed"))
      } else {
        toast.error(tIssue(result.issue ?? "unknown"))
      }
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(false)
    }
  }

  function editableValues() {
    return Object.fromEntries(
      editableFields.map((field) => [field.key, values[field.key] ?? ""])
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      onSaved(
        await integrationsApi.saveChannelProvider(provider.providerKey, {
          enabled,
          values: editableValues(),
          enabledCapabilityKeys: capabilityKeys as never,
        })
      )
      toast.success(t("saved"))
    } catch (error) {
      toast.error(
        apiErrorMessage(error instanceof ApiError ? error.code : undefined)
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card variant="subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {labels.provider(provider.providerKey)}
          <Badge variant={readinessVariants[provider.readiness]}>
            {t(`readiness.${provider.readiness}`)}
          </Badge>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          aria-busy={pending}
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          {firstIssue ? (
            <IntegrationInsetCard>
              <p className="flex items-center gap-2 text-sm text-warning">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                {tIssue(firstIssue)}
              </p>
            </IntegrationInsetCard>
          ) : null}

          <Field orientation="horizontal">
            <Switch
              checked={enabled}
              disabled={pending}
              id={`provider-${provider.providerKey}-enabled`}
              onCheckedChange={setEnabled}
            />
            <FieldLabel htmlFor={`provider-${provider.providerKey}-enabled`}>
              <FieldContent>
                <FieldTitle>{t("enabled")}</FieldTitle>
                <FieldDescription>{t("enabledHint")}</FieldDescription>
              </FieldContent>
            </FieldLabel>
          </Field>

          <FieldGroup>
            {provider.definition.fields.map((field) => {
              const controlId = `provider-${provider.providerKey}-${field.key}`
              const configured = provider.secretsConfigured.includes(field.key)
              return (
                <Field key={field.key}>
                  <FieldLabel htmlFor={controlId}>
                    {t(`field.${field.key}`)}
                    {field.required ? (
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    ) : null}
                  </FieldLabel>
                  {field.type === "textarea" ? (
                    <Textarea
                      disabled={pending || field.readOnly}
                      id={controlId}
                      maxLength={field.maxLength ?? undefined}
                      onChange={(event) =>
                        update(field.key, event.target.value)
                      }
                      rows={3}
                      value={values[field.key] ?? ""}
                    />
                  ) : (
                    <Input
                      aria-required={field.required}
                      disabled={pending || field.readOnly}
                      id={controlId}
                      maxLength={field.maxLength ?? undefined}
                      onChange={(event) =>
                        update(field.key, event.target.value)
                      }
                      placeholder={configured ? t("secretConfigured") : ""}
                      readOnly={field.readOnly}
                      type={field.type === "secret" ? "password" : "text"}
                      value={values[field.key] ?? ""}
                    />
                  )}
                  {field.readOnly ? (
                    <FieldDescription>{t("readOnlyHint")}</FieldDescription>
                  ) : null}
                </Field>
              )
            })}
          </FieldGroup>

          {provider.capabilities.length ? (
            <FieldSet data-disabled={pending}>
              <FieldLegend variant="label">{t("capabilities")}</FieldLegend>
              <FieldDescription>{t("capabilitiesHint")}</FieldDescription>
              <FieldGroup className="gap-3" data-slot="checkbox-group">
                {provider.capabilities.map((capability) => {
                  const controlId = `provider-capability-${capability.key}`
                  return (
                    <Field key={capability.key} orientation="horizontal">
                      <Checkbox
                        checked={capabilityKeys.includes(capability.key)}
                        disabled={pending}
                        id={controlId}
                        onCheckedChange={(value) =>
                          toggleCapability(capability.key, value === true)
                        }
                      />
                      <FieldLabel htmlFor={controlId}>
                        <FieldContent>
                          <FieldTitle>
                            {labels.capability(capability.key)}
                          </FieldTitle>
                        </FieldContent>
                      </FieldLabel>
                    </Field>
                  )
                })}
              </FieldGroup>
            </FieldSet>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={pending || missingRequired}
              onClick={() => void test()}
              type="button"
              variant="brand-secondary"
            >
              {pending ? (
                <Spinner data-icon="inline-start" size={16} />
              ) : (
                <PlugZap aria-hidden="true" data-icon="inline-start" />
              )}
              {t("test")}
            </Button>
            <Button
              // Activar un proveedor sin prueba vigente abriría el canal en el
              // Portal sin saber si las credenciales sirven.
              disabled={pending || missingRequired || (enabled && !tested)}
              type="submit"
            >
              {pending ? (
                <Spinner data-icon="inline-start" size={16} />
              ) : (
                <Save aria-hidden="true" data-icon="inline-start" />
              )}
              {t("save")}
            </Button>
          </div>

          {tested ? (
            <p className="flex items-center justify-end gap-2 text-sm text-success">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t("testPassed")}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
