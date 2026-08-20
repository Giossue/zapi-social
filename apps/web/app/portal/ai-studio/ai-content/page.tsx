import { redirect } from "next/navigation"

export default function AiContentRedirect() {
  redirect("/portal/ai-studio?tool=content")
}
