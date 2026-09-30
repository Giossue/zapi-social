"use client"

import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
  useId,
} from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

export type IntegrationNavigationItem = {
  value: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

type IntegrationNavigationLayoutProps = {
  children: ReactNode
  header: ReactNode
  items: readonly IntegrationNavigationItem[]
  navigationLabel: string
  onValueChange: (value: string) => void
  value: string
}

export function IntegrationNavigationLayout({
  children,
  header,
  items,
  navigationLabel,
  onValueChange,
  value,
}: IntegrationNavigationLayoutProps) {
  const contentId = useId()

  return (
    <div
      className="flex min-h-[calc(100svh-3rem)] min-w-0"
      data-content-padding="false"
    >
      <Sidebar
        collapsible="none"
        className="hidden shrink-0 self-stretch border-r border-sidebar-border lg:flex"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 56)",
          } as CSSProperties
        }
      >
        <SidebarContent>
          <SidebarGroup className="pt-4">
            <SidebarGroupLabel>{navigationLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={navigationLabel}>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.value === value

                    return (
                      <SidebarMenuItem key={item.value}>
                        <SidebarMenuButton
                          aria-controls={contentId}
                          aria-current={isActive ? "true" : undefined}
                          isActive={isActive}
                          onClick={() => onValueChange(item.value)}
                          type="button"
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
        {header}
        <div className="lg:hidden">
          <Select onValueChange={onValueChange} value={value}>
            <SelectTrigger aria-label={navigationLabel} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {items.map((item) => {
                  const Icon = item.icon

                  return (
                    <SelectItem
                      key={item.value}
                      textValue={item.label}
                      value={item.value}
                    >
                      <Icon aria-hidden="true" />
                      {item.label}
                    </SelectItem>
                  )
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0" id={contentId}>
          {children}
        </div>
      </div>
    </div>
  )
}
