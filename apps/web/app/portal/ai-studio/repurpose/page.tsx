import { redirect } from "next/navigation"

export default function AiRepurposeRedirect() {
  redirect("/portal/ai-studio?tool=repurpose")
}
