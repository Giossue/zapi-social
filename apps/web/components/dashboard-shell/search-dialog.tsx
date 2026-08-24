"use client"

import * as React from "react"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { LockKeyhole, Search } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"

import type {
  DashboardNavigationGroup,
  DashboardNavigationLink,
} from "./navigation-types"

type SearchItem = DashboardNavigationLink & {
  id: string
  group: string
}

type DashboardSearchDialogProps = {
  items: readonly DashboardNavigationGroup[]
  lockedLabel: string
}

function getSearchItems(items: readonly DashboardNavigationGroup[]) {
  return items.flatMap((group) =>
    group.items.flatMap((item) => {
      if ("children" in item) {
        return item.children.map((child) => ({
          ...child,
          group: item.label,
          id: child.href,
        }))
      }

      return [{ ...item, group: group.label, id: item.href }]
    })
  )
}

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))]

  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }))
}

function SearchResultGroups({
  items,
  onSelect,
  lockedLabel,
}: {
  items: SearchItem[]
  lockedLabel: string
  onSelect: (item: SearchItem) => void
}) {
  return groupBy(items).map(({ group, items: groupItems }, index) => (
    <React.Fragment key={group}>
      {index > 0 ? <CommandSeparator /> : null}
      <CommandGroup heading={group}>
        {groupItems.map((item) => {
          const Icon = item.icon

          return (
            <CommandItem
              key={`${group}-${item.id}`}
              value={`${item.group} ${item.label}`}
              onSelect={() => onSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {Icon ? <Icon /> : null}
                <span className="truncate">{item.label}</span>
              </span>
              {item.planLocked ? (
                <>
                  <LockKeyhole aria-hidden="true" className="ml-auto" />
                  <span className="sr-only"> · {lockedLabel}</span>
                </>
              ) : null}
            </CommandItem>
          )
        })}
      </CommandGroup>
    </React.Fragment>
  ))
}

export function DashboardSearchDialog({
  items,
  lockedLabel,
}: DashboardSearchDialogProps) {
  const t = useTranslations("shell.search")
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const router = useRouter()
  const searchItems = getSearchItems(items)

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setQuery("")
  }

  function handleSelect(item: SearchItem) {
    handleOpenChange(false)
    router.push(item.href)
  }

  return (
    <>
      <Button
        className="px-0! font-normal text-muted-foreground hover:no-underline"
        variant="link"
        onClick={() => handleOpenChange(true)}
      >
        <Search data-icon="inline-start" />
        {t("trigger")}
        <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium select-none">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command>
          <CommandInput
            placeholder={t("placeholder")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            <SearchResultGroups
              items={query ? searchItems : searchItems}
              lockedLabel={lockedLabel}
              onSelect={handleSelect}
            />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
