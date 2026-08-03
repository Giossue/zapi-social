"use client"
"use no memo"

import * as React from "react"

import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Plus, Search } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"

import type { PortalChannelAccount } from "../../types/channels"
import { createChannelsColumns, type ChannelTableActions } from "./channels-columns"
import { ChannelsTable } from "./channels-table"

type ChannelFilterOption = readonly [string, string]

type ChannelsUsersProps = {
  accounts: PortalChannelAccount[]
  canGoNext: boolean
  canGoPrevious: boolean
  canManage: boolean
  capabilityFilter: string
  capabilityOptions: readonly ChannelFilterOption[]
  emptyState: React.ReactNode
  isFiltering: boolean
  onCapabilityFilterChange: (value: string) => void
  onConnect: () => void
  onNextPage: () => void
  onPreviousPage: () => void
  onProviderFilterChange: (value: string) => void
  onQueryChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  providerFilter: string
  providerOptions: readonly ChannelFilterOption[]
  query: string
  rangeEnd: number
  rangeStart: number
  statusFilter: string
  tableActions: ChannelTableActions
  total: number
}

export function ChannelsUsers({
  accounts,
  canGoNext,
  canGoPrevious,
  canManage,
  capabilityFilter,
  capabilityOptions,
  emptyState,
  isFiltering,
  onCapabilityFilterChange,
  onConnect,
  onNextPage,
  onPreviousPage,
  onProviderFilterChange,
  onQueryChange,
  onStatusFilterChange,
  providerFilter,
  providerOptions,
  query,
  rangeEnd,
  rangeStart,
  statusFilter,
  tableActions,
  total,
}: ChannelsUsersProps) {
  const table = useReactTable({
    data: accounts,
    columns: createChannelsColumns(tableActions),
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="text-xl leading-none">Cuentas de canal</CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Gestiona las cuentas conectadas y su acceso para publicar.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Buscar canales"
              className="h-7"
              placeholder="Buscar canales..."
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </InputGroup>
          {canManage ? (
            <Button size="sm" onClick={onConnect}>
              <Plus /> Conectar canal
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={providerFilter} onValueChange={onProviderFilterChange}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Proveedor:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  <SelectItem value="all">Todos</SelectItem>
                  {providerOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={capabilityFilter} onValueChange={onCapabilityFilterChange}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Tipo:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  <SelectItem value="all">Todos</SelectItem>
                  {capabilityOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Estado:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="connected">Conectados</SelectItem>
                  <SelectItem value="disconnected">Desconectados</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ChannelsTable
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          emptyState={emptyState}
          isFiltering={isFiltering}
          onNextPage={onNextPage}
          onPreviousPage={onPreviousPage}
          rangeEnd={rangeEnd}
          rangeStart={rangeStart}
          table={table}
          total={total}
        />
      </CardContent>
    </Card>
  )
}
