"use client"

import { integrationsApi } from "@workspace/api-client"
import type { ChannelProviderIntegration } from "@workspace/contracts"
import { Images, Mail, PlugZap } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useId,
  useState,
} from "react"

import {
  BrandGoogleDrive,
  BrandLinkedIn,
  BrandMeta,
  BrandPolar,
  BrandTikTok,
  BrandWhatsApp,
  BrandX,
} from "@/components/brand-icons"
import { useChannelLabels } from "@/lib/channel-labels"

import {
  IntegrationSidebar,
  type IntegrationNavigationItem,
} from "./integration-navigation-layout"

const builtInProviders = [
  { value: "pexels", labelKey: "pexels", icon: Images },
  { value: "meta", label: "Meta", icon: BrandMeta },
  { value: "whatsapp", label: "WhatsApp Status", icon: BrandWhatsApp },
  { value: "email", labelKey: "email", icon: Mail },
  { value: "polar", label: "Polar.sh", icon: BrandPolar },
  { value: "google-drive", label: "Google Drive", icon: BrandGoogleDrive },
] as const

const channelProviderIcons: Partial<
  Record<
    ChannelProviderIntegration["providerKey"],
    IntegrationNavigationItem["icon"]
  >
> = {
  linkedin: BrandLinkedIn,
  x: BrandX,
  tiktok: BrandTikTok,
}

type IntegrationsNavigationState = {
  activeProvider: string
  channelProviders: ChannelProviderIntegration[]
  contentId: string
  navigationItems: IntegrationNavigationItem[]
  navigationLabel: string
  setActiveProvider: Dispatch<SetStateAction<string>>
  setChannelProviders: Dispatch<SetStateAction<ChannelProviderIntegration[]>>
}

const IntegrationsNavigationContext =
  createContext<IntegrationsNavigationState | null>(null)

export function IntegrationsNavigationProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}) {
  const t = useTranslations("integrations")
  const labels = useChannelLabels()
  const contentId = useId()
  const [activeProvider, setActiveProvider] = useState("meta")
  const [channelProviders, setChannelProviders] = useState<
    ChannelProviderIntegration[]
  >([])
  const navigationItems: IntegrationNavigationItem[] = [
    ...builtInProviders.map((provider) => {
      const providerLabel =
        "labelKey" in provider ? t(`tab.${provider.labelKey}`) : provider.label

      return {
        value: provider.value,
        icon: provider.icon,
        label: providerLabel,
      }
    }),
    ...channelProviders.map((provider) => ({
      value: provider.providerKey,
      label: labels.provider(provider.providerKey),
      icon: channelProviderIcons[provider.providerKey] ?? PlugZap,
    })),
  ]

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const timer = setTimeout(() => {
      void integrationsApi
        .listChannelProviders()
        .then((response) => {
          if (!cancelled) setChannelProviders(response.providers)
        })
        .catch(() => {
          if (!cancelled) setChannelProviders([])
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled])

  return (
    <IntegrationsNavigationContext.Provider
      value={{
        activeProvider,
        channelProviders,
        contentId,
        navigationItems,
        navigationLabel: t("providerTabs"),
        setActiveProvider,
        setChannelProviders,
      }}
    >
      {children}
    </IntegrationsNavigationContext.Provider>
  )
}

export function useIntegrationsNavigation() {
  const context = useContext(IntegrationsNavigationContext)
  if (!context) throw new Error("IntegrationsNavigationProvider is required.")
  return context
}

export function IntegrationsSidebar() {
  const {
    activeProvider,
    contentId,
    navigationItems,
    navigationLabel,
    setActiveProvider,
  } = useIntegrationsNavigation()

  return (
    <IntegrationSidebar
      contentId={contentId}
      items={navigationItems}
      navigationLabel={navigationLabel}
      onValueChange={setActiveProvider}
      value={activeProvider}
    />
  )
}
