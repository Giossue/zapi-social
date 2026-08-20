import { redirect } from "next/navigation"

export default function AiTimingRedirect() {
  redirect("/portal/ai-studio?tool=timing")
}
