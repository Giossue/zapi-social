"use client"

import { ApiError, profileApi } from "@workspace/api-client"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
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
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Mail,
  UserRound,
} from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { announceSessionLogout } from "@/features/identity/components/session-synchronizer"
import type { PortalProfile } from "@workspace/contracts"

const supportedTimeZones =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : []

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

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function profileError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "No pudimos guardar los cambios. Inténtalo de nuevo."
  }
  if (error.code === "AUTH_CURRENT_PASSWORD_INVALID") {
    return "La contraseña actual no es correcta."
  }
  if (error.code === "AUTH_PASSWORD_POLICY_NOT_MET") {
    return "La nueva contraseña no cumple los requisitos."
  }
  if (error.code === "VALIDATION_FAILED") {
    return "Revisa nombre, idioma y zona horaria."
  }
  return "No pudimos guardar los cambios. Inténtalo de nuevo."
}

function ProfileLoading() {
  return <PageLoading aria-label="Cargando perfil" />
}

export function PortalProfilePage() {
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [preferencesError, setPreferencesError] = useState<string | null>(null)
  const [locale, setLocale] = useState<"" | "es" | "en">("")
  const [displayName, setDisplayName] = useState("")
  const [timezone, setTimezone] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordConfirmationError, setPasswordConfirmationError] =
    useState(false)

  useEffect(() => {
    let active = true
    void profileApi
      .get()
      .then((nextProfile) => {
        if (!active) return
        setProfile(nextProfile)
        setDisplayName(nextProfile.displayName)
        setLocale(nextProfile.locale ?? "")
        setTimezone(nextProfile.timezone ?? "")
        setError(null)
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tu perfil.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const availableTimeZones = useMemo(() => {
    const values = new Set([
      "UTC",
      ...suggestedTimeZones,
      ...supportedTimeZones,
    ])
    if (timezone) values.add(timezone)
    return [...values].sort((first, second) => first.localeCompare(second))
  }, [timezone])

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile) return

    setPreferencesError(null)
    setSavingPreferences(true)
    try {
      const nextProfile = await profileApi.update({
        displayName,
        locale: locale || null,
        timezone: timezone.trim() || null,
      })
      setProfile(nextProfile)
      setDisplayName(nextProfile.displayName)
      setLocale(nextProfile.locale ?? "")
      setTimezone(nextProfile.timezone ?? "")
      toast.success("Perfil actualizado.")
    } catch (nextError) {
      const message = profileError(nextError)
      setPreferencesError(message)
      toast.error(message)
    } finally {
      setSavingPreferences(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get("newPassword") ?? "")
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "")

    setPasswordError(null)
    setPasswordConfirmationError(false)
    if (newPassword !== passwordConfirmation) {
      const message = "Las contraseñas nuevas no coinciden."
      setPasswordError(message)
      setPasswordConfirmationError(true)
      return
    }

    setSavingPassword(true)
    try {
      await profileApi.changePassword({
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword,
        passwordConfirmation,
      })
      event.currentTarget.reset()
      toast.success(
        "Contraseña actualizada. Inicia sesión de nuevo para continuar."
      )
      announceSessionLogout()
    } catch (nextError) {
      const message = profileError(nextError)
      setPasswordError(message)
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return <ProfileLoading />

  const preferencesChanged =
    profile !== null &&
    (displayName.trim() !== profile.displayName ||
      locale !== (profile.locale ?? "") ||
      timezone.trim() !== (profile.timezone ?? ""))

  if (!profile || error) {
    return (
      <Card size="sm" variant="subtle">
        <CardContent className="py-6">
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>No pudimos mostrar tu perfil</AlertTitle>
            <AlertDescription>
              {error ?? "No encontramos tu perfil."}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => window.location.reload()}
            variant="brand-secondary"
          >
            Reintentar
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:row-span-2" size="sm" variant="subtle">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>
            Información de acceso de tu usuario.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <Avatar size="lg">
              <AvatarFallback>
                {initials(profile.displayName) || "Z"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate leading-5 font-medium">
                {profile.displayName}
              </p>
              {profile.username ? (
                <p className="truncate text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <dt className="text-muted-foreground">Correo</dt>
              <dd className="ml-auto min-w-0 truncate text-right">
                {profile.email}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="ml-auto">
                {profile.emailVerifiedAt ? (
                  <Badge variant="success">Verificado</Badge>
                ) : (
                  <Badge variant="outline">Sin verificar</Badge>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Miembro desde {formatMemberSince(profile.createdAt)}
          </p>
        </CardFooter>
      </Card>

      <form
        aria-busy={savingPreferences}
        className="contents"
        onSubmit={savePreferences}
      >
        <Card className="lg:col-span-2" size="sm" variant="subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" /> Perfil
            </CardTitle>
            <CardDescription>
              Define cómo apareces y cómo el Portal presenta fechas para ti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {preferencesError ? (
                <Alert id="profile-preferences-error" variant="destructive">
                  <CircleAlert />
                  <AlertTitle>No pudimos guardar el perfil</AlertTitle>
                  <AlertDescription>{preferencesError}</AlertDescription>
                </Alert>
              ) : null}
              <Field data-disabled={savingPreferences}>
                <FieldLabel htmlFor="profile-display-name">
                  Nombre visible <span aria-hidden="true">*</span>
                </FieldLabel>
                <Input
                  aria-describedby={
                    preferencesError ? "profile-preferences-error" : undefined
                  }
                  aria-invalid={preferencesError ? true : undefined}
                  disabled={savingPreferences}
                  id="profile-display-name"
                  maxLength={160}
                  name="displayName"
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    setPreferencesError(null)
                  }}
                  required
                  value={displayName}
                />
              </Field>
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <Field data-disabled={savingPreferences}>
                  <FieldLabel htmlFor="profile-locale">
                    Idioma preferido
                  </FieldLabel>
                  <Select
                    disabled={savingPreferences}
                    onValueChange={(value) => {
                      setLocale(
                        value === "system" ? "" : (value as "es" | "en")
                      )
                      setPreferencesError(null)
                    }}
                    value={locale || "system"}
                  >
                    <SelectTrigger
                      aria-describedby={
                        preferencesError
                          ? "profile-preferences-error"
                          : undefined
                      }
                      aria-invalid={preferencesError ? true : undefined}
                      id="profile-locale"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="system">
                          Usar idioma del Portal
                        </SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-disabled={savingPreferences}>
                  <FieldLabel htmlFor="profile-timezone">
                    Zona horaria
                  </FieldLabel>
                  <Select
                    disabled={savingPreferences}
                    onValueChange={(value) => {
                      setTimezone(value === "unset" ? "" : value)
                      setPreferencesError(null)
                    }}
                    value={timezone || "unset"}
                  >
                    <SelectTrigger
                      aria-describedby={
                        preferencesError
                          ? "profile-preferences-error"
                          : undefined
                      }
                      aria-invalid={preferencesError ? true : undefined}
                      id="profile-timezone"
                    >
                      <SelectValue placeholder="Selecciona zona horaria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="unset">Sin zona horaria</SelectItem>
                        {availableTimeZones.map((timeZone) => (
                          <SelectItem key={timeZone} value={timeZone}>
                            {timeZone}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={savingPreferences || !preferencesChanged}
              type="submit"
            >
              {savingPreferences ? <Spinner data-icon="inline-start" /> : null}
              Guardar perfil
            </Button>
          </CardFooter>
        </Card>
      </form>

      <form
        aria-busy={savingPassword}
        className="contents"
        onSubmit={savePassword}
      >
        <Card className="lg:col-span-2" size="sm" variant="subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> Seguridad
            </CardTitle>
            <CardDescription>
              Confirma tu contraseña actual antes de definir una nueva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {passwordError ? (
                <Alert id="profile-password-error" variant="destructive">
                  <CircleAlert />
                  <AlertTitle>No pudimos actualizar la contraseña</AlertTitle>
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              ) : null}
              <Field data-disabled={savingPassword}>
                <FieldLabel htmlFor="current-password">
                  Contraseña actual <span aria-hidden="true">*</span>
                </FieldLabel>
                <Input
                  aria-describedby={
                    passwordError ? "profile-password-error" : undefined
                  }
                  disabled={savingPassword}
                  autoComplete="current-password"
                  id="current-password"
                  name="currentPassword"
                  onChange={() => setPasswordError(null)}
                  required
                  type="password"
                />
              </Field>
              <FieldGroup className="grid gap-5 md:grid-cols-2">
                <Field data-disabled={savingPassword}>
                  <FieldLabel htmlFor="new-password">
                    Nueva contraseña <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      passwordError ? "profile-password-error" : undefined
                    }
                    disabled={savingPassword}
                    autoComplete="new-password"
                    id="new-password"
                    name="newPassword"
                    onChange={() => setPasswordError(null)}
                    required
                    type="password"
                  />
                </Field>
                <Field
                  data-disabled={savingPassword}
                  data-invalid={passwordConfirmationError}
                >
                  <FieldLabel htmlFor="confirm-password">
                    Confirmar nueva contraseña <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      passwordError ? "profile-password-error" : undefined
                    }
                    aria-invalid={passwordConfirmationError || undefined}
                    disabled={savingPassword}
                    autoComplete="new-password"
                    id="confirm-password"
                    name="passwordConfirmation"
                    onChange={() => {
                      setPasswordError(null)
                      setPasswordConfirmationError(false)
                    }}
                    required
                    type="password"
                  />
                  {passwordConfirmationError ? (
                    <FieldError>
                      Las contraseñas nuevas no coinciden.
                    </FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
              <FieldDescription>
                Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter
                especial.
              </FieldDescription>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={savingPassword}
              type="submit"
              variant="brand-secondary"
            >
              {savingPassword ? <Spinner data-icon="inline-start" /> : null}
              Actualizar contraseña
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
