import type { Metadata } from "next"
import { Spinner } from "@workspace/ui/components/spinner"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { AuthShell } from "@/features/identity/components/auth-page"
import { ResetPasswordForm } from "@/features/identity/components/password-reset-forms"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.metadata")
  return { title: t("resetPassword") }
}

/** El fallback se renderiza de forma síncrona: recibe el texto ya traducido. */
function ResetPasswordLoading({ label }: { label: string }) {
  return (
    <AuthShell>
      <div
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Spinner aria-hidden="true" />
        {label}
      </div>
    </AuthShell>
  )
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("common")

  return (
    <Suspense fallback={<ResetPasswordLoading label={t("loading")} />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
