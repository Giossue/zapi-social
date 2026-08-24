"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

import { ChevronRight, LockKeyhole } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import type {
  DashboardNavigationDisclosure,
  DashboardNavigationGroup,
  DashboardNavigationItem,
  DashboardNavigationLink,
} from "./navigation-types"

type DashboardNavMainProps = {
  activeIndicators: ReadonlySet<string>
  indicatorLabel: string
  lockedLabel: string
  items: readonly DashboardNavigationGroup[]
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
}

type NavItemProps = {
  activeIndicators: ReadonlySet<string>
  indicatorLabel: string
  lockedLabel: string
  item: DashboardNavigationItem
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  pathname: string
}

type NavLinkItemProps = {
  hasIndicator: boolean
  indicatorLabel: string
  lockedLabel: string
  item: DashboardNavigationLink
  isActive: boolean
  onNavigate: () => void
  showIconFallback: boolean
}

type NavDropdownItemProps = {
  hasIndicator: boolean
  indicatorLabel: string
  lockedLabel: string
  item: DashboardNavigationDisclosure
  isActive: boolean
  isSubItemActive: (item: DashboardNavigationLink) => boolean
  onNavigate: () => void
}

type NavCollapsibleItemProps = {
  hasIndicator: boolean
  indicatorLabel: string
  lockedLabel: string
  item: DashboardNavigationDisclosure
  isActive: boolean
  defaultOpen: boolean
  isSubItemActive: (item: DashboardNavigationLink) => boolean
  onNavigate: () => void
}

function hasSubItems(
  item: DashboardNavigationItem
): item is DashboardNavigationDisclosure {
  return "children" in item
}

function CollapsedIconFallback({ title }: { title: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs text-[10px] font-medium outline">
      {title.slice(0, 1)}
    </span>
  )
}

