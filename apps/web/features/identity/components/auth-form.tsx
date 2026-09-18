"use client"

import { ApiError, authApi } from "@workspace/api-client"
import type { PublicTurnstileConfiguration } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  Check,
  Eye,
  EyeOff,
  LogIn,
  LockKeyhole,
  Mail,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"

import {
  getAreaDestination,
  getSessionArea,
} from "@/features/identity/session-area"
import { syncLocaleCookie } from "@/i18n/locale-cookie"
import { useApiErrorMessage } from "@/lib/api-error-message"
import { TurnstileWidget } from "./turnstile-widget"

export type AuthMode = "login" | "register"

const suggestedTimeZones = [
  "America/Guayaquil",
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
]

const availableTimeZones = [
  ...new Set([
    ...suggestedTimeZones,
    ...(typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : []),
  ]),
].sort((first, second) => first.localeCompare(second))

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

function passwordMeetsPolicy(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" "}
      *
    </span>
  )
}

type PasswordRequirementProps = {
  fulfilled: boolean
  children: string
}

function PasswordRequirement({
  fulfilled,
  children,
}: PasswordRequirementProps) {
  const Icon = fulfilled ? Check : X

  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon
        aria-hidden="true"
        className={fulfilled ? "size-3.5 text-success" : "size-3.5"}
      />
      {children}
    </li>
  )
}

