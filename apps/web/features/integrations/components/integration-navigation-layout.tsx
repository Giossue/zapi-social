"use client";

import { type ComponentType, type CSSProperties, type SVGProps } from "react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";

export type IntegrationNavigationItem = {
  value: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type IntegrationNavigationProps = {
  contentId?: string;
  items: readonly IntegrationNavigationItem[];
  navigationLabel: string;
  onValueChange: (value: string) => void;
  value: string;
};

export function IntegrationSidebar({
  contentId,
  items,
  navigationLabel,
  onValueChange,
  value,
}: IntegrationNavigationProps) {
  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh shrink-0 self-start border-r border-sidebar-border lg:flex"
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
                  const Icon = item.icon;
                  const isActive = item.value === value;

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
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function IntegrationProviderSelect({
  items,
  navigationLabel,
  onValueChange,
  value,
}: IntegrationNavigationProps) {
  return (
    <div className="lg:hidden">
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger aria-label={navigationLabel} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => {
              const Icon = item.icon;

              return (
                <SelectItem key={item.value} textValue={item.label} value={item.value}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
