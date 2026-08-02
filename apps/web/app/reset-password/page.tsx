import { ResetPasswordForm } from "@/features/identity/components/password-reset-forms"
import { Suspense } from "react"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
