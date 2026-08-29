"use client"

import * as React from "react"

import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { CardGrid } from "@workspace/ui/components/card-grid"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CollectionHeader } from "@workspace/ui/components/collection-header"
import {
  DataTableFilter,
  DataTableHeader,
} from "@workspace/ui/components/data-table-controls"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { FloatingActionButton } from "@workspace/ui/components/floating-action-button"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { TablePagination } from "@/components/table-pagination"

import type { PortalChannelAccount } from "../types/channels"
import { useTranslations } from "next-intl"

import {
  ChannelAccountCard,
  type ChannelCardActions,
} from "./channel-account-card"

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
  cardActions: ChannelCardActions
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
  cardActions,
  total,
}: ChannelsUsersProps) {
  const t = useTranslations("channels")

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={t("pageDescription")}
        title={t("pageTitle")}
      />
      <Card variant="subtle">
        <DataTableHeader
          action={
            canManage ? (
              <Button
                className="hidden sm:inline-flex"
                size="sm"
                onClick={onConnect}
              >
                <Plus /> {t("connect")}
              </Button>
            ) : undefined
          }
          search={{
            ariaLabel: t("searchLabel"),
            onChange: onQueryChange,
            placeholder: t("searchPlaceholder"),
            value: query,
          }}
        />
        <CardContent className="px-0">
          <DataTableToolbar>
            <DataTableFilter
              ariaLabel={t("filterProvider")}
              label={t("provider")}
              onValueChange={onProviderFilterChange}
              options={[
                { label: t("all"), value: "all" },
                ...providerOptions.map(([value, label]) => ({ label, value })),
              ]}
              value={providerFilter}
            />
            <DataTableFilter
              ariaLabel={t("filterType")}
              label={t("type")}
              onValueChange={onCapabilityFilterChange}
              options={[
                { label: t("all"), value: "all" },
                ...capabilityOptions.map(([value, label]) => ({
                  label,
                  value,
                })),
              ]}
              value={capabilityFilter}
            />
            <DataTableFilter
              ariaLabel={t("filterStatus")}
              label={t("statusColumn")}
              onValueChange={onStatusFilterChange}
              options={[
                { label: t("all"), value: "all" },
                { label: t("filter.connected"), value: "connected" },
                { label: t("filter.disconnected"), value: "disconnected" },
              ]}
              value={statusFilter}
            />
          </DataTableToolbar>
        </CardContent>
      </Card>

      {isFiltering ? (
        <PageLoading aria-label={t("filtering")} className="min-h-48" />
      ) : accounts.length ? (
        <CardGrid layout="xl-4-fixed">
          {accounts.map((account) => (
            <ChannelAccountCard
              account={account}
              key={account.id}
              {...cardActions}
            />
          ))}
        </CardGrid>
      ) : (
        <Card variant="subtle">
          <CardContent>{emptyState}</CardContent>
        </Card>
      )}

      <TablePagination
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        itemLabel={t("itemLabel")}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
        total={total}
      />

      {canManage ? (
        <FloatingActionButton label={t("connect")} onClick={onConnect} />
      ) : null}
    </div>
  )
}