export function AuthForm({
  initialMode,
  returnTo,
}: {
  initialMode: AuthMode
  returnTo?: string
}) {
  const router = useRouter()
  const t = useTranslations("auth.form")
  const tValidation = useTranslations("auth.validation")
  const tPolicy = useTranslations("auth.passwordPolicy")
  const apiErrorMessage = useApiErrorMessage()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [timezone, setTimezone] = useState(() =>
    initialMode === "register" ? browserTimeZone() : ""
  )
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false)
  const [turnstile, setTurnstile] =
    useState<PublicTurnstileConfiguration | null>(null)
  const [turnstileLoading, setTurnstileLoading] = useState(true)
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false)
  const [turnstileWidgetFailed, setTurnstileWidgetFailed] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const isLogin = initialMode === "login"

  useEffect(() => {
    let active = true
    void authApi
      .turnstileConfiguration()
      .then((configuration) => {
        if (!active) return
        setTurnstile(configuration)
      })
      .catch((error: unknown) => {
        if (!active) return
        setTurnstileLoadFailed(true)
        if (error instanceof ApiError && error.status >= 500) {
          console.error("Turnstile configuration request failed", {
            code: error.code,
            requestId: error.requestId,
          })
        }
        toast.error(tValidation("captchaUnavailable"))
      })
      .finally(() => {
        if (active) setTurnstileLoading(false)
      })
    return () => {
      active = false
    }
  }, [tValidation])

  const onTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token)
    if (token) setTurnstileWidgetFailed(false)
  }, [])

  const onTurnstileError = useCallback(() => {
    setTurnstileToken("")
    setTurnstileWidgetFailed(true)
    toast.error(tValidation("captchaUnavailable"))
  }, [tValidation])

  const captchaComplete = Boolean(
    !turnstileLoading &&
    !turnstileLoadFailed &&
    !turnstileWidgetFailed &&
    (!turnstile?.enabled || turnstileToken)
  )

  const formComplete = isLogin
    ? Boolean(email.trim() && password && captchaComplete)
    : Boolean(
        displayName.trim() &&
        email.trim() &&
        password &&
        passwordConfirmation &&
        timezone &&
        captchaComplete
      )

  function reportError(message: string) {
    toast.error(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reportError(tValidation("email"))
      return
    }
    if (!password) {
      reportError(tValidation("password"))
      return
    }
    if (turnstile?.enabled && !turnstileToken) {
      reportError(tValidation("captcha"))
      return
    }
    if (!isLogin) {
      if (!displayName.trim()) {
        reportError(tValidation("name"))
        return
      }
      if (!timezone) {
        reportError(tValidation("timezone"))
        return
      }
      if (!passwordMeetsPolicy(password)) {
        reportError(tValidation("passwordPolicy"))
        return
      }
      if (password !== passwordConfirmation) {
        reportError(tValidation("passwordMismatch"))
        return
      }
    }

    setIsSubmitting(true)
    try {
      const session = isLogin
        ? await authApi.login({
            email,
            password,
            remember: form.get("remember") === "on",
            ...(turnstile?.enabled ? { turnstileToken } : {}),
          })
        : await authApi.register({
            displayName,
            email: email.trim(),
            password,
            timezone,
            ...(turnstile?.enabled ? { turnstileToken } : {}),
          })
      const area = getSessionArea(session)
      if (!area) {
        reportError(tValidation("missingArea"))
        return
      }
      syncLocaleCookie(session.user.locale)
      const areaPrefix = area === "admin" ? "/admin" : "/portal"
      const destination =
        returnTo &&
        (returnTo === areaPrefix || returnTo.startsWith(`${areaPrefix}/`))
          ? returnTo
          : getAreaDestination(area)
      router.replace(destination)
      router.refresh()
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (
          caught.code === "AUTH_CAPTCHA_INVALID" ||
          caught.code === "AUTH_CAPTCHA_UNAVAILABLE"
        ) {
          setTurnstileResetKey((current) => current + 1)
        }
        if (caught.status >= 500) {
          console.error("Auth request failed", {
            code: caught.code,
            requestId: caught.requestId,
          })
        }
        reportError(apiErrorMessage(caught.code))
      } else {
        console.error("Auth request failed", caught)
        reportError(apiErrorMessage())
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
      <FieldGroup className="gap-4">
        {!isLogin ? (
          <Field className="gap-1.5">
            <FieldLabel htmlFor="register-name">
              {t("name")}
              <RequiredMark />
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <UserRound aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                aria-required="true"
                autoComplete="name"
                id="register-name"
                maxLength={160}
                minLength={2}
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("namePlaceholder")}
                value={displayName}
              />
            </InputGroup>
          </Field>
        ) : null}
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${initialMode}-email`}>
            {t("email")}
            <RequiredMark />
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
              id={`${initialMode}-email`}
              maxLength={320}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("emailPlaceholder")}
              type="email"
              value={email}
            />
          </InputGroup>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${initialMode}-password`}>
            {t("password")}
            <RequiredMark />
          </FieldLabel>
          {isLogin ? (
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <LockKeyhole aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                aria-required="true"
                autoComplete="current-password"
                id="login-password"
                maxLength={128}
                minLength={1}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPassword ? t("hidePassword") : t("showPassword")
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                  size="icon-xs"
                  variant="brand-secondary"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <LockKeyhole aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                aria-required="true"
                autoComplete="new-password"
                id="register-password"
                maxLength={128}
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPassword ? t("hidePassword") : t("showPassword")
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                  size="icon-xs"
                  variant="brand-secondary"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          )}
        </Field>
        {!isLogin ? (
          <Field className="gap-1.5">
            <FieldLabel htmlFor="register-password-confirmation">
              {t("passwordConfirmation")}
              <RequiredMark />
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <LockKeyhole aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                aria-required="true"
                autoComplete="new-password"
                id="register-password-confirmation"
                maxLength={128}
                minLength={8}
                name="passwordConfirmation"
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                placeholder="••••••••"
                type={showPasswordConfirmation ? "text" : "password"}
                value={passwordConfirmation}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPasswordConfirmation
                      ? t("hidePasswordConfirmation")
                      : t("showPasswordConfirmation")
                  }
                  onClick={() =>
                    setShowPasswordConfirmation((visible) => !visible)
                  }
                  size="icon-xs"
                  variant="brand-secondary"
                >
                  {showPasswordConfirmation ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <ul className="space-y-1 pt-1">
              <PasswordRequirement fulfilled={password.length >= 8}>
                {tPolicy("length")}
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[A-Z]/.test(password)}>
                {tPolicy("uppercase")}
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[a-z]/.test(password)}>
                {tPolicy("lowercase")}
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[0-9]/.test(password)}>
                {tPolicy("number")}
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[^A-Za-z0-9]/.test(password)}>
                {tPolicy("special")}
              </PasswordRequirement>
              <PasswordRequirement
                fulfilled={
                  Boolean(password) && password === passwordConfirmation
                }
              >
                {tPolicy("match")}
              </PasswordRequirement>
            </ul>
          </Field>
        ) : (
          <Field data-slot="login-remember" orientation="horizontal">
            <Checkbox id="login-remember" name="remember" />
            <FieldContent>
              <FieldLabel className="font-normal" htmlFor="login-remember">
                {t("remember")}
              </FieldLabel>
            </FieldContent>
          </Field>
        )}
        {!isLogin ? (
          <Field className="gap-1.5">
            <FieldLabel htmlFor="register-timezone">
              {t("timezone")}
              <RequiredMark />
            </FieldLabel>
            <Select onValueChange={setTimezone} value={timezone}>
              <SelectTrigger
                aria-required="true"
                className="w-full"
                id="register-timezone"
              >
                <SelectValue placeholder={t("timezonePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableTimeZones.map((timeZone) => (
                    <SelectItem key={timeZone} value={timeZone}>
                      {timeZone}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {turnstile?.enabled && turnstile.siteKey ? (
          <TurnstileWidget
            onError={onTurnstileError}
            onTokenChange={onTurnstileTokenChange}
            resetKey={turnstileResetKey}
            siteKey={turnstile.siteKey}
          />
        ) : null}
      </FieldGroup>
      {isLogin ? (
        <Link
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/forgot-password"
        >
          {t("forgotPassword")}
        </Link>
      ) : null}
      <Button
        className="w-full"
        disabled={isSubmitting || !formComplete}
        type="submit"
      >
        {isSubmitting ? (
          <Spinner aria-label={t("submittingLabel")} data-icon="inline-start" />
        ) : isLogin ? (
          <LogIn aria-hidden="true" data-icon="inline-start" />
        ) : (
          <UserPlus aria-hidden="true" data-icon="inline-start" />
        )}
        {isSubmitting
          ? t("submitting")
          : isLogin
            ? t("submitLogin")
            : t("submitRegister")}
      </Button>
    </form>
  )
}
