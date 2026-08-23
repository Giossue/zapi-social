export type RssScheduleStatus = "active" | "paused"

/**
 * La fila conserva los instantes en crudo: el texto de «próxima ejecución» y
 * el formato de fecha dependen del idioma activo y se resuelven al renderizar.
 */
export type RssSchedule = {
  id: string
  name: string
  feedUrl: string
  targets: string[]
  status: RssScheduleStatus
  nextRunAt: string | null
  lastRunAt: string | null
  queued: number
}
