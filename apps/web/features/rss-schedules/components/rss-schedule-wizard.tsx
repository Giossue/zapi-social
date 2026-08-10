"use client"

import { useState } from "react"

import { Check } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
import { TimePicker } from "@workspace/ui/components/time-picker"

export type RssScheduleWizardInput = {
  contentRules: {
    includeLink: boolean
    includeSummary: boolean
    template: string
  }
  feedUrl: string
  name: string
  targetSocialAccountIds: string[]
  frequency: (typeof frequencyOptions)[number][0]
  preferredTime: string
}

type RssScheduleWizardProps = {
  accounts: readonly RssScheduleTargetAccount[]
  onCreate: (schedule: RssScheduleWizardInput) => Promise<void>
  onOpenChange: (open: boolean) => void
  onValidateFeed?: (feedUrl: string) => Promise<void>
  open: boolean
}

const steps = ["Feed", "Destinos", "Contenido", "Revisar"]

export type RssScheduleTargetAccount = {
  description: string
  id: string
  label: string
}

const frequencyOptions = [
  ["daily", "Una vez al día"],
  ["weekdays", "De lunes a viernes"],
  ["weekly", "Una vez por semana"],
] as const

const defaultTemplate = "{title}\n\n{summary}\n\nLeer más: {url}"

type WizardField =
  "feedUrl" | "frequency" | "name" | "preferredTime" | "targets"
type WizardErrors = Partial<Record<WizardField, string>>

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

