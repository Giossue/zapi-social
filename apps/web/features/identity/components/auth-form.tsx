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
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
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

export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
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
        ? await authApi.login({ email, password })
        : await authApi.register({
            displayName: String(form.get("displayName") ?? ""),
            email,
            password,
          })
      const area = getSessionArea(session)
      if (!isLogin) {
        router.replace(getAreaDestination("portal"))
      } else if (!area) {
        reportError(
          "Tu sesión no incluye el área de acceso requerida. Vuelve a iniciar sesión."
        )
        return
      } else {
        router.replace(getAreaDestination(area))
      }
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
            <FieldLabel htmlFor="register-name">Nombre</FieldLabel>
            <Input
              autoComplete="name"
              id="register-name"
              maxLength={160}
              minLength={2}
              name="displayName"
              placeholder="Tu nombre"
              required
            />
          </Field>
        ) : null}
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${initialMode}-email`}>
            Correo electrónico
          </FieldLabel>
          <Input
            autoComplete="email"
            id={`${initialMode}-email`}
            maxLength={320}
            name="email"
            placeholder="tu@correo.com"
            required
            type="email"
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${initialMode}-password`}>
            Contraseña
          </FieldLabel>
          <Input
            autoComplete={isLogin ? "current-password" : "new-password"}
            id={`${initialMode}-password`}
            maxLength={128}
            minLength={isLogin ? 1 : 8}
            name="password"
            placeholder="••••••••"
            required
            type="password"
          />
        </Field>
        {!isLogin ? (
          <Field className="gap-1.5">
            <FieldLabel htmlFor="register-password-confirmation">
              Confirmar contraseña
            </FieldLabel>
            <Input
              autoComplete="new-password"
              id="register-password-confirmation"
              maxLength={128}
              minLength={8}
              name="passwordConfirmation"
              placeholder="••••••••"
              required
              type="password"
            />
          </Field>
        ) : (
          <Field data-slot="login-remember" orientation="horizontal">
            <Checkbox id="login-remember" name="remember" />
            <FieldContent>
              <FieldLabel className="font-normal" htmlFor="login-remember">
                Recuérdame durante 30 días
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
