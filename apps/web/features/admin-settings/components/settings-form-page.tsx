"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, Save, ShieldCheck } from "lucide-react"

import { ApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

export type SettingsField<TValues> = {
  description?: string
  kind: "text" | "textarea" | "number" | "switch"
  label: string
  name: keyof TValues & string
  placeholder?: string
}

export function SettingsFormPage<TValues extends Record<string, unknown>>({
  description,
  fields,
  load,
  save,
  title,
}: {
  description: string
  fields: readonly SettingsField<TValues>[]
  load: () => Promise<TValues>
  save: (values: TValues) => Promise<unknown>
  title: string
}) {
  const router = useRouter()
  const [values, setValues] = useState<TValues | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [pending, setPending] = useState(false)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        return true
      }
      return false
    },
    [router]
  )

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      setValues(await load())
      setForbidden(false)
    } catch (error) {
      if (handleError(error)) return
      console.error(`${title} request failed`, error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [handleError, load, title])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!values) return
    setPending(true)
    try {
      await save(values)
      toast.success("Ajustes guardados.")
    } catch (error) {
      if (handleError(error)) return
      console.error(`${title} save failed`, error)
      toast.error("No pudimos guardar los ajustes. Inténtalo de nuevo.")
    } finally {
      setPending(false)
    }
  }

  if (forbidden) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            description="Solicita a un administrador el permiso necesario para cambiar estos ajustes."
            icon={ShieldCheck}
            title={`${title} no disponible`}
          />
        </CardContent>
      </Card>
    )
  }

  if (isLoading && !values) {
    return <PageLoading aria-label={`Cargando ${title.toLowerCase()}`} />
  }

  if (loadError || !values) {
    return (
      <Card variant="subtle">
        <CardContent>
          <EmptyState
            action={
              <RetryButton
                onClick={() => void refresh()}
                variant="brand-secondary"
              />
            }
            description="No pudimos cargar estos ajustes."
            icon={CircleAlert}
            title={`${title} no disponible`}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader description={description} title={title} />
      <form
        aria-busy={pending}
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Card variant="subtle">
          <CardContent className="py-4">
            <FieldGroup>
              {fields.map((field) => {
                const controlId = `setting-${field.name}`
                const value = values[field.name]

                if (field.kind === "switch") {
                  return (
                    <Field key={field.name} orientation="horizontal">
                      <Switch
                        checked={Boolean(value)}
                        disabled={pending}
                        id={controlId}
                        onCheckedChange={(checked) =>
                          setValues({ ...values, [field.name]: checked })
                        }
                      />
                      <FieldLabel htmlFor={controlId}>
                        <FieldContent>
                          <FieldTitle>{field.label}</FieldTitle>
                          {field.description ? (
                            <FieldDescription>
                              {field.description}
                            </FieldDescription>
                          ) : null}
                        </FieldContent>
                      </FieldLabel>
                    </Field>
                  )
                }

                return (
                  <Field key={field.name}>
                    <FieldLabel htmlFor={controlId}>{field.label}</FieldLabel>
                    {field.kind === "textarea" ? (
                      <Textarea
                        disabled={pending}
                        id={controlId}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            [field.name]: event.target.value,
                          })
                        }
                        placeholder={field.placeholder}
                        rows={4}
                        value={String(value ?? "")}
                      />
                    ) : (
                      <Input
                        disabled={pending}
                        id={controlId}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            [field.name]:
                              field.kind === "number"
                                ? Number(event.target.value) || 0
                                : event.target.value,
                          })
                        }
                        placeholder={field.placeholder}
                        type={field.kind === "number" ? "number" : "text"}
                        value={String(value ?? "")}
                      />
                    )}
                    {field.description ? (
                      <FieldDescription>{field.description}</FieldDescription>
                    ) : null}
                  </Field>
                )
              })}
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button disabled={pending} type="submit">
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
