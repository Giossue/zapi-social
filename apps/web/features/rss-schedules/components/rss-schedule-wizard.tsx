"use client"

import { useState } from "react"

import { ArrowRight, Check, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Field,
  FieldContent,
  FieldDescription,
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
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { TimePicker } from "@workspace/ui/components/time-picker"
import { toast } from "@workspace/ui/components/toast"
import { useTranslations } from "next-intl"

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

const stepKeys = ["feed", "targets", "content", "review"] as const

export type RssScheduleTargetAccount = {
  description: string
  id: string
  label: string
}

const frequencyOptions = [
  ["daily", "frequency.daily"],
  ["weekdays", "frequency.weekdays"],
  ["weekly", "frequency.weekly"],
] as const

const defaultTemplate = "{title}\n\n{summary}\n\nLeer más: {url}"

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
  const t = useTranslations("rssSchedules.wizard")
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
  const [isCreating, setIsCreating] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const isPending = isCreating || isValidating
  const isLastStep = step === stepKeys.length - 1
  const feedStepComplete = Boolean(feedUrl.trim() && name.trim())
  const destinationStepComplete = Boolean(
    targets.length && frequency && preferredTime
  )
  const canContinue =
    (step !== 0 || feedStepComplete) && (step !== 1 || destinationStepComplete)
  let primaryIcon = <ArrowRight data-icon="inline-start" />
  let primaryLabel = t("continue")

  if (isLastStep) {
    primaryIcon = <Plus data-icon="inline-start" />
    primaryLabel = t("create")
  }

  if (isCreating) {
    primaryIcon = <Spinner data-icon="inline-start" />
    primaryLabel = t("creating")
  }

  if (isValidating) {
    primaryIcon = <Spinner data-icon="inline-start" />
    primaryLabel = t("validating")
  }

  function close() {
    setStep(0)
    setName("")
    setFeedUrl("")
    setTargets(initialTargetIds)
    setFrequency("daily")
    setPreferredTime("09:00")
    setIncludeSummary(true)
    setTemplate(defaultTemplate)
    setIsCreating(false)
    setIsValidating(false)
    onOpenChange(false)
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!feedUrl.trim() || !name.trim()) {
        toast.error(t("missingFields"))
        return false
      }

      if (!isHttpUrl(feedUrl.trim())) {
        toast.error(t("invalidUrl"))
        return false
      }
    }

    if (step === 1 && (!targets.length || !frequency || !preferredTime)) {
      toast.error(t("missingFields"))
      return false
    }

    return true
  }

  function toggleTarget(targetId: string, checked: boolean | "indeterminate") {
    setTargets((current) =>
      checked === true
        ? [...new Set([...current, targetId])]
        : current.filter((id) => id !== targetId)
    )
  }

  async function continueWizard() {
    if (!validateCurrentStep()) return

    if (step === 0 && onValidateFeed) {
      setIsValidating(true)
      try {
        await onValidateFeed(feedUrl.trim())
      } catch {
        toast.error(t("validationFailed"))
        return
      } finally {
        setIsValidating(false)
      }
    }

    if (step === stepKeys.length - 1) {
      setIsCreating(true)
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
        toast.error(t("createFailed"))
      } finally {
        setIsCreating(false)
      }
      return
    }

    setStep((current) => current + 1)
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      open={open}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl" side="right">
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void continueWizard()
          }}
        >
          <SheetHeader className="border-b">
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <ol
              aria-label={t("stepsLabel")}
              className="mx-auto flex w-full max-w-lg items-start"
            >
              {stepKeys.map((stepKey, index) => {
                const isCurrent = index === step
                const isComplete = index < step

                return (
                  <li
                    className="flex min-w-0 flex-1 items-start last:flex-none"
                    key={stepKey}
                  >
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      <span
                        className={`flex size-6 items-center justify-center rounded-full border text-xs font-medium ${
                          isCurrent || isComplete
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {isComplete ? (
                          <Check className="size-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span
                        className={`text-center text-xs ${isCurrent ? "font-medium" : "text-muted-foreground"}`}
                      >
                        {t(`step.${stepKey}`)}
                      </span>
                    </div>
                    {index < stepKeys.length - 1 ? (
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
                <Card size="sm" variant="inset">
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t("feedHint")}
                    </p>
                  </CardContent>
                </Card>
                <Field>
                  <FieldLabel htmlFor="rss-feed-url">
                    <span>
                      {t("feedUrl")}{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                      <span className="sr-only"> {t("required")}</span>
                    </span>
                  </FieldLabel>
                  <Input
                    aria-required="true"
                    id="rss-feed-url"
                    onChange={(event) => setFeedUrl(event.target.value)}
                    placeholder={t("feedUrlPlaceholder")}
                    type="url"
                    value={feedUrl}
                  />
                  <FieldDescription>{t("feedUrlHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rss-schedule-name">
                    <span>
                      {t("name")}{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                      <span className="sr-only"> {t("required")}</span>
                    </span>
                  </FieldLabel>
                  <Input
                    aria-required="true"
                    id="rss-schedule-name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("namePlaceholder")}
                    value={name}
                  />
                  <FieldDescription>{t("nameHint")}</FieldDescription>
                </Field>
              </FieldGroup>
            ) : null}

            {step === 1 ? (
              <FieldGroup>
                <Field
                  aria-labelledby="rss-targets-label"
                  aria-required="true"
                  role="group"
                >
                  <FieldLabel id="rss-targets-label">
                    <span>
                      {t("publishTo")}{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                      <span className="sr-only"> {t("required")}</span>
                    </span>
                  </FieldLabel>
                  <FieldDescription>{t("publishToHint")}</FieldDescription>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {accounts.map((account) => (
                      <Field key={account.id} orientation="horizontal">
                        <Checkbox
                          checked={targets.includes(account.id)}
                          id={`rss-target-${account.id}`}
                          onCheckedChange={(checked) =>
                            toggleTarget(account.id, checked)
                          }
                        />
                        <FieldContent>
                          <FieldTitle>{account.label}</FieldTitle>
                          <FieldDescription>
                            {account.description}
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    ))}
                  </div>
                  {accounts.length === 0 ? (
                    <FieldDescription>{t("noAccounts")}</FieldDescription>
                  ) : null}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="rss-frequency">
                      <span>
                        {t("frequencyLabel")}{" "}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                        <span className="sr-only"> {t("required")}</span>
                      </span>
                    </FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        setFrequency(
                          value as (typeof frequencyOptions)[number][0]
                        )
                      }
                      value={frequency}
                    >
                      <SelectTrigger aria-required="true" id="rss-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {frequencyOptions.map(([value, labelKey]) => (
                            <SelectItem key={value} value={value}>
                              {t(labelKey)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rss-time">
                      <span>
                        {t("preferredTime")}{" "}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                        <span className="sr-only"> {t("required")}</span>
                      </span>
                    </FieldLabel>
                    <TimePicker
                      aria-required={true}
                      id="rss-time"
                      onValueChange={setPreferredTime}
                      value={preferredTime}
                    />
                  </Field>
                </div>
              </FieldGroup>
            ) : null}

            {step === 2 ? (
              <FieldGroup>
                <Field>
                  <FieldContent>
                    <FieldTitle>{t("avoidRepeats")}</FieldTitle>
                    <FieldDescription>{t("avoidRepeatsHint")}</FieldDescription>
                  </FieldContent>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    checked={includeSummary}
                    id="rss-include-summary"
                    onCheckedChange={setIncludeSummary}
                  />
                  <FieldContent>
                    <FieldTitle>{t("includeSummary")}</FieldTitle>
                    <FieldDescription>
                      {t("includeSummaryHint")}
                    </FieldDescription>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rss-template">
                    {t("template")}
                  </FieldLabel>
                  <Textarea
                    id="rss-template"
                    onChange={(event) => setTemplate(event.target.value)}
                    rows={5}
                    value={template}
                  />
                  <FieldDescription>{t("templateHint")}</FieldDescription>
                </Field>
              </FieldGroup>
            ) : null}

            {step === 3 ? (
              <Card size="sm" variant="inset">
                <CardContent className="px-0">
                  <dl className="divide-y text-sm">
                    <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                      <dt className="text-muted-foreground">
                        {t("reviewSchedule")}
                      </dt>
                      <dd className="font-medium">{name}</dd>
                    </div>
                    <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                      <dt className="text-muted-foreground">
                        {t("step.feed")}
                      </dt>
                      <dd className="truncate font-medium">{feedUrl}</dd>
                    </div>
                    <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                      <dt className="text-muted-foreground">
                        {t("step.targets")}
                      </dt>
                      <dd className="font-medium">
                        {accounts
                          .filter((account) => targets.includes(account.id))
                          .map((account) => account.label)
                          .join(", ")}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[9rem_1fr] gap-4 p-3">
                      <dt className="text-muted-foreground">
                        {t("reviewPublishing")}
                      </dt>
                      <dd className="font-medium">
                        {t(
                          frequencyOptions.find(
                            ([value]) => value === frequency
                          )?.[1] ?? "frequency.daily"
                        )}{" "}
                        {t("atTime", { time: preferredTime })}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <SheetActions>
            <Button
              disabled={isPending}
              onClick={close}
              type="button"
              variant="brand-secondary"
            >
              {t("cancel")}
            </Button>
            {step > 0 ? (
              <Button
                disabled={isPending}
                onClick={() => setStep((current) => current - 1)}
                type="button"
                variant="brand-secondary"
              >
                {t("previous")}
              </Button>
            ) : null}
            <Button disabled={!canContinue || isPending} type="submit">
              {primaryIcon}
              {primaryLabel}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}