export function DashboardNavMain({
  activeIndicators,
  indicatorLabel,
  lockedLabel,
  items,
  isItemActive,
}: DashboardNavMainProps) {
  const pathname = usePathname()

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.label}>
          {group.label ? (
            <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
              {group.label}
            </SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavItem
                  key={item.label}
                  activeIndicators={activeIndicators}
                  indicatorLabel={indicatorLabel}
                  lockedLabel={lockedLabel}
                  isItemActive={isItemActive}
                  item={item}
                  pathname={pathname}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

function NavItem({
  activeIndicators,
  indicatorLabel,
  lockedLabel,
  item,
  isItemActive,
  pathname,
}: NavItemProps) {
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isCollapsedDesktop = state === "collapsed" && !isMobile
  const onNavigate = () => setOpenMobile(false)
  const isSubItemActive = (subItem: DashboardNavigationLink) =>
    isItemActive(subItem, pathname)
  const hasIndicator = item.indicatorKey
    ? activeIndicators.has(item.indicatorKey)
    : false

  if (!hasSubItems(item)) {
    return (
      <NavLinkItem
        hasIndicator={hasIndicator}
        indicatorLabel={indicatorLabel}
        lockedLabel={lockedLabel}
        isActive={isItemActive(item, pathname)}
        item={item}
        onNavigate={onNavigate}
        showIconFallback={isCollapsedDesktop}
      />
    )
  }

  const isActive = item.children.some(isSubItemActive)

  if (isCollapsedDesktop) {
    return (
      <NavDropdownItem
        hasIndicator={hasIndicator}
        indicatorLabel={indicatorLabel}
        lockedLabel={lockedLabel}
        isActive={isActive}
        isSubItemActive={isSubItemActive}
        item={item}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <NavCollapsibleItem
      defaultOpen={isActive}
      hasIndicator={hasIndicator}
      indicatorLabel={indicatorLabel}
      lockedLabel={lockedLabel}
      isActive={isActive}
      isSubItemActive={isSubItemActive}
      item={item}
      onNavigate={onNavigate}
    />
  )
}

function NavLinkItem({
  hasIndicator,
  indicatorLabel,
  lockedLabel,
  item,
  isActive,
  onNavigate,
  showIconFallback,
}: NavLinkItemProps) {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={
          item.planLocked ? `${item.label} · ${lockedLabel}` : item.label
        }
      >
        <Link
          aria-label={
            item.planLocked ? `${item.label} · ${lockedLabel}` : undefined
          }
          aria-current={isActive ? "page" : undefined}
          href={item.href}
          onClick={onNavigate}
        >
          {Icon ? <Icon /> : null}
          {!Icon && showIconFallback ? (
            <CollapsedIconFallback title={item.label} />
          ) : null}
          <span>{item.label}</span>
          {item.planLocked ? (
            <LockKeyhole aria-hidden="true" className="ml-auto" />
          ) : null}
        </Link>
      </SidebarMenuButton>
      <NavItemIndicator label={indicatorLabel} visible={hasIndicator} />
    </SidebarMenuItem>
  )
}

function NavDropdownItem({
  hasIndicator,
  indicatorLabel,
  lockedLabel,
  item,
  isActive,
  isSubItemActive,
  onNavigate,
}: NavDropdownItemProps) {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            tooltip={
              item.planLocked ? `${item.label} · ${lockedLabel}` : item.label
            }
          >
            {Icon ? <Icon /> : <CollapsedIconFallback title={item.label} />}
            <span>{item.label}</span>
            {item.planLocked ? <LockKeyhole aria-hidden="true" /> : null}
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <NavItemIndicator label={indicatorLabel} visible={hasIndicator} />
        <DropdownMenuContent
          align="start"
          className="w-48"
          side="right"
          sideOffset={12}
        >
          <DropdownMenuGroup>
            {item.children.map((subItem) => {
              const SubIcon = subItem.icon
              const subItemActive = isSubItemActive(subItem)

              return (
                <DropdownMenuItem key={subItem.href} asChild>
                  <Link
                    aria-current={subItemActive ? "page" : undefined}
                    className="flex items-center gap-2"
                    href={subItem.href}
                    onClick={onNavigate}
                  >
                    {SubIcon ? <SubIcon /> : null}
                    <span>{subItem.label}</span>
                    {subItem.planLocked ? (
                      <>
                        <LockKeyhole aria-hidden="true" className="ml-auto" />
                        <span className="sr-only"> · {lockedLabel}</span>
                      </>
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function NavCollapsibleItem({
  hasIndicator,
  indicatorLabel,
  lockedLabel,
  item,
  isActive,
  defaultOpen,
  isSubItemActive,
  onNavigate,
}: NavCollapsibleItemProps) {
  const Icon = item.icon

  return (
    <Collapsible
      asChild
      defaultOpen={defaultOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            tooltip={
              item.planLocked ? `${item.label} · ${lockedLabel}` : item.label
            }
          >
            {Icon ? <Icon /> : null}
            <span>{item.label}</span>
            {item.planLocked ? <LockKeyhole aria-hidden="true" /> : null}
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <NavItemIndicator label={indicatorLabel} visible={hasIndicator} />
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((subItem) => {
              const SubIcon = subItem.icon
              const subItemActive = isSubItemActive(subItem)

              return (
                <SidebarMenuSubItem key={subItem.href}>
                  <SidebarMenuSubButton asChild isActive={subItemActive}>
                    <Link
                      aria-current={subItemActive ? "page" : undefined}
                      href={subItem.href}
                      onClick={onNavigate}
                    >
                      {SubIcon ? <SubIcon /> : null}
                      <span>{subItem.label}</span>
                      {subItem.planLocked ? (
                        <>
                          <LockKeyhole aria-hidden="true" className="ml-auto" />
                          <span className="sr-only"> · {lockedLabel}</span>
                        </>
                      ) : null}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function NavItemIndicator({
  label,
  visible,
}: {
  label: string
  visible: boolean
}) {
  if (!visible) return null

  return (
    <SidebarMenuBadge className="right-2 size-2 min-w-0 rounded-full bg-destructive p-0">
      <span className="sr-only">{label}</span>
    </SidebarMenuBadge>
  )
}
