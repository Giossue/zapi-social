"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import {
  getAreaDestination,
  getSessionArea,
} from "@/features/identity/session-area"

export type AuthMode = "login" | "register"

const authErrorMessages: Record<string, string> = {
  AUTH_EMAIL_ALREADY_REGISTERED: "Ya existe una cuenta con este correo.",
  AUTH_INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  AUTH_PASSWORD_POLICY_NOT_MET:
    "La contraseña no cumple los requisitos de seguridad.",
  AUTH_SESSION_EXPIRED: "Tu sesión terminó. Inicia sesión de nuevo.",
  AUTH_WORKSPACE_UNAVAILABLE: "No fue posible acceder a tu cuenta.",
  VALIDATION_FAILED: "Revisa los datos e inténtalo de nuevo.",
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
  return <span className="text-destructive"> *</span>
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
  returnTo?: "/invite"
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false)
  const isLogin = initialMode === "login"

  function reportError(message: string) {
    setFormError(message)
    toast.error(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "")

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reportError("Ingresa un correo electrónico válido.")
      return
    }
    if (!password) {
      reportError("Ingresa tu contraseña.")
      return
    }
    if (!isLogin) {
      const displayName = String(form.get("displayName") ?? "").trim()
      if (!displayName) {
        reportError("Ingresa tu nombre.")
        return
      }
      if (!passwordMeetsPolicy(password)) {
        reportError(
          "La contraseña debe tener 8 caracteres, mayúscula, minúscula, número y símbolo."
        )
        return
      }
      if (password !== passwordConfirmation) {
        reportError("Las contraseñas no coinciden.")
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
          })
        : await authApi.register({
            displayName: String(form.get("displayName") ?? ""),
            email,
            password,
          })
      const area = getSessionArea(session)
      if (!area) {
        reportError(
          "Tu sesión no incluye el área de acceso requerida. Vuelve a iniciar sesión."
        )
        return
      }
      router.replace(
        returnTo && area === "portal" ? returnTo : getAreaDestination(area)
      )
      router.refresh()
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status >= 500) {
          console.error("Auth request failed", {
            code: caught.code,
            requestId: caught.requestId,
          })
        }
        reportError(
          authErrorMessages[caught.code] ??
            "No pudimos completar la solicitud. Inténtalo de nuevo."
        )
      } else {
        console.error("Auth request failed", caught)
        reportError("No pudimos completar la solicitud. Inténtalo de nuevo.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup className="gap-4">
        {!isLogin ? (
          <Field className="gap-1.5">
            <FieldLabel htmlFor="register-name">
              Nombre
              <RequiredMark />
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <UserRound aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="name"
                id="register-name"
                maxLength={160}
                minLength={2}
                name="displayName"
                placeholder="Tu nombre"
                required
              />
            </InputGroup>
          </Field>
        ) : null}
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${initialMode}-email`}>
            Correo electrónico
            <RequiredMark />
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>
                <Mail aria-hidden="true" />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              autoComplete="email"
              id={`${initialMode}-email`}
              maxLength={320}
              name="email"
              placeholder="tu@correo.com"
              required
              type="email"
            />
          </InputGroup>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${initialMode}-password`}>
            Contraseña
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
                autoComplete="current-password"
                id="login-password"
                maxLength={128}
                minLength={1}
                name="password"
                placeholder="••••••••"
                required
                type={showPassword ? "text" : "password"}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                  size="icon-xs"
                  variant="ghost"
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
                autoComplete="new-password"
                id="register-password"
                maxLength={128}
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                  size="icon-xs"
                  variant="ghost"
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
              Confirmar contraseña
              <RequiredMark />
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <LockKeyhole aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="new-password"
                id="register-password-confirmation"
                maxLength={128}
                minLength={8}
                name="passwordConfirmation"
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                placeholder="••••••••"
                required
                type={showPasswordConfirmation ? "text" : "password"}
                value={passwordConfirmation}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPasswordConfirmation
                      ? "Ocultar confirmación de contraseña"
                      : "Mostrar confirmación de contraseña"
                  }
                  onClick={() =>
                    setShowPasswordConfirmation((visible) => !visible)
                  }
                  size="icon-xs"
                  variant="ghost"
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
                8 caracteres o más
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[A-Z]/.test(password)}>
                Una letra mayúscula
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[a-z]/.test(password)}>
                Una letra minúscula
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[0-9]/.test(password)}>
                Un número
              </PasswordRequirement>
              <PasswordRequirement fulfilled={/[^A-Za-z0-9]/.test(password)}>
                Un carácter especial
              </PasswordRequirement>
              <PasswordRequirement
                fulfilled={
                  Boolean(password) && password === passwordConfirmation
                }
              >
                Las contraseñas coinciden
              </PasswordRequirement>
            </ul>
          </Field>
        ) : (
          <Field data-slot="login-remember" orientation="horizontal">
            <Checkbox id="login-remember" name="remember" />
            <FieldContent>
              <FieldLabel className="font-normal" htmlFor="login-remember">
                Recordarme
              </FieldLabel>
            </FieldContent>
          </Field>
        )}
      </FieldGroup>
      {isLogin ? (
        <Link
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/forgot-password"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      ) : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <Spinner aria-label="Comprobando" data-icon="inline-start" />
        ) : null}
        {isSubmitting
          ? "Comprobando…"
          : isLogin
            ? "Iniciar sesión"
            : "Crear cuenta"}
      </Button>
    </form>
  )
}
