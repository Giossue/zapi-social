"use client"

import { ChevronDown, ListFilter, Search } from "lucide-react"
import { Children, isValidElement, useId, useState } from "react"
import type { ReactElement, ReactNode, Ref } from "react"

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
  className?: string
  description?: ReactNode
  filters?: ReactNode
  search?: DataTableSearchProps
  title?: ReactNode
}

type DataTableToolbarProps = {
  filtersLabel: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
  clearLabel?: string
  filtersClassName?: string
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
  triggerClassName?: string
  value: string
}

function DataTableHeader({
  action,
  className,
  description,
  filters,
  search,
  title,
}: DataTableHeaderProps) {
  const hasContext = title !== undefined || description !== undefined

  return (
    <CardHeader
      className={cn(
        "border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        !hasContext && "md:has-data-[slot=card-action]:grid-cols-1",
        className
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
      {search || filters || action ? (
        <CardAction
          className={cn(
            "col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end",
            !hasContext &&
              "row-span-1 row-start-1 md:col-start-1 md:row-span-1 md:w-full md:justify-between md:justify-self-stretch"
          )}
        >
          {search || filters ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {search ? <DataTableSearch {...search} /> : null}
              {filters}
            </div>
          ) : null}
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
  clearLabel,
  filtersClassName,
  filtersLabel,
}: DataTableToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersId = useId()
  const filters = Children.toArray(children).filter(
    (child): child is ReactElement<DataTableFilterProps> =>
      isValidElement<DataTableFilterProps>(child) &&
      Array.isArray(child.props.options)
  )
  const hasActiveFilters = filters.some(
    (filter) => filter.props.value !== filter.props.options[0]?.value
  )

  function clearFilters() {
    filters.forEach((filter) => {
      const defaultValue = filter.props.options[0]?.value
      if (defaultValue !== undefined && filter.props.value !== defaultValue) {
        filter.props.onValueChange(defaultValue)
      }
    })
  }

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
          filtersOpen ? "flex" : "hidden",
          filtersClassName
        )}
        id={filtersId}
      >
        {children}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : hasActiveFilters && clearLabel ? (
          <Button
            onClick={clearFilters}
            size="sm"
            type="button"
            variant="brand-secondary"
          >
            <ListFilter aria-hidden="true" data-icon="inline-start" />
            {clearLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function DataTableFilter({
  ariaLabel,
  label,
  onValueChange,
  options,
  triggerClassName,
  value,
}: DataTableFilterProps) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("w-max max-w-full", triggerClassName)}
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
