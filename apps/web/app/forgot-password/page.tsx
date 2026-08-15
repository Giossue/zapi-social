import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/features/identity/components/password-reset-forms"

export const metadata: Metadata = {
  title: "Recuperar contraseña - Zapi Social",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
