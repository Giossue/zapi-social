"use client"

import { ApiError, i18nApi, profileApi } from "@workspace/api-client"
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
import { PageLoading } from "@/components/page-loading"
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
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { announceSessionLogout } from "@/features/identity/components/session-synchronizer"
import { syncLocaleCookie } from "@/i18n/locale-cookie"
import type { PortalProfile, PublicLanguage } from "@workspace/contracts"

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

function profileErrorKey(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "saveFailed"
  }
  if (error.code === "AUTH_CURRENT_PASSWORD_INVALID") {
    return "currentPasswordInvalid"
  }
  if (error.code === "AUTH_PASSWORD_POLICY_NOT_MET") {
    return "passwordPolicy"
  }
  if (error.code === "VALIDATION_FAILED") {
    return "validationFailed"
  }
  return "saveFailed"
}

function ProfileLoading({ label }: { label: string }) {
  return <PageLoading aria-label={label} />
}

export function PortalProfilePage() {
  const t = useTranslations("profile")
  const tCommon = useTranslations("common.language")
  const format = useFormatter()
  const router = useRouter()
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [locale, setLocale] = useState("")
  const [languages, setLanguages] = useState<PublicLanguage[]>([])
  const [displayName, setDisplayName] = useState("")
  const [timezone, setTimezone] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")

  useEffect(() => {
    let active = true
    void i18nApi
      .languages()
      .then((response) => {
        if (active) setLanguages(response.languages)
      })
      .catch(() => {})
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
        if (active) setError(t("loadFailed"))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [t])

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
      toast.error(t("nameRequired"))
      return
    }
    if (!timezone) {
      toast.error(t("timezoneRequired"))
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
      toast.success(t("updated"))
      if (syncLocaleCookie(nextProfile.locale)) router.refresh()
    } catch (nextError) {
      toast.error(t(profileErrorKey(nextError)))
    } finally {
      setSavingPreferences(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentPassword || !newPassword || !passwordConfirmation) {
      toast.error(t("allFieldsRequired"))
      return
    }
    if (newPassword !== passwordConfirmation) {
      toast.error(t("passwordMismatch"))
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
      toast.success(t("passwordUpdated"))
      announceSessionLogout()
    } catch (nextError) {
      toast.error(t(profileErrorKey(nextError)))
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return <ProfileLoading label={t("loading")} />

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
            <AlertTitle>{t("unavailableTitle")}</AlertTitle>
            <AlertDescription>{error ?? t("notFound")}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => window.location.reload()}
            variant="brand-secondary"
          >
            {tCommon("retry")}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="profile" className="mx-auto w-full max-w-4xl gap-4">
      <TabsList aria-label={t("settingsLabel")} className="w-full sm:w-fit">
        <TabsTrigger value="profile">{t("tab.profile")}</TabsTrigger>
        <TabsTrigger value="security">{t("tab.security")}</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <form
          aria-busy={savingPreferences}
          noValidate
          onSubmit={savePreferences}
        >
          <Card size="sm" variant="subtle">
            <CardHeader>
              <CardTitle>{t("personalTitle")}</CardTitle>
              <CardDescription>{t("personalDescription")}</CardDescription>
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
                    <Badge variant="success">{t("verified")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("unverified")}</Badge>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("memberSince")}{" "}
                    {format.dateTime(new Date(profile.createdAt), {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              <FieldGroup>
                <Field data-disabled={savingPreferences}>
                  <FieldLabel htmlFor="profile-display-name">
                    {t("displayName")}{" "}
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
                      {t("preferredLanguage")}
                    </FieldLabel>
                    <Select
                      disabled={savingPreferences}
                      onValueChange={(value) => {
                        setLocale(value === "system" ? "" : value)
                      }}
                      value={locale || "system"}
                    >
                      <SelectTrigger className="w-full" id="profile-locale">
                        <SelectValue placeholder={t("usePortalLanguage")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="system">
                            {t("usePortalLanguage")}
                          </SelectItem>
                          {languages.map((language) => (
                            <SelectItem
                              key={language.code}
                              value={language.code}
                            >
                              {language.nativeName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field data-disabled={savingPreferences}>
                    <FieldLabel htmlFor="profile-timezone">
                      {t("timezone")}{" "}
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
              {t("saveProfile")}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="security">
        <form aria-busy={savingPassword} noValidate onSubmit={savePassword}>
          <Card size="sm" variant="subtle">
            <CardHeader>
              <CardTitle>{t("passwordTitle")}</CardTitle>
              <CardDescription>{t("passwordDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={savingPassword}>
                  <FieldLabel htmlFor="current-password">
                    {t("currentPassword")}{" "}
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
                      {t("newPassword")}{" "}
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
                      {t("confirmPassword")}{" "}
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
                <FieldDescription>{t("passwordHint")}</FieldDescription>
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
              {t("updatePassword")}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  )
}
