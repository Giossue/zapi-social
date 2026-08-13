import type { Metadata } from "next"
import { Spinner } from "@workspace/ui/components/spinner"
import { Suspense } from "react"

import { AuthShell } from "@/features/identity/components/auth-page"
import { ResetPasswordForm } from "@/features/identity/components/password-reset-forms"

export const metadata: Metadata = {
  title: "Restablecer contraseña | Zapi Social",
}

function ResetPasswordLoading() {
  return (
    <AuthShell>
      <div aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner aria-hidden="true" />
        Cargando…
      </div>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
