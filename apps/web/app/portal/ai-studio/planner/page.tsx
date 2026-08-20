import { redirect } from "next/navigation"

export default function AiPlannerRedirect() {
  redirect("/portal/ai-studio?tool=planner")
}
