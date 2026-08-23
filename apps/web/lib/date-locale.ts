"use client"

import enUS from "@fullcalendar/react/locales/en-gb"
import esLocale from "@fullcalendar/react/locales/es"
import { enUS as enUSFns, es as esFns } from "date-fns/locale"
import { useLocale } from "next-intl"

/**
 * `date-fns` y FullCalendar traen sus propios catálogos de idioma. Este helper
 * los alinea con el idioma activo de la interfaz para que los nombres de mes y
 * los encabezados del calendario no queden fijos en español.
 */
export function useDateLocale() {
  const locale = useLocale()

  return {
    dateFns: locale === "en" ? enUSFns : esFns,
    fullCalendar: locale === "en" ? enUS : esLocale,
  }
}
