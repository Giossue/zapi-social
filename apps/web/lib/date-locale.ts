"use client"

import enUS from "@fullcalendar/react/locales/en-gb"
import esLocale from "@fullcalendar/react/locales/es"
import { enUS as enUSFns, es as esFns } from "date-fns/locale"
import { useLocale } from "next-intl"

export function useDateLocale() {
  const locale = useLocale()

  return {
    dateFns: locale === "en" ? enUSFns : esFns,
    fullCalendar: locale === "en" ? enUS : esLocale,
  }
}
