"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent, type ReactNode } from "react"

import { AuthShell } from "./auth-page"
import { loginPath } from "@/features/identity/login-redirect"

function RecoveryLayout({
  children,
  title,
  description,
}: {
  children: ReactNode
  title: string
  description: string
}) {
  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </AuthShell>
  )
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth.recovery")
  const tForm = useTranslations("auth.form")
  const tValidation = useTranslations("auth.validation")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  function reportError(message: string) {
    toast.error(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!emailValid) {
      reportError(tValidation("email"))
      return
    }

    setSubmitting(true)
    try {
      await authApi.requestPasswordReset({ email: email.trim() })
      setSent(true)
    } catch {
      reportError(t("requestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RecoveryLayout
      description={t("requestDescription")}
      title={t("requestTitle")}
    >
      {sent ? (
        <div className="flex flex-col gap-5">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-success"
            />
            {t("sentNotice")}
          </p>
          <Button asChild className="w-full" variant="brand-secondary">
            <Link href="/login">{t("backToLogin")}</Link>
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
          <FieldGroup>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="recovery-email">
                {tForm("email")}{" "}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    <Mail aria-hidden="true" />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  aria-required="true"
                  autoComplete="email"
                  id="recovery-email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </InputGroup>
            </Field>
          </FieldGroup>
          <Button
            className="w-full"
            disabled={!emailValid || submitting}
            type="submit"
          >
            {submitting ? (
              <Spinner aria-label={t("sending")} data-icon="inline-start" />
            ) : (
              <Mail data-icon="inline-start" />
            )}
            {submitting ? t("sending") : t("submitRequest")}
          </Button>
          <Link
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/login"
          >
            {t("backToLogin")}
          </Link>
        </form>
      )}
    </RecoveryLayout>
  )
}

export function ResetPasswordForm() {
  const t = useTranslations("auth.recovery")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const passwordComplete =
    password.length >= 8 && password === passwordConfirmation

  function reportError(message: string) {
    toast.error(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      reportError(t("invalidToken"))
      return
    }
    if (password.length < 8 || password !== passwordConfirmation) {
      reportError(t("checkPassword"))
      return
    }

    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset({
        token,
        password,
        passwordConfirmation,
      })
      setCompleted(true)
      toast.success(t("resetSuccess"))
      router.replace(loginPath())
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "AUTH_PASSWORD_RESET_TOKEN_INVALID"
      ) {
        reportError(t("expiredToken"))
      } else if (
        error instanceof ApiError &&
        error.code === "AUTH_PASSWORD_POLICY_NOT_MET"
      ) {
        reportError(t("resetPolicyFailed"))
      } else {
        reportError(t("resetFailed"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <RecoveryLayout
        description={t("invalidLinkDescription")}
        title={t("invalidLinkTitle")}
      >
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t("requestNewLink")}</Link>
        </Button>
      </RecoveryLayout>
    )
  }

  if (completed) {
    return (
      <RecoveryLayout
        description={t("completedDescription")}
        title={t("completedTitle")}
      >
        <Button asChild className="w-full">
          <Link href="/login">{t("login")}</Link>
        </Button>
      </RecoveryLayout>
    )
  }

  return (
    <RecoveryLayout description={t("resetDescription")} title={t("resetTitle")}>
      <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="reset-password">
              {t("newPassword")}{" "}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <KeyRound aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="new-password"
                aria-required="true"
                id="reset-password"
                maxLength={128}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </InputGroup>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="reset-password-confirmation">
              {t("confirmPassword")}{" "}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <KeyRound aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="new-password"
                aria-required="true"
                id="reset-password-confirmation"
                maxLength={128}
                name="passwordConfirmation"
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                type="password"
                value={passwordConfirmation}
              />
            </InputGroup>
          </Field>
        </FieldGroup>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("policyHint")}
        </p>
        <Button
          className="w-full"
          disabled={!passwordComplete || submitting}
          type="submit"
        >
          {submitting ? (
            <Spinner aria-label={t("updating")} data-icon="inline-start" />
          ) : (
            <KeyRound data-icon="inline-start" />
          )}
          {submitting ? t("updating") : t("submitReset")}
        </Button>
      </form>
    </RecoveryLayout>
  )
}
