import type { PublishingCalendarData } from "@/features/publishing/types/publishing-calendar"

/** Datos sintéticos; estructura basada en PublishingCalendar Laravel. */
export const publishingCalendarFixture: PublishingCalendarData = {
  focusDate: "2026-07-31",
  posts: [
    { id: "post_01", date: "2026-07-27", time: "09:30", title: "Behind the scenes: nueva colección", channel: "Instagram", provider: "instagram", status: "published" },
    { id: "post_02", date: "2026-07-28", time: "11:00", title: "Guía rápida para planificar contenido", channel: "LinkedIn", provider: "linkedin", status: "scheduled" },
    { id: "post_03", date: "2026-07-29", time: "15:30", title: "Caso de estudio: crecimiento orgánico", channel: "Facebook", provider: "facebook", status: "pending" },
    { id: "post_04", date: "2026-07-30", time: "10:00", title: "Ideas para el calendario de agosto", channel: "Instagram", provider: "instagram", status: "scheduled" },
    { id: "post_05", date: "2026-07-31", time: "12:30", title: "Anuncio de producto", channel: "Instagram", provider: "instagram", status: "scheduled" },
    { id: "post_06", date: "2026-07-31", time: "16:00", title: "Actualización semanal del equipo", channel: "LinkedIn", provider: "linkedin", status: "draft" },
    { id: "post_07", date: "2026-08-01", time: "09:00", title: "Resumen de comunidad", channel: "Facebook", provider: "facebook", status: "failed" },
    { id: "post_08", date: "2026-08-02", time: "18:00", title: "Consejo de fin de semana", channel: "Instagram", provider: "instagram", status: "scheduled" },
  ],
}
