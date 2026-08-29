"use client"

import type { ReactNode } from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Droplets,
  KeyRound,
  Link2,
  ScrollText,
  Share2,
  WandSparkles,
  Webhook,
} from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

type PortalSettingsLayoutProps = {
  children: ReactNode
}

const settingsItems = [
  {
    href: "/portal/settings/channels",
    icon: Share2,
    labelKey: "channels",
    value: "channels",
  },
  {
    href: "/portal/settings/ai-studio",
    icon: WandSparkles,
    labelKey: "aiSettings",
    value: "ai-studio",
  },
  {
    href: "/portal/settings/link-bio",
    icon: Link2,
    labelKey: "linkBio",
    value: "link-bio",
  },
  {
    href: "/portal/settings/watermarks",
    icon: Droplets,
    labelKey: "watermarks",
    value: "watermarks",
  },
  {
    href: "/portal/settings/automation",
    icon: KeyRound,
    labelKey: "automationKeys",
    value: "automation",
  },
  {
    href: "/portal/settings/automation/webhooks",
    icon: Webhook,
    labelKey: "automationWebhooks",
    value: "automation-webhooks",
  },
  {
    href: "/portal/settings/automation/logs",
    icon: ScrollText,
    labelKey: "automationLogs",
    value: "automation-logs",
  },
] as const

export function PortalSettingsLayout({ children }: PortalSettingsLayoutProps) {
  const pathname = usePathname()
  const t = useTranslations("navigation.portal")
  const activeItem =
    settingsItems
      .filter((item) => pathname.startsWith(item.href))
      .sort((first, second) => second.href.length - first.href.length)[0] ??
    settingsItems[0]

  return (
    <Tabs
      className="-m-4 min-h-[calc(100svh-var(--dashboard-header-height))] flex-col gap-0 md:-m-6 md:flex-row"
      orientation="vertical"
      value={activeItem.value}
    >
      <aside className="shrink-0 border-b px-4 py-4 md:w-56 md:border-r md:border-b-0">
        <h1 className="text-lg font-semibold">{t("settings")}</h1>
        <TabsList aria-label={t("settings")} className="mt-4 w-full">
          {settingsItems.map((item) => {
            const Icon = item.icon

            return (
              <TabsTrigger asChild key={item.value} value={item.value}>
                <Link href={item.href}>
                  <Icon />
                  {t(item.labelKey)}
                </Link>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </aside>
      <TabsContent className="m-0 min-w-0 p-4 md:p-6" value={activeItem.value}>
        {children}
      </TabsContent>
    </Tabs>
  )
}
