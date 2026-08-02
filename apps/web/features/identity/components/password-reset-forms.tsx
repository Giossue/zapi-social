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
import { toast } from "@workspace/ui/components/toast"
import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"

function RecoveryLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode
  title: string
  description: string
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10 text-foreground sm:px-6">
      <Card variant="surface" className="w-full max-w-md">
        <CardHeader className="gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-primary">
            <ShieldCheck aria-hidden="true" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  )
}

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(
      new FormData(event.currentTarget).get("email") ?? ""
    ).trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Ingresa un correo electrónico válido.")
      return
    }
    setSubmitting(true)
    try {
      await authApi.requestPasswordReset({ email })
      setSent(true)
    } catch {
      toast.error("No pudimos procesar la solicitud. Inténtalo de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RecoveryLayout
      description="Te enviaremos instrucciones si existe una cuenta asociada al correo."
      title="Recupera tu acceso"
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-success"
            />
            Si el correo existe, recibirás un enlace de recuperación en unos
            minutos.
          </p>
          <Button asChild variant="brand-secondary">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
          <label
            className="grid gap-1.5 text-sm font-medium"
            htmlFor="recovery-email"
          >
            <span>
              Correo electrónico
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </span>
            <Input
              autoComplete="email"
              id="recovery-email"
              name="email"
              required
              type="email"
            />
          </label>
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Mail data-icon="inline-start" />
            )}
            {submitting ? "Enviando" : "Enviar instrucciones"}
          </Button>
          <Link
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </RecoveryLayout>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "")
    if (!token) {
      toast.error("El enlace de recuperación no es válido.")
      return
    }
    if (password.length < 8 || password !== passwordConfirmation) {
      toast.error("Revisa la contraseña y su confirmación.")
      return
    }
    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset({
        token,
        password,
        passwordConfirmation,
      })
      setCompleted(true)
      toast.success(
        "Contraseña actualizada. Inicia sesión con la nueva contraseña."
      )
      router.replace("/login")
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "AUTH_PASSWORD_RESET_TOKEN_INVALID"
      ) {
        toast.error("Este enlace ya no es válido. Solicita uno nuevo.")
      } else if (
        error instanceof ApiError &&
        error.code === "AUTH_PASSWORD_POLICY_NOT_MET"
      ) {
        toast.error(
          "La contraseña debe incluir mayúscula, minúscula, número y carácter especial."
        )
      } else {
        toast.error("No pudimos restablecer la contraseña. Inténtalo de nuevo.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!token)
    return (
      <RecoveryLayout
        description="Solicita un enlace nuevo para continuar."
        title="Enlace no válido"
      >
        <Button asChild>
          <Link href="/forgot-password">Solicitar recuperación</Link>
        </Button>
      </RecoveryLayout>
    )
  if (completed)
    return (
      <RecoveryLayout
        description="Ya puedes iniciar sesión con tu nueva contraseña."
        title="Contraseña actualizada"
      >
        <Button asChild>
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </RecoveryLayout>
    )

  return (
    <RecoveryLayout
      description="Elige una contraseña nueva. El enlace solo se puede usar una vez."
      title="Crea una nueva contraseña"
    >
      <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
        <label
          className="grid gap-1.5 text-sm font-medium"
          htmlFor="reset-password"
        >
          <span>
            Nueva contraseña
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          </span>
          <Input
            autoComplete="new-password"
            id="reset-password"
            maxLength={128}
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <label
          className="grid gap-1.5 text-sm font-medium"
          htmlFor="reset-password-confirmation"
        >
          <span>
            Confirmar contraseña
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          </span>
          <Input
            autoComplete="new-password"
            id="reset-password-confirmation"
            maxLength={128}
            minLength={8}
            name="passwordConfirmation"
            required
            type="password"
          />
        </label>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <KeyRound aria-hidden="true" className="mt-0.5 shrink-0" />
          Usa 8 o más caracteres, con mayúscula, minúscula, número y carácter
          especial.
        </p>
        <Button disabled={submitting} type="submit">
          {submitting ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <KeyRound data-icon="inline-start" />
          )}
          {submitting ? "Actualizando" : "Restablecer contraseña"}
        </Button>
      </form>
    </RecoveryLayout>
  )
}
