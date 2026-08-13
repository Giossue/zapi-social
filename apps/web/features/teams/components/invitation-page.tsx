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
import { PageLoading } from "@workspace/ui/components/page-loading"
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

const problemCopy: Partial<
  Record<InvitationPageState, { title: string; description: string }>
> = {
  missing: {
    title: "Falta el enlace de invitación",
    description: "Abre nuevamente el enlace completo que recibiste por correo.",
  },
  invalid: {
    title: "Esta invitación no es válida",
    description:
      "El enlace puede estar incompleto o haber sido reemplazado por una invitación más reciente.",
  },
  expired: {
    title: "Esta invitación venció",
    description:
      "Pide a un administrador del espacio de trabajo que te envíe una nueva invitación.",
  },
  used: {
    title: "Esta invitación ya fue utilizada",
    description:
      "Inicia sesión para abrir tus espacios de trabajo disponibles.",
  },
  full: {
    title: "El espacio alcanzó su límite",
    description:
      "La invitación sigue pendiente, pero un administrador debe liberar un cupo antes de que puedas entrar.",
  },
  mismatch: {
    title: "La invitación pertenece a otro correo",
    description:
      "Cierra esta sesión e inicia con la cuenta que recibió la invitación.",
  },
  error: {
    title: "No pudimos comprobar la invitación",
    description: "Revisa tu conexión e inténtalo nuevamente.",
  },
}

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
            Ya formas parte del espacio
          </CardTitle>
          <CardDescription>
            Tu acceso a {preview?.workspaceName} quedó activado correctamente.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/portal/teams">
              <ArrowRight data-icon="inline-start" /> Abrir espacio de trabajo
            </Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const problem = problemCopy[state]
  if (problem) {
    let problemAction = (
      <Button asChild className="flex-1">
        <Link href={`/login?returnTo=${returnToInvite}`}>
          <LogIn data-icon="inline-start" /> Iniciar sesión
        </Link>
      </Button>
    )
    if (state === "error") {
      problemAction = (
        <Button className="flex-1" onClick={retryInvitation}>
          <RotateCcw data-icon="inline-start" /> Reintentar
        </Button>
      )
    } else if (state === "mismatch") {
      problemAction = (
        <Button className="flex-1" onClick={() => void switchAccount()}>
          <UserRoundCog data-icon="inline-start" /> Usar otra cuenta
        </Button>
      )
    } else if (state === "full" && session?.area === "portal") {
      problemAction = (
        <Button asChild className="flex-1">
          <Link href="/portal/teams">
            <Users data-icon="inline-start" /> Volver a Teams
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
            {problem.title}
          </CardTitle>
          <CardDescription>{problem.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert
            variant={
              state === "error" || state === "mismatch"
                ? "destructive"
                : "default"
            }
          >
            <AlertTitle>Invitación no disponible</AlertTitle>
            <AlertDescription>
              Ningún cambio adicional fue realizado en tu cuenta.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="gap-2">
          {problemAction}
          <Button asChild className="flex-1" variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const hasSession = session?.area === "portal"
  let primaryLabel = preview?.accountExists
    ? "Iniciar sesión para continuar"
    : "Crear cuenta para continuar"
  if (hasSession) primaryLabel = "Aceptar invitación"
  if (state === "accepting") primaryLabel = "Aceptando…"

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <MailCheck aria-hidden="true" className="size-10 text-primary" />
        <CardTitle aria-level={1} role="heading">
          Te invitaron a un espacio de trabajo
        </CardTitle>
        <CardDescription>
          Confirma tu cuenta para unirte. La invitación solo funciona con{" "}
          {preview?.invitedEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Users aria-hidden="true" className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{preview?.workspaceName}</p>
            <p className="text-sm text-muted-foreground">Espacio de trabajo</p>
          </div>
          <Badge variant="secondary">
            {preview?.role === "admin" ? "Administrador" : "Miembro"}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Clock3 aria-hidden="true" className="size-5" />
          <span>
            Disponible hasta{" "}
            {preview
              ? new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
                  new Date(preview.expiresAt)
                )
              : "—"}
          </span>
        </div>
        {state === "accepting" ? (
          <Alert>
            <Spinner />
            <AlertTitle>Activando acceso</AlertTitle>
            <AlertDescription>
              Estamos preparando el espacio de trabajo.
            </AlertDescription>
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
            <Spinner aria-label="Aceptando" data-icon="inline-start" />
          ) : (
            <MailCheck data-icon="inline-start" />
          )}
          {primaryLabel}
        </Button>
        <Button asChild className="flex-1" variant="outline">
          <Link href={hasSession ? "/portal/dashboard" : "/login"}>
            Ahora no
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
