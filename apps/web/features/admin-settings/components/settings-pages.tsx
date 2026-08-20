"use client"

import { adminSettingsApi } from "@workspace/api-client"
import type {
  AdminAnalyticsSettings,
  AdminAuthSettings,
  AdminGeneralSettings,
} from "@workspace/contracts"

import { SettingsFormPage } from "./settings-form-page"

export function GeneralSettingsPage() {
  return (
    <SettingsFormPage<AdminGeneralSettings>
      description="Identidad pública de la plataforma y datos de contacto."
      fields={[
        { kind: "text", label: "Nombre del sitio", name: "siteName" },
        {
          kind: "textarea",
          label: "Descripción",
          name: "siteDescription",
          description: "Se usa en metadatos y en la portada pública.",
        },
        { kind: "text", label: "Empresa", name: "companyName" },
        { kind: "text", label: "Correo de contacto", name: "contactEmail" },
        { kind: "text", label: "Teléfono", name: "contactPhone" },
        { kind: "text", label: "Horario de atención", name: "supportHours" },
        {
          kind: "text",
          label: "Formato de fecha",
          name: "dateFormat",
          description: "Por ejemplo d MMM yyyy.",
        },
        {
          kind: "text",
          label: "Zona horaria",
          name: "timezone",
          description: "Zona IANA, por ejemplo America/Guayaquil.",
        },
      ]}
      load={() => adminSettingsApi.general()}
      save={(values) => adminSettingsApi.saveGeneral(values)}
      title="Ajustes generales"
    />
  )
}

export function AuthSettingsPage() {
  return (
    <SettingsFormPage<AdminAuthSettings>
      description="Reglas de registro, verificación y sesión para las cuentas del Portal."
      fields={[
        {
          kind: "switch",
          label: "Permitir registro",
          name: "registrationEnabled",
          description: "Si se desactiva, solo se entra por invitación.",
        },
        {
          kind: "switch",
          label: "Exigir verificación de correo",
          name: "requireEmailVerification",
        },
        {
          kind: "number",
          label: "Longitud mínima de contraseña",
          name: "passwordMinLength",
        },
        {
          kind: "number",
          label: "Duración de sesión (horas)",
          name: "sessionLifetimeHours",
        },
        {
          kind: "number",
          label: "Intentos de acceso permitidos",
          name: "maxLoginAttempts",
        },
      ]}
      load={() => adminSettingsApi.auth()}
      save={(values) => adminSettingsApi.saveAuth(values)}
      title="Acceso y registro"
    />
  )
}

export function AnalyticsSettingsPage() {
  return (
    <SettingsFormPage<AdminAnalyticsSettings>
      description="Medición de uso con Google Analytics."
      fields={[
        {
          kind: "switch",
          label: "Activar Google Analytics",
          name: "googleAnalyticsEnabled",
        },
        {
          kind: "text",
          label: "ID de medición",
          name: "googleAnalyticsMeasurementId",
          placeholder: "G-XXXXXXXXXX",
        },
        {
          kind: "switch",
          label: "Medir visitas públicas",
          name: "trackGuests",
        },
        {
          kind: "switch",
          label: "Medir uso dentro del Portal",
          name: "trackPortal",
        },
      ]}
      load={() => adminSettingsApi.analytics()}
      save={(values) => adminSettingsApi.saveAnalytics(values)}
      title="Analíticas"
    />
  )
}
