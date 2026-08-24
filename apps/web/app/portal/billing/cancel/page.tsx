import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CircleX } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

export default async function PortalBillingCancelPage() {
  const t = await getTranslations("portalPlans")

  return (
    <Card className="mx-auto w-full max-w-xl" variant="subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleX aria-hidden="true" />
          {t("cancelTitle")}
        </CardTitle>
        <CardDescription>{t("cancelDescription")}</CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter>
        <Button asChild variant="brand-secondary">
          <Link href="/portal/plans">{t("cancelBack")}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
