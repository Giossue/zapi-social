"use client"

import type { CSSProperties } from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Droplets, KeyRound, Link2, Share2, WandSparkles } from "lucide-react"

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
    labelKey: "automation",
    value: "automation",
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
      className="hidden min-h-svh self-stretch border-r border-sidebar-border md:flex"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 60)",
        } as CSSProperties
      }
    >
      <SidebarHeader className="flex min-h-14 items-center px-3">
        <span className="font-heading text-lg font-semibold tracking-tight">
          {t("settings")}
        </span>
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
