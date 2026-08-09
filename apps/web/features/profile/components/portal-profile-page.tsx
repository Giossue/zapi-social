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
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { Separator } from "@workspace/ui/components/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { CircleAlert, KeyRound, Save } from "lucide-react"
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

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
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
  const [locale, setLocale] = useState<"" | "es" | "en">("")
  const [displayName, setDisplayName] = useState("")
  const [timezone, setTimezone] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")

  useEffect(() => {
    let active = true
    void profileApi
      .get()
      .then((nextProfile) => {
        if (!active) return
        setProfile(nextProfile)
        setDisplayName(nextProfile.displayName)
        setLocale(nextProfile.locale ?? "")
        setTimezone(nextProfile.timezone ?? browserTimeZone())
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
    if (!displayName.trim()) {
      toast.error("Completa el nombre visible.")
      return
    }
    if (!timezone) {
      toast.error("Selecciona tu zona horaria.")
      return
    }

    setSavingPreferences(true)
    try {
      const nextProfile = await profileApi.update({
        displayName,
        locale: locale || null,
        timezone: timezone.trim(),
      })
      setProfile(nextProfile)
      setDisplayName(nextProfile.displayName)
      setLocale(nextProfile.locale ?? "")
      setTimezone(nextProfile.timezone ?? browserTimeZone())
      toast.success("Perfil actualizado.")
    } catch (nextError) {
      toast.error(profileError(nextError))
    } finally {
      setSavingPreferences(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentPassword || !newPassword || !passwordConfirmation) {
      toast.error("Completa todos los campos.")
      return
    }
    if (newPassword !== passwordConfirmation) {
      toast.error("Las contraseñas nuevas no coinciden.")
      return
    }

    setSavingPassword(true)
    try {
      await profileApi.changePassword({
        currentPassword,
        newPassword,
        passwordConfirmation,
      })
      setCurrentPassword("")
      setNewPassword("")
      setPasswordConfirmation("")
      toast.success(
        "Contraseña actualizada. Inicia sesión de nuevo para continuar."
      )
      announceSessionLogout()
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
  const passwordFormComplete = Boolean(
    currentPassword && newPassword && passwordConfirmation
  )

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
    <Tabs defaultValue="profile" className="mx-auto w-full max-w-4xl gap-4">
      <TabsList
        aria-label="Configuración de la cuenta"
        className="w-full sm:w-fit"
      >
        <TabsTrigger value="profile">Perfil</TabsTrigger>
        <TabsTrigger value="security">Seguridad</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <form
          aria-busy={savingPreferences}
          noValidate
          onSubmit={savePreferences}
        >
          <Card size="sm">
            <CardHeader>
              <CardTitle>Información personal</CardTitle>
              <CardDescription>
                Administra cómo apareces y tus preferencias del Portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar size="lg">
                  <AvatarFallback>
                    {initials(profile.displayName) || "Z"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{profile.displayName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {profile.email}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  {profile.emailVerifiedAt ? (
                    <Badge variant="success">Verificado</Badge>
                  ) : (
                    <Badge variant="outline">Sin verificar</Badge>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Miembro desde {formatMemberSince(profile.createdAt)}
                  </p>
                </div>
              </div>

              <Separator />

              <FieldGroup>
                <Field data-disabled={savingPreferences}>
                  <FieldLabel htmlFor="profile-display-name">
                    Nombre visible{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <Input
                    aria-required="true"
                    disabled={savingPreferences}
                    id="profile-display-name"
                    maxLength={160}
                    name="displayName"
                    onChange={(event) => setDisplayName(event.target.value)}
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
                      }}
                      value={locale || "system"}
                    >
                      <SelectTrigger className="w-full" id="profile-locale">
                        <SelectValue placeholder="Usar idioma del Portal" />
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
                      Zona horaria{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    </FieldLabel>
                    <Select
                      disabled={savingPreferences}
                      onValueChange={setTimezone}
                      value={timezone}
                    >
                      <SelectTrigger
                        aria-required="true"
                        className="w-full"
                        id="profile-timezone"
                      >
                        <SelectValue placeholder="Selecciona zona horaria" />
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
                </FieldGroup>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="mt-3 flex justify-end">
            <Button
              disabled={
                savingPreferences ||
                !displayName.trim() ||
                !timezone ||
                !preferencesChanged
              }
              type="submit"
            >
              {savingPreferences ? <Spinner data-icon="inline-start" /> : null}
              {!savingPreferences ? (
                <Save aria-hidden="true" data-icon="inline-start" />
              ) : null}
              Guardar perfil
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="security">
        <form aria-busy={savingPassword} noValidate onSubmit={savePassword}>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Cambiar contraseña</CardTitle>
              <CardDescription>
                Confirma tu contraseña actual antes de definir una nueva.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={savingPassword}>
                  <FieldLabel htmlFor="current-password">
                    Contraseña actual{" "}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FieldLabel>
                  <Input
                    aria-required="true"
                    autoComplete="current-password"
                    disabled={savingPassword}
                    id="current-password"
                    name="currentPassword"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type="password"
                    value={currentPassword}
                  />
                </Field>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <Field data-disabled={savingPassword}>
                    <FieldLabel htmlFor="new-password">
                      Nueva contraseña{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    </FieldLabel>
                    <Input
                      aria-required="true"
                      autoComplete="new-password"
                      disabled={savingPassword}
                      id="new-password"
                      name="newPassword"
                      onChange={(event) => setNewPassword(event.target.value)}
                      type="password"
                      value={newPassword}
                    />
                  </Field>
                  <Field data-disabled={savingPassword}>
                    <FieldLabel htmlFor="confirm-password">
                      Confirmar nueva contraseña{" "}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    </FieldLabel>
                    <Input
                      aria-required="true"
                      autoComplete="new-password"
                      disabled={savingPassword}
                      id="confirm-password"
                      name="passwordConfirmation"
                      onChange={(event) =>
                        setPasswordConfirmation(event.target.value)
                      }
                      type="password"
                      value={passwordConfirmation}
                    />
                  </Field>
                </FieldGroup>
                <FieldDescription>
                  Mínimo 8 caracteres, con mayúscula, minúscula, número y
                  carácter especial.
                </FieldDescription>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="mt-3 flex justify-end">
            <Button
              disabled={savingPassword || !passwordFormComplete}
              type="submit"
            >
              {savingPassword ? <Spinner data-icon="inline-start" /> : null}
              {!savingPassword ? (
                <KeyRound aria-hidden="true" data-icon="inline-start" />
              ) : null}
              Actualizar contraseña
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  )
}
