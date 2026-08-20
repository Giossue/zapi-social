import { redirect } from "next/navigation"

export default function AiSearchRedirect() {
  redirect("/portal/ai-studio?tool=search")
}
