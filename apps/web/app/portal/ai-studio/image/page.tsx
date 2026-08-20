import { redirect } from "next/navigation"

export default function AiImageRedirect() {
  redirect("/portal/ai-studio?tool=image")
}
