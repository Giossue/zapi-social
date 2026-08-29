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
import type { PortalChannelAccount } from "../types/channels"
import { useTranslations } from "next-intl"

import {
  ChannelAccountCard,
  type ChannelCardActions,
} from "./channel-account-card"

type ChannelFilterOption = readonly [string, string]

type ChannelsUsersProps = {
  accounts: PortalChannelAccount[]
  canManage: boolean
  capabilityFilter: string
  capabilityOptions: readonly ChannelFilterOption[]
  emptyState: React.ReactNode
  isFiltering: boolean
  onCapabilityFilterChange: (value: string) => void
  onConnect: () => void
  onProviderFilterChange: (value: string) => void
  onQueryChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  providerFilter: string
  providerOptions: readonly ChannelFilterOption[]
  query: string
  statusFilter: string
  cardActions: ChannelCardActions
}

export function ChannelsUsers({
  accounts,
  canManage,
  capabilityFilter,
  capabilityOptions,
  emptyState,
  isFiltering,
  onCapabilityFilterChange,
  onConnect,
  onProviderFilterChange,
  onQueryChange,
  onStatusFilterChange,
  providerFilter,
  providerOptions,
  query,
  statusFilter,
  cardActions,
}: ChannelsUsersProps) {
  const t = useTranslations("channels")

  return (
    <div className="flex flex-col gap-4">
      <CollectionHeader
        description={t("pageDescription")}
        title={t("pageTitle")}
      />
      <div className="flex flex-col gap-4 py-4">
        <DataTableHeader
          className="border-b-0"
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
        <DataTableToolbar
          className="px-0"
          filtersClassName="rounded-lg bg-muted/50 py-2"
        >
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
      </div>

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

      {canManage ? (
        <FloatingActionButton label={t("connect")} onClick={onConnect} />
      ) : null}
    </div>
  )
}
