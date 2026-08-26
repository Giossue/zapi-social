import { BrandName } from "@/components/brand-mark"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"

type SupportCardProps = {
  areaLabel: string
}

export function SupportCard({ areaLabel }: SupportCardProps) {
  const t = useTranslations("shell")

  return (
    <Card
      size="sm"
      className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden"
    >
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">
          <BrandName />
        </CardTitle>
        <CardDescription className="line-clamp-3">
          {t("supportCardDescription", { area: areaLabel.toLowerCase() })}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
