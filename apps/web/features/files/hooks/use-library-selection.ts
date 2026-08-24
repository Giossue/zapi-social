"use client"

import * as React from "react"

export type LibrarySelectionItem = { id: string }

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

export function useLibrarySelection<T extends LibrarySelectionItem>({
  items,
  onOpen,
}: {
  items: readonly T[]
  onOpen: (item: T) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const anchorId = React.useRef<string | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<readonly string[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const selection = React.useMemo(
    () => selectedIds.filter((id) => items.some((item) => item.id === id)),
    [items, selectedIds]
  )

  const nodes = React.useCallback(
    () =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          "[data-library-item]"
        ) ?? []
      ),
    []
  )

  const rangeTo = React.useCallback(
    (fromId: string | null, toId: string) => {
      const from = items.findIndex((item) => item.id === fromId)
      const to = items.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0) return [toId]

      const [start, end] = from <= to ? [from, to] : [to, from]
      return items.slice(start, end + 1).map((item) => item.id)
    },
    [items]
  )

  const focusItem = React.useCallback(
    (id: string) => {
      const node = nodes().find((item) => item.dataset.libraryItem === id)
      node?.focus()
      node?.scrollIntoView({ block: "nearest" })
    },
    [nodes]
  )

  const neighbourId = React.useCallback(
    (key: string) => {
      const list = nodes()
      if (list.length === 0) return null

      const index = list.findIndex(
        (node) => node.dataset.libraryItem === activeId
      )
      const currentIndex = index < 0 ? 0 : index

      if (key === "ArrowLeft")
        return list[Math.max(0, currentIndex - 1)]?.dataset.libraryItem ?? null
      if (key === "ArrowRight")
        return (
          list[Math.min(list.length - 1, currentIndex + 1)]?.dataset
            .libraryItem ?? null
        )

      const current = list[currentIndex]
      if (!current) return null

      const rect = current.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      const down = key === "ArrowDown"
      let best: HTMLElement | null = null
      let bestScore = Number.POSITIVE_INFINITY

      for (const node of list) {
        if (node === current) continue

        const other = node.getBoundingClientRect()
        const inTargetRow = down
          ? other.top > rect.top + 1
          : other.top < rect.top - 1
        if (!inTargetRow) continue

        const score =
          Math.abs(other.top - rect.top) * 1000 +
          Math.abs(other.left + other.width / 2 - center)
        if (score < bestScore) {
          bestScore = score
          best = node
        }
      }

      return best?.dataset.libraryItem ?? null
    },
    [activeId, nodes]
  )

  function select(item: T, event: React.MouseEvent) {
    if (event.metaKey || event.ctrlKey) {
      setSelectedIds((current) =>
        current.includes(item.id)
          ? current.filter((id) => id !== item.id)
          : [...current, item.id]
      )
      anchorId.current = item.id
    } else if (event.shiftKey) {
      setSelectedIds(rangeTo(anchorId.current, item.id))
    } else {
      const isOnlySelected = selection.length === 1 && selection[0] === item.id
      setSelectedIds(isOnlySelected ? [] : [item.id])
      anchorId.current = isOnlySelected ? null : item.id
    }
    setActiveId(item.id)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault()
      setSelectedIds(items.map((item) => item.id))
      return
    }

    if (event.key === "Escape") {
      setSelectedIds([])
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      const item = items.find((entry) => entry.id === activeId)
      if (!item) return
      event.preventDefault()
      if (event.key === "Enter") onOpen(item)
      else setSelectedIds([item.id])
      return
    }

    if (!ARROW_KEYS.includes(event.key)) return
    const nextId = neighbourId(event.key)
    if (!nextId) return

    event.preventDefault()
    setActiveId(nextId)
    if (event.shiftKey) {
      setSelectedIds(rangeTo(anchorId.current ?? nextId, nextId))
    } else {
      setSelectedIds([nextId])
      anchorId.current = nextId
    }
    focusItem(nextId)
  }

  const containerProps = {
    onClick: (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) setSelectedIds([])
    },
    onKeyDown: handleKeyDown,
    ref: containerRef,
  }

  function getItemProps(item: T) {
    return {
      "aria-selected": selection.includes(item.id),
      "data-library-item": item.id,
      "data-selected": selection.includes(item.id),
      onClick: (event: React.MouseEvent) => select(item, event),
      onDoubleClick: () => onOpen(item),
      role: "option" as const,
      tabIndex: (activeId ?? items[0]?.id) === item.id ? 0 : -1,
    }
  }

  return {
    activeId,
    clearSelection: () => setSelectedIds([]),
    containerProps,
    getItemProps,
    selection,
  }
}
