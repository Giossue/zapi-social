import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

type SupportCardProps = {
  areaLabel: string
}

export function SupportCard({ areaLabel }: SupportCardProps) {
  return (
    <Card
      size="sm"
      className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden"
    >
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">Zapi Social</CardTitle>
        <CardDescription className="line-clamp-3">
          Gestiona tu actividad desde el área de {areaLabel.toLowerCase()}.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
