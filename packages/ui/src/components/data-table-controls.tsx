"use client"

import { ChevronDown, ListFilter, Search } from "lucide-react"
import { useId, useState } from "react"
import type { ReactNode, Ref } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

type DataTableSearchProps = {
  ariaLabel: string
  endAddon?: ReactNode
  inputRef?: Ref<HTMLInputElement>
  onChange: (value: string) => void
  placeholder: string
  value: string
}

type DataTableHeaderProps = {
  action?: ReactNode
  description?: ReactNode
  search?: DataTableSearchProps
  title?: ReactNode
}

type DataTableToolbarProps = {
  /** Rótulo del plegado móvil; lo traduce quien consume el primitive. */
  filtersLabel: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

type DataTableFilterOption = {
  label: string
  value: string
}

type DataTableFilterProps = {
  ariaLabel: string
  label?: string
  onValueChange: (value: string) => void
  options: readonly DataTableFilterOption[]
  value: string
}

function DataTableHeader({
  action,
  description,
  search,
  title,
}: DataTableHeaderProps) {
  const hasContext = title !== undefined || description !== undefined

  return (
    <CardHeader
      className={cn(
        "border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        !hasContext && "md:has-data-[slot=card-action]:grid-cols-1"
      )}
    >
      {title !== undefined ? (
        <CardTitle className="text-xl leading-none">{title}</CardTitle>
      ) : null}
      {description !== undefined ? (
        <CardDescription className="max-w-sm leading-snug">
          {description}
        </CardDescription>
      ) : null}
      {search || action ? (
        <CardAction
          className={cn(
            "col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end",
            !hasContext &&
              "row-span-1 row-start-1 md:col-start-1 md:row-span-1 md:w-full md:justify-between md:justify-self-stretch"
          )}
        >
          {search ? <DataTableSearch {...search} /> : null}
          {action}
        </CardAction>
      ) : null}
    </CardHeader>
  )
}

function DataTableSearch({
  ariaLabel,
  endAddon,
  inputRef,
  onChange,
  placeholder,
  value,
}: DataTableSearchProps) {
  return (
    <InputGroup className="h-7 w-full md:w-64">
      <InputGroupAddon align="inline-start">
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={ariaLabel}
        className="h-7"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
      />
      {endAddon ? (
        <InputGroupAddon align="inline-end">{endAddon}</InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}

function DataTableToolbar({
  actions,
  children,
  className,
  filtersLabel,
}: DataTableToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersId = useId()

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4",
        className
      )}
    >
      <Button
        aria-controls={filtersId}
        aria-expanded={filtersOpen}
        className="w-fit md:hidden"
        onClick={() => setFiltersOpen((open) => !open)}
        size="sm"
        type="button"
        variant="outline"
      >
        <ListFilter data-icon="inline-start" /> {filtersLabel}
        <ChevronDown
          className={cn("transition-transform", filtersOpen && "rotate-180")}
          data-icon="inline-end"
        />
      </Button>
      <div
        className={cn(
          "w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto md:flex",
          filtersOpen ? "flex" : "hidden"
        )}
        id={filtersId}
      >
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

function DataTableFilter({
  ariaLabel,
  label,
  onValueChange,
  options,
  value,
}: DataTableFilterProps) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="w-max max-w-full"
        size="sm"
      >
        {label ? (
          <span className="shrink-0 text-muted-foreground">{label}:</span>
        ) : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" position="popper">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export { DataTableFilter, DataTableHeader, DataTableSearch, DataTableToolbar }
export type { DataTableFilterOption }
