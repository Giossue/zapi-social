"use client"

import { ApiError, profileApi } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/toast"
import { CheckCircle2, KeyRound, LoaderCircle, UserRound } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import type { PortalProfile } from "@workspace/contracts"

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
  if (!(error instanceof ApiError))
    return "No pudimos guardar los cambios. Inténtalo de nuevo."
  if (error.code === "AUTH_CURRENT_PASSWORD_INVALID")
    return "La contraseña actual no es correcta."
  if (error.code === "AUTH_PASSWORD_POLICY_NOT_MET")
    return "La nueva contraseña no cumple los requisitos."
  if (error.code === "VALIDATION_FAILED")
    return "Revisa nombre, idioma y zona horaria."
  return "No pudimos guardar los cambios. Inténtalo de nuevo."
}

function ProfileLoading() {
  return (
    <div className="space-y-6" aria-label="Cargando perfil">
      <Card variant="subtle">
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
        </CardContent>
      </Card>
      <Card variant="subtle">
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function PortalProfilePage() {
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [locale, setLocale] = useState<"" | "es" | "en">("")
  const [displayName, setDisplayName] = useState("")
  const [timezone, setTimezone] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

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

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile) return

    const form = new FormData(event.currentTarget)
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
      toast.error(profileError(nextError))
    } finally {
      setSavingPreferences(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get("newPassword") ?? "")
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "")

    if (newPassword !== passwordConfirmation) {
      toast.error("Las contraseñas nuevas no coinciden.")
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
      toast.success("Contraseña actualizada.")
    } catch (nextError) {
      toast.error(profileError(nextError))
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
      <Card variant="subtle">
        <CardContent className="space-y-4 py-10 text-center">
          <p className="font-medium">{error ?? "No encontramos tu perfil."}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="brand-secondary"
          >
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card variant="subtle">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
            {initials(profile.displayName) || "Z"}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">
                {profile.displayName}
              </h2>
              {profile.emailVerifiedAt ? (
                <Badge variant="success">
                  <CheckCircle2 /> Correo verificado
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {profile.email}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Miembro desde {formatMemberSince(profile.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={savePreferences}>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" /> Preferencias de perfil
            </CardTitle>
            <CardDescription>
              Información usada en el Portal y para presentar fechas en tu zona
              horaria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label
              className="grid gap-1.5 text-sm font-medium"
              htmlFor="profile-display-name"
            >
              Nombre visible
              <Input
                id="profile-display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={160}
                name="displayName"
                required
                value={displayName}
              />
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-1.5 text-sm font-medium">
                <span>Idioma preferido</span>
                <Select
                  value={locale || "system"}
                  onValueChange={(value) =>
                    setLocale(value === "system" ? "" : (value as "es" | "en"))
                  }
                >
                  <SelectTrigger aria-label="Idioma preferido">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">
                      Usar idioma del Portal
                    </SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label
                className="grid gap-1.5 text-sm font-medium"
                htmlFor="profile-timezone"
              >
                Zona horaria
                <Input
                  id="profile-timezone"
                  onChange={(event) => setTimezone(event.target.value)}
                  list="profile-timezones"
                  maxLength={64}
                  name="timezone"
                  placeholder="America/Guayaquil"
                  value={timezone}
                />
                <datalist id="profile-timezones">
                  {suggestedTimeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={savingPreferences || !preferencesChanged}
                type="submit"
              >
                {savingPreferences ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Guardar perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <form onSubmit={savePassword}>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> Cambiar contraseña
            </CardTitle>
            <CardDescription>
              Confirma tu contraseña actual antes de definir una nueva.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label
              className="grid gap-1.5 text-sm font-medium"
              htmlFor="current-password"
            >
              Contraseña actual
              <Input
                autoComplete="current-password"
                id="current-password"
                name="currentPassword"
                required
                type="password"
              />
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label
                className="grid gap-1.5 text-sm font-medium"
                htmlFor="new-password"
              >
                Nueva contraseña
                <Input
                  autoComplete="new-password"
                  id="new-password"
                  name="newPassword"
                  required
                  type="password"
                />
              </label>
              <label
                className="grid gap-1.5 text-sm font-medium"
                htmlFor="confirm-password"
              >
                Confirmar nueva contraseña
                <Input
                  autoComplete="new-password"
                  id="confirm-password"
                  name="passwordConfirmation"
                  required
                  type="password"
                />
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter
              especial.
            </p>
            <div className="flex justify-end">
              <Button
                disabled={savingPassword}
                type="submit"
                variant="brand-secondary"
              >
                {savingPassword ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Actualizar contraseña
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
