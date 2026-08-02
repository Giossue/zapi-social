"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type {
  PublishingAccount,
  PublishingProvider,
} from "@/features/publishing/types/publishing-calendar"

const providerLabels: Record<PublishingProvider, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
}

const providerFilters: Array<{
  label: string
  value: PublishingProvider | "all"
}> = [
  { label: "Todas", value: "all" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "WhatsApp", value: "whatsapp" },
]

type PublishingAccountPickerProps = {
  accounts: PublishingAccount[]
  onChange: (accountIds: string[]) => void
  selectedAccountIds: string[]
}

export function PublishingAccountPicker({
  accounts,
  onChange,
  selectedAccountIds,
}: PublishingAccountPickerProps) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<PublishingProvider | "all">("all")
  const [query, setQuery] = useState("")
  const selectedAccounts = accounts.filter((account) =>
    selectedAccountIds.includes(account.id)
  )
  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return accounts.filter((account) => {
      const matchesProvider =
        provider === "all" || account.provider === provider
      const matchesQuery =
        !normalizedQuery ||
        [account.name, account.assignedName ?? "", account.detail]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(normalizedQuery)

      return matchesProvider && matchesQuery
    })
  }, [accounts, provider, query])

  function toggleAccount(accountId: string, checked: boolean) {
    onChange(
      checked
        ? [...selectedAccountIds, accountId]
        : selectedAccountIds.filter((id) => id !== accountId)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between" variant="brand-secondary">
            <span className="truncate">
              {selectedAccounts.length
                ? `${selectedAccounts.length} cuenta${selectedAccounts.length === 1 ? "" : "s"} seleccionada${selectedAccounts.length === 1 ? "" : "s"}`
                : "Seleccionar cuentas destino"}
            </span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(30rem,calc(100vw-2rem))]"
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Buscar cuentas destino"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cuenta o nombre asignado"
                value={query}
              />
            </div>
            <div
              aria-label="Filtrar cuentas por red"
              className="flex flex-wrap gap-2"
            >
              {providerFilters.map((filter) => (
                <Button
                  key={filter.value}
                  onClick={() => setProvider(filter.value)}
                  size="sm"
                  variant={
                    provider === filter.value ? "default" : "brand-secondary"
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredAccounts.length ? (
                <div className="flex flex-col gap-2">
                  {filteredAccounts.map((account) => {
                    const checked = selectedAccountIds.includes(account.id)
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
                        key={account.id}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleAccount(account.id, value === true)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {account.assignedName ?? account.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {account.name} · {account.detail}
                          </span>
                        </span>
                        {checked ? (
                          <Check
                            aria-hidden="true"
                            className="size-4 text-success"
                          />
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p className="px-1 py-3 text-sm text-muted-foreground">
                  No encontramos cuentas con esos filtros.
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selectedAccounts.length ? (
        <div
          aria-label="Cuentas seleccionadas"
          className="flex flex-wrap gap-2"
        >
          {selectedAccounts.map((account) => (
            <Badge key={account.id} variant="neutral">
              {account.assignedName ?? account.name} ·{" "}
              {providerLabels[account.provider]}
              <Button
                aria-label={`Quitar ${account.assignedName ?? account.name}`}
                onClick={() => toggleAccount(account.id, false)}
                size="icon-xs"
                variant="brand-secondary"
              >
                <X />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
