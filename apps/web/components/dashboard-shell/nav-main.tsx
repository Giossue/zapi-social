"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

import { ChevronRight } from "lucide-react"

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
  items: readonly DashboardNavigationGroup[]
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
}

type NavItemProps = {
  item: DashboardNavigationItem
  isItemActive: (item: DashboardNavigationLink, pathname: string) => boolean
  pathname: string
}

type NavLinkItemProps = {
  item: DashboardNavigationLink
  isActive: boolean
  onNavigate: () => void
  showIconFallback: boolean
}

type NavDropdownItemProps = {
  item: DashboardNavigationDisclosure
  isActive: boolean
  isSubItemActive: (item: DashboardNavigationLink) => boolean
  onNavigate: () => void
}

type NavCollapsibleItemProps = {
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
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs font-medium text-[10px] outline">
      {title.slice(0, 1)}
    </span>
  )
}

export function DashboardNavMain({ items, isItemActive }: DashboardNavMainProps) {
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

function NavItem({ item, isItemActive, pathname }: NavItemProps) {
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isCollapsedDesktop = state === "collapsed" && !isMobile
  const onNavigate = () => setOpenMobile(false)
  const isSubItemActive = (subItem: DashboardNavigationLink) =>
    isItemActive(subItem, pathname)

  if (!hasSubItems(item)) {
    return (
      <NavLinkItem
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
      isActive={isActive}
      isSubItemActive={isSubItemActive}
      item={item}
      onNavigate={onNavigate}
    />
  )
}

function NavLinkItem({
  item,
  isActive,
  onNavigate,
  showIconFallback,
}: NavLinkItemProps) {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link
          aria-current={isActive ? "page" : undefined}
          href={item.href}
          onClick={onNavigate}
        >
          {Icon ? <Icon /> : null}
          {!Icon && showIconFallback ? (
            <CollapsedIconFallback title={item.label} />
          ) : null}
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavDropdownItem({
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
          <SidebarMenuButton isActive={isActive} tooltip={item.label}>
            {Icon ? <Icon /> : <CollapsedIconFallback title={item.label} />}
            <span>{item.label}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
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
  item,
  isActive,
  defaultOpen,
  isSubItemActive,
  onNavigate,
}: NavCollapsibleItemProps) {
  const Icon = item.icon

  return (
    <Collapsible asChild defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} tooltip={item.label}>
            {Icon ? <Icon /> : null}
            <span>{item.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
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
