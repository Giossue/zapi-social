"use client"

import { ApiError, authApi, teamsApi } from "@workspace/api-client"
import type {
  AuthSession,
  PublicPortalTeamInvitationPreview,
} from "@workspace/contracts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
import { Separator } from "@workspace/ui/components/separator"
import { PageLoading } from "@/components/page-loading"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LogIn,
  MailCheck,
  RotateCcw,
  UserRoundCog,
  Users,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type InvitationPageState =
  | "loading"
  | "ready"
  | "accepting"
  | "success"
  | "missing"
  | "invalid"
  | "expired"
  | "used"
  | "full"
  | "mismatch"
  | "error"

const invitationTokenStorageKey = "zapi:team-invitation-token"
const returnToInvite = encodeURIComponent("/invite")

const problemStates = [
  "missing",
  "invalid",
  "expired",
  "used",
  "full",
  "mismatch",
  "error",
] as const

function stateForError(error: unknown): InvitationPageState {
  if (!(error instanceof ApiError)) return "error"
  if (error.code === "INVITATION_INVALID") return "invalid"
  if (error.code === "INVITATION_EXPIRED") return "expired"
  if (error.code === "INVITATION_ALREADY_USED") return "used"
  if (error.code === "INVITATION_EMAIL_MISMATCH") return "mismatch"
  if (error.code === "MEMBER_LIMIT_REACHED") return "full"
  return "error"
}

function readInvitationToken() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const hashToken = hash.get("token")?.trim()
  if (hashToken) {
    window.sessionStorage.setItem(invitationTokenStorageKey, hashToken)
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    )
    return hashToken
  }
  return window.sessionStorage.getItem(invitationTokenStorageKey)?.trim() ?? ""
}

function InvitationLoading() {
  return (
    <Card className="w-full max-w-lg">
      <CardContent>
        <PageLoading />
      </CardContent>
    </Card>
  )
}

