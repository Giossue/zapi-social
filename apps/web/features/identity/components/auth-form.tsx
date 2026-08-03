"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { Check, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"

import { getAreaDestination, getSessionArea } from "@/features/identity/session-area"

export type AuthMode = "login" | "register"

type PasswordRequirement = {
  label: string
  test: (password: string, confirmation: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "8 caracteres o más", test: (password) => password.length >= 8 },
  { label: "Una letra mayúscula", test: (password) => /[A-Z]/.test(password) },
  { label: "Una letra minúscula", test: (password) => /[a-z]/.test(password) },
  { label: "Un número", test: (password) => /[0-9]/.test(password) },
  {
    label: "Un carácter especial",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
  {
    label: "Las contraseñas coinciden",
    test: (password, confirmation) => password.length > 0 && password === confirmation,
  },
]

const authErrorMessages: Record<string, string> = {
  AUTH_EMAIL_ALREADY_REGISTERED: "Ya existe una cuenta con este correo.",
  AUTH_INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  AUTH_PASSWORD_POLICY_NOT_MET: "La contraseña no cumple los requisitos de seguridad.",
  AUTH_SESSION_EXPIRED: "Tu sesión terminó. Inicia sesión de nuevo.",
  AUTH_WORKSPACE_UNAVAILABLE: "No fue posible acceder a tu cuenta.",
  VALIDATION_FAILED: "Revisa los datos e inténtalo de nuevo.",
}

export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    function syncModeFromLocation() {
      const nextMode: AuthMode = window.location.pathname === "/register" ? "register" : "login"
      setMode(nextMode)
      setPassword("")
      setPasswordConfirmation("")
      setFormError(null)
    }

    window.addEventListener("popstate", syncModeFromLocation)
    return () => window.removeEventListener("popstate", syncModeFromLocation)
  }, [])

  function reportError(message: string) {
    setFormError(message)
    toast.error(message)
  }

  function selectMode(nextMode: AuthMode) {
    if (nextMode === mode) return

    setMode(nextMode)
    setPassword("")
    setPasswordConfirmation("")
    setFormError(null)
    window.history.pushState(null, "", nextMode === "register" ? "/register" : "/login")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const submittedPassword = String(form.get("password") ?? "")
    const confirmation = String(form.get("passwordConfirmation") ?? "")

    if (!email) {
      reportError("Ingresa tu correo electrónico.")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reportError("Ingresa un correo electrónico válido.")
      return
    }

    if (!submittedPassword) {
      reportError("Ingresa tu contraseña.")
      return
    }

    if (mode === "register") {
      const displayName = String(form.get("displayName") ?? "").trim()
      if (!displayName) {
        reportError("Ingresa tu nombre.")
        return
      }
      if (!passwordRequirements.slice(0, 5).every((requirement) => requirement.test(submittedPassword, confirmation))) {
        reportError("La contraseña no cumple los requisitos de seguridad.")
        return
      }
      if (submittedPassword !== confirmation) {
        reportError("Las contraseñas no coinciden.")
        return
      }
    }

    setIsSubmitting(true)
    try {
      const session =
        mode === "register"
          ? await authApi.register({
              displayName: String(form.get("displayName") ?? ""),
              email,
              password: submittedPassword,
            })
          : await authApi.login({ email, password: submittedPassword })
      const area = getSessionArea(session)

      if (mode === "register") {
        router.replace(getAreaDestination("portal"))
      } else {
        if (!area) {
          reportError("Tu sesión no incluye el área de acceso requerida. Vuelve a iniciar sesión.")
          return
        }
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
        reportError(authErrorMessages[caught.code] ?? "No pudimos completar la solicitud. Inténtalo de nuevo.")
      } else {
        console.error("Auth request failed", caught)
        reportError("No pudimos completar la solicitud. Inténtalo de nuevo.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <Tabs onValueChange={(value) => selectMode(value as AuthMode)} value={mode}>
          <TabsList aria-label="Modo de autenticación" className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Crear cuenta</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Usa tus credenciales para continuar."
              : "Empieza a organizar tu contenido y canales."}
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="gap-4">
          {mode === "register" ? (
            <Field className="gap-1.5">
              <FieldLabel htmlFor="display-name">
                Nombre <span aria-hidden="true" className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    <UserRound aria-hidden="true" />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  autoComplete="name"
                  id="display-name"
                  maxLength={160}
                  minLength={2}
                  name="displayName"
                  required
                />
              </InputGroup>
            </Field>
          ) : null}

          <Field className="gap-1.5">
            <FieldLabel htmlFor="email">
              Correo electrónico <span aria-hidden="true" className="text-destructive">*</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <Mail aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="email"
                id="email"
                maxLength={320}
                name="email"
                required
                type="email"
              />
            </InputGroup>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="password">
              Contraseña <span aria-hidden="true" className="text-destructive">*</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <LockKeyhole aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                id="password"
                maxLength={128}
                minLength={mode === "register" ? 8 : 1}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={isPasswordVisible ? "text" : "password"}
                value={password}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  disabled={isSubmitting}
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  size="icon-xs"
                  variant="brand-secondary"
                >
                  {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {mode === "register" ? (
            <Field className="gap-1.5">
              <FieldLabel htmlFor="password-confirmation">
                Confirmar contraseña <span aria-hidden="true" className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    <LockKeyhole aria-hidden="true" />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  autoComplete="new-password"
                  id="password-confirmation"
                  maxLength={128}
                  minLength={8}
                  name="passwordConfirmation"
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                  type={isPasswordVisible ? "text" : "password"}
                  value={passwordConfirmation}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    disabled={isSubmitting}
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                    size="icon-xs"
                    variant="brand-secondary"
                  >
                    {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <ul className="grid gap-1 text-sm" aria-label="Requisitos de contraseña">
                {passwordRequirements.map((requirement) => {
                  const met = requirement.test(password, passwordConfirmation)
                  return (
                    <li key={requirement.label} className={met ? "flex items-center gap-2 text-success" : "flex items-center gap-2 text-muted-foreground"}>
                      {met ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                      {requirement.label}
                    </li>
                  )
                })}
              </ul>
            </Field>
          ) : null}
        </FieldGroup>

        {mode === "login" ? (
          <Link className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/forgot-password">
            ¿Olvidaste tu contraseña?
          </Link>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
          {isSubmitting ? <Spinner aria-label="Comprobando" data-icon="inline-start" /> : null}
          {isSubmitting ? "Comprobando…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>
    </div>
  )
}
