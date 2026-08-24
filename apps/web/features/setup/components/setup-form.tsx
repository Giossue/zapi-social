"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { AlertCircle } from "lucide-react"
import { createSetupAdminSchema } from "@workspace/contracts"
import { ApiError, authApi, setupApi } from "@workspace/api-client"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

export function SetupForm() {
  const t = useTranslations("setup")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "")
    if (password !== passwordConfirmation) {
      setError(t("error.passwordMismatch"))
      return
    }
    const input = {
      displayName: String(form.get("displayName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }
    if (!createSetupAdminSchema.safeParse(input).success) {
      setError(t("error.validation"))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await setupApi.createAdmin(input)
      await authApi.login({
        email: input.email,
        password: input.password,
        remember: false,
      })
      router.replace("/admin/dashboard")
      router.refresh()
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.code === "SETUP_ALREADY_COMPLETED"
      ) {
        setError(t("error.alreadyCompleted"))
      } else if (
        caught instanceof ApiError &&
        caught.code === "AUTH_PASSWORD_POLICY_NOT_MET"
      ) {
        setError(t("error.passwordPolicy"))
      } else {
        setError(t("error.failed"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="w-full max-w-md" onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{t("error.title")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="setup-name">{t("name")}</FieldLabel>
              <Input
                id="setup-name"
                name="displayName"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-email">{t("email")}</FieldLabel>
              <Input
                id="setup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-password">{t("password")}</FieldLabel>
              <Input
                id="setup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <FieldDescription>{t("passwordHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-password-confirmation">
                {t("passwordConfirmation")}
              </FieldLabel>
              <Input
                id="setup-password-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled={submitting} type="submit">
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