export function RssScheduleWizard({
  accounts,
  onCreate,
  onOpenChange,
  onValidateFeed,
  open,
}: RssScheduleWizardProps) {
  const initialTargetIds = accounts.slice(0, 2).map(({ id }) => id)
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [feedUrl, setFeedUrl] = useState("")
  const [targets, setTargets] = useState<string[]>(initialTargetIds)
  const [frequency, setFrequency] =
    useState<(typeof frequencyOptions)[number][0]>("daily")
  const [preferredTime, setPreferredTime] = useState("09:00")
  const [includeSummary, setIncludeSummary] = useState(true)
  const [template, setTemplate] = useState(defaultTemplate)
  const [errors, setErrors] = useState<WizardErrors>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function close() {
    setStep(0)
    setName("")
    setFeedUrl("")
    setTargets(initialTargetIds)
    setFrequency("daily")
    setPreferredTime("09:00")
    setIncludeSummary(true)
    setTemplate(defaultTemplate)
    setErrors({})
    setSubmitError(null)
    setIsCreating(false)
    setIsValidating(false)
    onOpenChange(false)
  }

  function clearError(field: WizardField) {
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function validateCurrentStep() {
    const nextErrors: WizardErrors = {}

    if (step === 0) {
      if (!feedUrl.trim()) {
        nextErrors.feedUrl = "Indica la URL del feed."
      } else if (!isHttpUrl(feedUrl.trim())) {
        nextErrors.feedUrl =
          "Usa una URL válida que comience con http:// o https://."
      }

      if (!name.trim())
        nextErrors.name = "Indica un nombre para identificar la programación."
    }

    if (step === 1) {
      if (!targets.length)
        nextErrors.targets = "Selecciona al menos una cuenta de destino."
      if (!frequency) nextErrors.frequency = "Selecciona una frecuencia."
      if (!preferredTime) nextErrors.preferredTime = "Indica la hora preferida."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function toggleTarget(targetId: string, checked: boolean | "indeterminate") {
    setTargets((current) =>
      checked === true
        ? [...new Set([...current, targetId])]
        : current.filter((id) => id !== targetId)
    )

    if (checked) clearError("targets")
  }

  async function continueWizard() {
    if (!validateCurrentStep()) return

    if (step === 0 && onValidateFeed) {
      setIsValidating(true)
      try {
        await onValidateFeed(feedUrl.trim())
      } catch {
        setErrors({
          feedUrl:
            "No pudimos validar este feed. Comprueba que sea público y esté disponible.",
        })
        return
      } finally {
        setIsValidating(false)
      }
    }

    if (step === steps.length - 1) {
      setIsCreating(true)
      setSubmitError(null)
      try {
        await onCreate({
          contentRules: {
            includeLink: true,
            includeSummary,
            template: template.trim() || defaultTemplate,
          },
          feedUrl: feedUrl.trim(),
          name: name.trim(),
          targetSocialAccountIds: targets,
          frequency,
          preferredTime,
        })
        close()
      } catch {
        setSubmitError(
          "No pudimos crear la programación. Comprueba los datos e inténtalo de nuevo."
        )
      } finally {
        setIsCreating(false)
      }
      return
    }

    setStep((current) => current + 1)
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      open={open}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva programación RSS</DialogTitle>
          <DialogDescription>
            Configura cómo convertir artículos nuevos de un feed en
            publicaciones para tus canales.
          </DialogDescription>
        </DialogHeader>

        <ol
          aria-label="Pasos de la programación RSS"
          className="mx-auto flex w-full max-w-lg items-start"
        >
          {steps.map((label, index) => {
            const isCurrent = index === step
            const isComplete = index < step

            return (
              <li
                className="flex min-w-0 flex-1 items-start last:flex-none"
                key={label}
              >
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full border text-xs font-medium ${
                      isCurrent || isComplete
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={`text-center text-xs ${isCurrent ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {label}
                  </span>
                </div>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`mt-3 h-px flex-1 ${index < step ? "bg-primary" : "bg-border"}`}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>

        {step === 0 ? (
          <FieldGroup>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">
                Acepta feeds RSS y Atom públicos. En la siguiente etapa
                validaremos su disponibilidad antes de activarlo.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="rss-feed-url">
                <span>
                  URL del feed{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </span>
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.feedUrl)}
                id="rss-feed-url"
                onChange={(event) => {
                  setFeedUrl(event.target.value)
                  clearError("feedUrl")
                }}
                placeholder="https://sitio.com/feed.xml"
                type="url"
                value={feedUrl}
              />
              <FieldDescription>
                Usa la URL directa del RSS, no la página principal del sitio.
              </FieldDescription>
              <FieldError>{errors.feedUrl}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="rss-schedule-name">
                <span>
                  Nombre de la programación{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </span>
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.name)}
                id="rss-schedule-name"
                onChange={(event) => {
                  setName(event.target.value)
                  clearError("name")
                }}
                placeholder="Ej. Noticias del blog"
                value={name}
              />
              <FieldDescription>
                Solo lo verá tu equipo al administrar esta automatización.
              </FieldDescription>
              <FieldError>{errors.name}</FieldError>
            </Field>
          </FieldGroup>
        ) : null}

        {step === 1 ? (
          <FieldGroup>
            <Field>
              <FieldLabel>
                <span>
                  Publicar en{" "}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </span>
              </FieldLabel>
              <FieldDescription>
                Elige las cuentas que recibirán cada artículo nuevo.
              </FieldDescription>
              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.map((account) => (
                  <Field key={account.id} orientation="horizontal">
                    <Checkbox
                      aria-invalid={Boolean(errors.targets)}
                      checked={targets.includes(account.id)}
                      id={`rss-target-${account.id}`}
                      onCheckedChange={(checked) =>
                        toggleTarget(account.id, checked)
                      }
                    />
                    <FieldContent>
                      <FieldTitle>{account.label}</FieldTitle>
                      <FieldDescription>{account.description}</FieldDescription>
                    </FieldContent>
                  </Field>
                ))}
              </div>
              {accounts.length === 0 ? (
                <FieldDescription>
                  Conecta al menos un canal antes de crear una programación.
                </FieldDescription>
              ) : null}
              <FieldError>{errors.targets}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rss-frequency">
                  <span>
                    Frecuencia{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                    <span className="sr-only"> obligatorio</span>
                  </span>
                </FieldLabel>
                <Select
                  onValueChange={(value) => {
                    setFrequency(value as (typeof frequencyOptions)[number][0])
                    clearError("frequency")
                  }}
                  value={frequency}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(errors.frequency)}
                    id="rss-frequency"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {frequencyOptions.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.frequency}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="rss-time">
                  <span>
                    Hora preferida{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                    <span className="sr-only"> obligatorio</span>
                  </span>
                </FieldLabel>
                <TimePicker
                  aria-invalid={Boolean(errors.preferredTime)}
                  aria-required={true}
                  id="rss-time"
                  onValueChange={(value) => {
                    setPreferredTime(value)
                    clearError("preferredTime")
                  }}
                  value={preferredTime}
                />
                <FieldError>{errors.preferredTime}</FieldError>
              </Field>
            </div>
          </FieldGroup>
        ) : null}

        {step === 2 ? (
          <FieldGroup>
            <Field>
              <FieldContent>
                <FieldTitle>Evitar artículos repetidos</FieldTitle>
                <FieldDescription>
                  La programación nunca volverá a enviar el mismo artículo a la
                  misma cuenta.
                </FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Switch
                checked={includeSummary}
                id="rss-include-summary"
                onCheckedChange={setIncludeSummary}
              />
              <FieldContent>
                <FieldTitle>Incluir resumen del artículo</FieldTitle>
                <FieldDescription>
                  Se usará como base del texto de la publicación.
                </FieldDescription>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="rss-template">
                Texto que acompaña cada publicación
              </FieldLabel>
              <Textarea
                id="rss-template"
                onChange={(event) => setTemplate(event.target.value)}
                rows={5}
                value={template}
              />
              <FieldDescription>
                Variables disponibles: título, resumen y enlace del artículo.
              </FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === 3 ? (
          <div className="rounded-lg border">
            <dl className="divide-y text-sm">
              <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                <dt className="text-muted-foreground">Programación</dt>
                <dd className="font-medium">{name}</dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                <dt className="text-muted-foreground">Feed</dt>
                <dd className="truncate font-medium">{feedUrl}</dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                <dt className="text-muted-foreground">Destinos</dt>
                <dd className="font-medium">
                  {accounts
                    .filter((account) => targets.includes(account.id))
                    .map((account) => account.label)
                    .join(", ")}
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                <dt className="text-muted-foreground">Publicación</dt>
                <dd className="font-medium">
                  {frequencyOptions.find(([value]) => value === frequency)?.[1]}{" "}
                  a las {preferredTime}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {submitError ? <FieldError>{submitError}</FieldError> : null}

        <DialogFooter>
          <Button onClick={close} type="button" variant="outline">
            Cancelar
          </Button>
          {step > 0 ? (
            <Button
              disabled={isCreating || isValidating}
              onClick={() => setStep((current) => current - 1)}
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
          ) : null}
          <Button
            disabled={isCreating || isValidating}
            onClick={continueWizard}
            type="button"
          >
            {isValidating
              ? "Validando..."
              : step === steps.length - 1 && isCreating
                ? "Creando..."
                : step === steps.length - 1
                  ? "Crear programación"
                  : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
