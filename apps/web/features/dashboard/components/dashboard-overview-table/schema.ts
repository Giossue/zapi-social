import { z } from "zod"

const dashboardOverviewRowSchema = z.object({
  id: z.string(),
  category: z.enum(["Atención", "Publicación", "Biblioteca"]),
  title: z.string(),
  detail: z.string(),
  value: z.string(),
  href: z.string(),
})

export type DashboardOverviewRow = z.infer<typeof dashboardOverviewRowSchema>
