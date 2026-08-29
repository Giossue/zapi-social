"use client"

import type { CSSProperties } from "react"

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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

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

export function PortalSettingsSidebar() {
  const pathname = usePathname()
  const t = useTranslations("navigation.portal")
  const activeItem =
    settingsItems
      .filter((item) => pathname.startsWith(item.href))
      .sort((first, second) => second.href.length - first.href.length)[0] ??
    settingsItems[0]

  return (
    <Sidebar
      collapsible="none"
      className="hidden border-r border-sidebar-border md:flex"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 56)",
        } as CSSProperties
      }
    >
      <SidebarHeader>
        <h1 className="px-2 py-2 text-lg font-semibold">{t("settings")}</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu aria-label={t("settings")}>
              {settingsItems.map((item) => {
                const Icon = item.icon
                const isActive = item.value === activeItem.value

                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        href={item.href}
                      >
                        <Icon />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
