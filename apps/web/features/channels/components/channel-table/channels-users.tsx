"use client"
"use no memo"

import * as React from "react"

import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DataTableFilter,
  DataTableHeader,
  DataTableToolbar,
} from "@workspace/ui/components/data-table-controls"

import type { PortalChannelAccount } from "../../types/channels"
import {
  createChannelsColumns,
  type ChannelTableActions,
} from "./channels-columns"
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
    <Card variant="subtle">
      <DataTableHeader
        action={
          canManage ? (
            <Button size="sm" onClick={onConnect}>
              <Plus /> Conectar canal
            </Button>
          ) : undefined
        }
        description="Gestiona las cuentas conectadas y su acceso para publicar."
        search={{
          ariaLabel: "Buscar canales",
          onChange: onQueryChange,
          placeholder: "Buscar canales...",
          value: query,
        }}
        title="Cuentas de canal"
      />
      <CardContent className="flex flex-col gap-4 px-0">
        <DataTableToolbar>
          <DataTableFilter
            ariaLabel="Filtrar por proveedor"
            label="Proveedor"
            onValueChange={onProviderFilterChange}
            options={[
              { label: "Todos", value: "all" },
              ...providerOptions.map(([value, label]) => ({ label, value })),
            ]}
            value={providerFilter}
          />
          <DataTableFilter
            ariaLabel="Filtrar por tipo"
            label="Tipo"
            onValueChange={onCapabilityFilterChange}
            options={[
              { label: "Todos", value: "all" },
              ...capabilityOptions.map(([value, label]) => ({ label, value })),
            ]}
            value={capabilityFilter}
          />
          <DataTableFilter
            ariaLabel="Filtrar por estado"
            label="Estado"
            onValueChange={onStatusFilterChange}
            options={[
              { label: "Todos", value: "all" },
              { label: "Conectados", value: "connected" },
              { label: "Desconectados", value: "disconnected" },
            ]}
            value={statusFilter}
          />
        </DataTableToolbar>

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
