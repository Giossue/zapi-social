import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ForgotPasswordForm } from "@/features/identity/components/password-reset-forms"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.metadata")
  return { title: t("forgotPassword") }
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
