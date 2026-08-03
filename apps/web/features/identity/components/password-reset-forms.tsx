"use client"

import { ApiError, authApi } from "@workspace/api-client"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent, type ReactNode } from "react"

import { AuthShell } from "./auth-page"

function RecoveryLayout({
  children,
  title,
  description,
}: {
  children: ReactNode
  title: string
  description: string
}) {
  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </AuthShell>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function reportError(message: string) {
    setFormError(message)
    toast.error(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reportError("Ingresa un correo electrónico válido.")
      return
    }

    setSubmitting(true)
    try {
      await authApi.requestPasswordReset({ email })
      setSent(true)
    } catch {
      reportError("No pudimos procesar la solicitud. Inténtalo de nuevo.")
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
        <div className="space-y-5">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            Si el correo existe, recibirás un enlace de recuperación en unos minutos.
          </p>
          <Button asChild className="w-full" variant="brand-secondary">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
          <FormError message={formError} />
          <FieldGroup>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="recovery-email">
                Correo electrónico <span aria-hidden="true" className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    <Mail aria-hidden="true" />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput autoComplete="email" id="recovery-email" name="email" required type="email" />
              </InputGroup>
            </Field>
          </FieldGroup>
          <Button className="w-full" disabled={submitting} type="submit">
            {submitting ? <Spinner aria-label="Enviando" data-icon="inline-start" /> : <Mail data-icon="inline-start" />}
            {submitting ? "Enviando" : "Enviar instrucciones"}
          </Button>
          <Link className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/login">
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
  const [formError, setFormError] = useState<string | null>(null)

  function reportError(message: string) {
    setFormError(message)
    toast.error(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "")
    if (!token) {
      reportError("El enlace de recuperación no es válido.")
      return
    }
    if (password.length < 8 || password !== passwordConfirmation) {
      reportError("Revisa la contraseña y su confirmación.")
      return
    }

    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset({ token, password, passwordConfirmation })
      setCompleted(true)
      toast.success("Contraseña actualizada. Inicia sesión con la nueva contraseña.")
      router.replace("/login")
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_PASSWORD_RESET_TOKEN_INVALID") {
        reportError("Este enlace ya no es válido. Solicita uno nuevo.")
      } else if (error instanceof ApiError && error.code === "AUTH_PASSWORD_POLICY_NOT_MET") {
        reportError("La contraseña debe incluir mayúscula, minúscula, número y carácter especial.")
      } else {
        reportError("No pudimos restablecer la contraseña. Inténtalo de nuevo.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <RecoveryLayout description="Solicita un enlace nuevo para continuar." title="Enlace no válido">
        <Button asChild className="w-full">
          <Link href="/forgot-password">Solicitar recuperación</Link>
        </Button>
      </RecoveryLayout>
    )
  }

  if (completed) {
    return (
      <RecoveryLayout description="Ya puedes iniciar sesión con tu nueva contraseña." title="Contraseña actualizada">
        <Button asChild className="w-full">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </RecoveryLayout>
    )
  }

  return (
    <RecoveryLayout
      description="Elige una contraseña nueva. El enlace solo se puede usar una vez."
      title="Crea una nueva contraseña"
    >
      <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
        <FormError message={formError} />
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="reset-password">
              Nueva contraseña <span aria-hidden="true" className="text-destructive">*</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <KeyRound aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="new-password"
                id="reset-password"
                maxLength={128}
                minLength={8}
                name="password"
                required
                type="password"
              />
            </InputGroup>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="reset-password-confirmation">
              Confirmar contraseña <span aria-hidden="true" className="text-destructive">*</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <KeyRound aria-hidden="true" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                autoComplete="new-password"
                id="reset-password-confirmation"
                maxLength={128}
                minLength={8}
                name="passwordConfirmation"
                required
                type="password"
              />
            </InputGroup>
          </Field>
        </FieldGroup>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Usa 8 o más caracteres, con mayúscula, minúscula, número y carácter especial.
        </p>
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? <Spinner aria-label="Actualizando" data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
          {submitting ? "Actualizando" : "Restablecer contraseña"}
        </Button>
      </form>
    </RecoveryLayout>
  )
}
