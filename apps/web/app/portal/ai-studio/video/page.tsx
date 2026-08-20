import { redirect } from "next/navigation"

export default function AiVideoRedirect() {
  redirect("/portal/ai-studio?tool=video")
}
