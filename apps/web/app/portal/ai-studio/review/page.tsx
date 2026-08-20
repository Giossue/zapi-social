import { redirect } from "next/navigation"

export default function AiReviewRedirect() {
  redirect("/portal/ai-studio?tool=review")
}