export function InvitationPage() {
  const t = useTranslations("teams.invitation")
  const format = useFormatter()
  const router = useRouter()
  const [state, setState] = useState<InvitationPageState>("loading")
  const [token, setToken] = useState("")
  const [preview, setPreview] =
    useState<PublicPortalTeamInvitationPreview | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [acceptedWorkspaceId, setAcceptedWorkspaceId] = useState<string | null>(
    null
  )

  const loadInvitation = useCallback(async () => {
    setState("loading")
    const storedToken = readInvitationToken()
    if (!storedToken) {
      setState("missing")
      return
    }
    setToken(storedToken)

    try {
      const [invitation, currentSession] = await Promise.all([
        teamsApi.previewInvitation({ token: storedToken }),
        authApi.session().catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 401) return null
          throw error
        }),
      ])
      setPreview(invitation)
      setSession(currentSession)

      if (invitation.status === "accepted" && !currentSession) {
        setState("used")
        return
      }
      if (
        currentSession &&
        (currentSession.area !== "portal" ||
          currentSession.user.email.toLocaleLowerCase("en-US") !==
            invitation.invitedEmail.toLocaleLowerCase("en-US"))
      ) {
        setState("mismatch")
        return
      }
      setState("ready")
    } catch (error) {
      setState(stateForError(error))
    }
  }, [])

  useEffect(() => {
    const loadAfterMount = window.setTimeout(() => void loadInvitation(), 0)
    return () => window.clearTimeout(loadAfterMount)
  }, [loadInvitation])

  async function acceptInvitation() {
    if (!token || !preview || session?.area !== "portal") return
    setState("accepting")
    try {
      let workspaceId = acceptedWorkspaceId
      if (!workspaceId) {
        const result = await teamsApi.acceptInvitation({ token })
        workspaceId = result.workspace.id
        setAcceptedWorkspaceId(workspaceId)
      }
      await authApi.activateWorkspace({ workspaceId })
      window.sessionStorage.removeItem(invitationTokenStorageKey)
      setState("success")
      router.refresh()
    } catch (error) {
      setState(stateForError(error))
    }
  }

  async function switchAccount() {
    try {
      await authApi.logout()
    } finally {
      router.replace(`/login?returnTo=${returnToInvite}`)
      router.refresh()
    }
  }

  function continueWithAuthentication() {
    const path = preview?.accountExists ? "/login" : "/register"
    router.push(`${path}?returnTo=${returnToInvite}`)
  }

  function retryInvitation() {
    if (acceptedWorkspaceId) {
      void acceptInvitation()
      return
    }
    void loadInvitation()
  }

  if (state === "loading") return <InvitationLoading />

  if (state === "success") {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CheckCircle2 aria-hidden="true" className="size-10 text-primary" />
          <CardTitle aria-level={1} role="heading">
            {t("alreadyMember")}
          </CardTitle>
          <CardDescription>
            {t("accessActivated", { workspace: preview?.workspaceName ?? "" })}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/portal/teams">
              <ArrowRight data-icon="inline-start" /> {t("openWorkspace")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const isProblem = (problemStates as readonly string[]).includes(state)
  if (isProblem) {
    let problemAction = (
      <Button asChild className="flex-1">
        <Link href={`/login?returnTo=${returnToInvite}`}>
          <LogIn data-icon="inline-start" /> {t("signIn")}
        </Link>
      </Button>
    )
    if (state === "error") {
      problemAction = (
        <Button className="flex-1" onClick={retryInvitation}>
          <RotateCcw data-icon="inline-start" /> {t("retry")}
        </Button>
      )
    } else if (state === "mismatch") {
      problemAction = (
        <Button className="flex-1" onClick={() => void switchAccount()}>
          <UserRoundCog data-icon="inline-start" /> {t("useAnotherAccount")}
        </Button>
      )
    } else if (state === "full" && session?.area === "portal") {
      problemAction = (
        <Button asChild className="flex-1">
          <Link href="/portal/teams">
            <Users data-icon="inline-start" /> {t("backToTeams")}
          </Link>
        </Button>
      )
    }

    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <AlertCircle
            aria-hidden="true"
            className="size-10 text-muted-foreground"
          />
          <CardTitle aria-level={1} role="heading">
            {t(`problem.${state}.title` as "problem.error.title")}
          </CardTitle>
          <CardDescription>
            {t(`problem.${state}.description` as "problem.error.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert
            variant={
              state === "error" || state === "mismatch"
                ? "destructive"
                : "default"
            }
          >
            <AlertTitle>{t("unavailableTitle")}</AlertTitle>
            <AlertDescription>{t("unavailableDescription")}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="gap-2">
          {problemAction}
          <Button asChild className="flex-1" variant="outline">
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const hasSession = session?.area === "portal"
  let primaryLabel = preview?.accountExists
    ? t("signInToContinue")
    : t("signUpToContinue")
  if (hasSession) primaryLabel = t("accept")
  if (state === "accepting") primaryLabel = t("accepting")

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <MailCheck aria-hidden="true" className="size-10 text-primary" />
        <CardTitle aria-level={1} role="heading">
          {t("invitedTitle")}
        </CardTitle>
        <CardDescription>
          {t("invitedDescription", { email: preview?.invitedEmail ?? "" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Users aria-hidden="true" className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{preview?.workspaceName}</p>
            <p className="text-sm text-muted-foreground">{t("workspace")}</p>
          </div>
          <Badge variant="secondary">
            {t(`role.${preview?.role === "admin" ? "admin" : "member"}`)}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Clock3 aria-hidden="true" className="size-5" />
          <span>
            {t("availableUntil", {
              date: preview
                ? format.dateTime(new Date(preview.expiresAt), {
                    dateStyle: "medium",
                  })
                : "—",
            })}
          </span>
        </div>
        {state === "accepting" ? (
          <Alert>
            <Spinner />
            <AlertTitle>{t("activatingTitle")}</AlertTitle>
            <AlertDescription>{t("activatingDescription")}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          className="flex-1"
          disabled={state === "accepting"}
          onClick={() =>
            void (hasSession
              ? acceptInvitation()
              : continueWithAuthentication())
          }
        >
          {state === "accepting" ? (
            <Spinner aria-label={t("accepting")} data-icon="inline-start" />
          ) : (
            <MailCheck data-icon="inline-start" />
          )}
          {primaryLabel}
        </Button>
        <Button asChild className="flex-1" variant="outline">
          <Link href={hasSession ? "/portal/dashboard" : "/login"}>
            {t("notNow")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
