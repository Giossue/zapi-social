"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
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

import {
  getAreaDestination,
  getSessionArea,
} from "@/features/identity/session-area"
import { useEffect, useState, type FormEvent } from "react"

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
    test: (password, confirmation) =>
      password.length > 0 && password === confirmation,
  },
]

const authErrorMessages: Record<string, string> = {
  AUTH_EMAIL_ALREADY_REGISTERED: "Ya existe una cuenta con este correo.",
  AUTH_INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  AUTH_PASSWORD_POLICY_NOT_MET:
    "La contraseña no cumple los requisitos de seguridad.",
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
  useEffect(() => {
    function syncModeFromLocation() {
      const nextMode: AuthMode =
        window.location.pathname === "/register" ? "register" : "login"
      setMode(nextMode)
      setPassword("")
      setPasswordConfirmation("")
    }

    window.addEventListener("popstate", syncModeFromLocation)
    return () => window.removeEventListener("popstate", syncModeFromLocation)
  }, [])

  function selectMode(nextMode: AuthMode) {
    if (nextMode === mode) return

    setMode(nextMode)
    setPassword("")
    setPasswordConfirmation("")
    window.history.pushState(
      null,
      "",
      nextMode === "register" ? "/register" : "/login"
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const submittedPassword = String(form.get("password") ?? "")
    const confirmation = String(form.get("passwordConfirmation") ?? "")

    if (!email) {
      toast.error("Ingresa tu correo electrónico.")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Ingresa un correo electrónico válido.")
      return
    }

    if (!submittedPassword) {
      toast.error("Ingresa tu contraseña.")
      return
    }

    if (mode === "register") {
      const displayName = String(form.get("displayName") ?? "").trim()
      if (!displayName) {
        toast.error("Ingresa tu nombre.")
        return
      }
      if (
        !passwordRequirements
          .slice(0, 5)
          .every((requirement) =>
            requirement.test(submittedPassword, confirmation)
          )
      ) {
        toast.error("La contraseña no cumple los requisitos de seguridad.")
        return
      }
      if (submittedPassword !== confirmation) {
        toast.error("Las contraseñas no coinciden.")
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
          toast.error(
            "Tu sesión no incluye el área de acceso requerida. Vuelve a iniciar sesión."
          )
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
        toast.error(
          authErrorMessages[caught.code] ??
            "No pudimos completar la solicitud. Inténtalo de nuevo."
        )
      } else {
        console.error("Auth request failed", caught)
        toast.error("No pudimos completar la solicitud. Inténtalo de nuevo.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <Card variant="surface" className="gap-5 overflow-hidden py-5">
        <CardHeader className="gap-3">
          <Tabs
            onValueChange={(value) => selectMode(value as AuthMode)}
            value={mode}
          >
            <TabsList
              aria-label="Modo de autenticación"
              className="grid w-full grid-cols-2"
            >
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Crear cuenta</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-1">
            <CardTitle>
              {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Usa tus credenciales para continuar."
                : "Empieza a organizar tu contenido y canales."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={submit}>
            <div
              className={`grid overflow-hidden transition-[grid-template-rows,margin] duration-500 ease-out motion-reduce:transition-none ${mode === "register" ? "mb-4 grid-rows-[1fr]" : "mb-0 grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <label
                  className="grid gap-1.5 text-sm font-medium text-foreground"
                  htmlFor="display-name"
                >
                  <span>
                    Nombre{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <span className="relative">
                    <UserRound
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="display-name"
                      name="displayName"
                      className="pl-9"
                      autoComplete="name"
                      required={mode === "register"}
                      minLength={2}
                      maxLength={160}
                      tabIndex={mode === "register" ? 0 : -1}
                    />
                  </span>
                </label>
              </div>
            </div>
            <label
              className="mb-4 grid gap-1.5 text-sm font-medium text-foreground"
              htmlFor="email"
            >
              <span>
                Correo electrónico{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <span className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className="pl-9"
                  autoComplete="email"
                  required
                  maxLength={320}
                />
              </span>
            </label>
            <label
              className="mb-4 grid gap-1.5 text-sm font-medium text-foreground"
              htmlFor="password"
            >
              <span>
                Contraseña{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <span className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  className="px-9"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  maxLength={128}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={
                    isPasswordVisible
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                >
                  {isPasswordVisible ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </Button>
              </span>
            </label>
            <div
              className={`grid overflow-hidden transition-[grid-template-rows,margin] duration-500 ease-out motion-reduce:transition-none ${mode === "register" ? "mb-4 grid-rows-[1fr]" : "mb-0 grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="grid gap-4">
                  <label
                    className="grid gap-1.5 text-sm font-medium text-foreground"
                    htmlFor="password-confirmation"
                  >
                    <span>
                      Confirmar contraseña{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <span className="relative">
                      <LockKeyhole
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="password-confirmation"
                        name="passwordConfirmation"
                        type={isPasswordVisible ? "text" : "password"}
                        className="pl-9"
                        autoComplete="new-password"
                        value={passwordConfirmation}
                        onChange={(event) =>
                          setPasswordConfirmation(event.target.value)
                        }
                        required={mode === "register"}
                        minLength={8}
                        maxLength={128}
                        tabIndex={mode === "register" ? 0 : -1}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-1 -translate-y-1/2"
                        aria-label={
                          isPasswordVisible
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        onClick={() =>
                          setIsPasswordVisible((visible) => !visible)
                        }
                      >
                        {isPasswordVisible ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </Button>
                    </span>
                  </label>
                  <ul
                    className="grid gap-1 text-sm"
                    aria-label="Requisitos de contraseña"
                  >
                    {passwordRequirements.map((requirement) => {
                      const met = requirement.test(
                        password,
                        passwordConfirmation
                      )
                      return (
                        <li
                          key={requirement.label}
                          className={
                            met
                              ? "flex items-center gap-2 text-success"
                              : "flex items-center gap-2 text-muted-foreground"
                          }
                        >
                          {met ? (
                            <Check className="size-3.5" aria-hidden="true" />
                          ) : (
                            <X className="size-3.5" aria-hidden="true" />
                          )}
                          {requirement.label}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
            {mode === "login" ? (
              <Link
                className="self-end text-sm text-muted-foreground underline-offset-4 hover:underline"
                href="/forgot-password"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Comprobando…"
                : mode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
