"use client"

import { useBranding } from "@/components/branding-provider"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { createSetupAdminSchema } from "@workspace/contracts"
import { ApiError, authApi, setupApi } from "@workspace/api-client"
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
import { toast } from "@workspace/ui/components/toast"

export function SetupForm() {
  const t = useTranslations("setup")
  const { siteName } = useBranding()
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const complete = Boolean(
    displayName.trim() && email.trim() && password && passwordConfirmation
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== passwordConfirmation) {
      toast.error(t("error.passwordMismatch"))
      return
    }
    const input = {
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }
    if (!createSetupAdminSchema.safeParse(input).success) {
      toast.error(t("error.validation"))
      return
    }

    setSubmitting(true)
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
        toast.error(t("error.alreadyCompleted"))
      } else if (
        caught instanceof ApiError &&
        caught.code === "AUTH_PASSWORD_POLICY_NOT_MET"
      ) {
        toast.error(t("error.passwordPolicy"))
      } else {
        toast.error(t("error.failed"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="w-full max-w-md" noValidate onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t("title", { brand: siteName })}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="setup-name">{t("name")}</FieldLabel>
              <Input
                id="setup-name"
                name="displayName"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
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
                onChange={(event) => setEmail(event.target.value)}
                required
                value={email}
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
                onChange={(event) => setPassword(event.target.value)}
                required
                value={password}
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
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                required
                value={passwordConfirmation}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            disabled={!complete || submitting}
            type="submit"
          >
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
