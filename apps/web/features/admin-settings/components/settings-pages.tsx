"use client"

import { adminSettingsApi } from "@workspace/api-client"
import type {
  AdminAnalyticsSettings,
  AdminAuthSettings,
  AdminGeneralSettings,
  AdminPublicSiteSettings,
} from "@workspace/contracts"

import { useTranslations } from "next-intl"

import { SettingsFormPage } from "./settings-form-page"

export function GeneralSettingsPage() {
  const t = useTranslations("adminSettings")

  return (
    <SettingsFormPage<AdminGeneralSettings>
      description={t("general.description")}
      fields={[
        { kind: "text", label: t("general.siteName"), name: "siteName" },
        {
          kind: "textarea",
          label: t("general.siteDescription"),
          name: "siteDescription",
          description: t("general.siteDescriptionHint"),
        },
        { kind: "text", label: t("general.companyName"), name: "companyName" },
        {
          kind: "text",
          label: t("general.contactEmail"),
          name: "contactEmail",
        },
        {
          kind: "text",
          label: t("general.contactPhone"),
          name: "contactPhone",
        },
        {
          kind: "text",
          label: t("general.supportHours"),
          name: "supportHours",
        },
        {
          kind: "text",
          label: t("general.dateFormat"),
          name: "dateFormat",
          description: t("general.dateFormatHint"),
        },
        {
          kind: "text",
          label: t("general.timezone"),
          name: "timezone",
          description: t("general.timezoneHint"),
        },
      ]}
      load={() => adminSettingsApi.general()}
      save={(values) => adminSettingsApi.saveGeneral(values)}
      title={t("general.title")}
    />
  )
}

export function AuthSettingsPage() {
  const t = useTranslations("adminSettings")

  return (
    <SettingsFormPage<AdminAuthSettings>
      description={t("auth.description")}
      fields={[
        {
          kind: "switch",
          label: t("auth.registrationEnabled"),
          name: "registrationEnabled",
          description: t("auth.registrationHint"),
        },
        {
          kind: "switch",
          label: t("auth.requireEmailVerification"),
          name: "requireEmailVerification",
        },
        {
          kind: "number",
          label: t("auth.passwordMinLength"),
          name: "passwordMinLength",
        },
        {
          kind: "number",
          label: t("auth.sessionLifetimeHours"),
          name: "sessionLifetimeHours",
        },
        {
          kind: "number",
          label: t("auth.maxLoginAttempts"),
          name: "maxLoginAttempts",
        },
      ]}
      load={() => adminSettingsApi.auth()}
      save={(values) => adminSettingsApi.saveAuth(values)}
      title={t("auth.title")}
    />
  )
}

export function AnalyticsSettingsPage() {
  const t = useTranslations("adminSettings")

  return (
    <SettingsFormPage<AdminAnalyticsSettings>
      description={t("analytics.description")}
      fields={[
        {
          kind: "switch",
          label: t("analytics.enabled"),
          name: "googleAnalyticsEnabled",
        },
        {
          kind: "text",
          label: t("analytics.measurementId"),
          name: "googleAnalyticsMeasurementId",
          placeholder: "G-XXXXXXXXXX",
        },
        {
          kind: "switch",
          label: t("analytics.trackGuests"),
          name: "trackGuests",
        },
        {
          kind: "switch",
          label: t("analytics.trackPortal"),
          name: "trackPortal",
        },
      ]}
      load={() => adminSettingsApi.analytics()}
      save={(values) => adminSettingsApi.saveAnalytics(values)}
      title={t("analytics.title")}
    />
  )
}

export function PublicSiteSettingsPage() {
  const t = useTranslations("adminSettings")

  return (
    <SettingsFormPage<AdminPublicSiteSettings>
      description={t("publicSite.description")}
      fields={[
        {
          kind: "switch",
          label: t("publicSite.landingEnabled"),
          name: "landingEnabled",
          description: t("publicSite.landingEnabledHint"),
        },
        {
          kind: "switch",
          label: t("publicSite.showPricing"),
          name: "showPricing",
        },
        {
          kind: "switch",
          label: t("publicSite.showFaqs"),
          name: "showFaqs",
        },
        {
          kind: "switch",
          label: t("publicSite.showBlog"),
          name: "showBlog",
        },
        {
          kind: "switch",
          label: t("publicSite.showLanguages"),
          name: "showLanguages",
        },
        {
          kind: "switch",
          label: t("publicSite.showContact"),
          name: "showContact",
          description: t("publicSite.showContactHint"),
        },
        {
          kind: "number",
          label: t("publicSite.featuredPlansLimit"),
          name: "featuredPlansLimit",
          description: t("publicSite.limitsHint"),
        },
        {
          kind: "number",
          label: t("publicSite.featuredFaqsLimit"),
          name: "featuredFaqsLimit",
        },
        {
          kind: "number",
          label: t("publicSite.latestPostsLimit"),
          name: "latestPostsLimit",
        },
      ]}
      load={() => adminSettingsApi.publicSite()}
      save={(values) => adminSettingsApi.savePublicSite(values)}
      title={t("publicSite.title")}
    />
  )
}
