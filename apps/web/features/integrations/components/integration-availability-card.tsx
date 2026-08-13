import { Switch } from "@workspace/ui/components/switch"
import { IntegrationInsetCard } from "./integration-inset-card"

type IntegrationAvailabilityCardProps = {
  ariaLabel: string
  checked: boolean
  description: string
  onCheckedChange: (checked: boolean) => void
  title: string
}

export function IntegrationAvailabilityCard({
  ariaLabel,
  checked,
  description,
  onCheckedChange,
  title,
}: IntegrationAvailabilityCardProps) {
  return (
    <IntegrationInsetCard className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={ariaLabel}
        checked={checked}
        className="shrink-0"
        onCheckedChange={onCheckedChange}
      />
    </IntegrationInsetCard>
  )
}
