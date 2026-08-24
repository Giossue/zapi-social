import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CircleCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

export default async function PortalBillingSuccessPage() {
  const t = await getTranslations("portalPlans")

  return (
    <Card className="mx-auto w-full max-w-xl" variant="subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleCheck aria-hidden="true" />
          {t("successTitle")}
        </CardTitle>
        <CardDescription>{t("successDescription")}</CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter>
        <Button asChild>
          <Link href="/portal/plans">{t("successBack")}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
