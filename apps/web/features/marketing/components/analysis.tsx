import { DownloadIcon, FilterIcon, TrendingUpIcon } from "lucide-react"
import { getFormatter, getTranslations } from "next-intl/server"

import { Button } from "@workspace/ui/components/button"

import Container from "./container"
import { MagicCard } from "./magic-card"

const CAMPAIGNS = [
  { key: "sales", status: "active", reach: 45000, roi: 0.32 },
  { key: "emails", status: "done", reach: 28000, roi: 0.18 },
  { key: "ads", status: "active", reach: 62000, roi: 0.45 },
] as const

const CHANNELS = [
  { key: "social", users: 32000, sessions: 45000, rate: 0.032 },
  { key: "email", users: 28000, sessions: 36000, rate: 0.045 },
  { key: "direct", users: 15000, sessions: 22000, rate: 0.051 },
] as const

const Analysis = async () => {
  const t = await getTranslations("marketing.analysis")
  const format = await getFormatter()

  const compact = (value: number) =>
    format.number(value, { notation: "compact", maximumFractionDigits: 0 })
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 1 })

  return (
    <div className="relative flex w-full flex-col items-center justify-center py-20">
      <Container>
        <div className="mx-auto mb-16 flex max-w-3xl flex-col items-center text-center">
          <h2 className="font-heading text-2xl leading-snug! font-medium md:text-4xl lg:text-5xl">
            {t.rich("title", {
              br: () => <br />,
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h2>
          <p className="mt-4 text-base text-accent-foreground/80 md:text-lg">
            {t("subtitle")}
          </p>
        </div>
      </Container>

      <div className="relative grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        <Container delay={0.2}>
          <div className="relative rounded-2xl border border-border/50 bg-background/40">
            <MagicCard
              gradientFrom="#38bdf8"
              gradientTo="#3b82f6"
              gradientColor="rgba(59,130,246,0.1)"
              className="w-full overflow-hidden p-4 lg:p-8"
            >
              <div className="absolute right-0 bottom-0 z-20 h-1/4 w-1/4 bg-blue-500 blur-[8rem]" />
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  {t("performanceTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("performanceDescription")}
                </p>

                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-3xl font-semibold">
                        {format.number(12834, {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-sm text-green-500">
                        <TrendingUpIcon className="size-4" />
                        {t("performanceTrend", { value: 0.25 })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="brand-secondary"
                        aria-label={t("filter")}
                      >
                        <FilterIcon className="size-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="brand-secondary"
                        aria-label={t("download")}
                      >
                        <DownloadIcon className="size-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-4 py-2 text-sm text-muted-foreground">
                      <div>{t("columns.campaign")}</div>
                      <div>{t("columns.status")}</div>
                      <div>{t("columns.reach")}</div>
                      <div>{t("columns.roi")}</div>
                    </div>
                    {CAMPAIGNS.map((campaign) => (
                      <div
                        key={campaign.key}
                        className="grid grid-cols-4 border-t border-border/50 py-2 text-sm"
                      >
                        <div>{t(`campaigns.${campaign.key}`)}</div>
                        <div>{t(`statuses.${campaign.status}`)}</div>
                        <div>{compact(campaign.reach)}</div>
                        <div className="font-semibold">
                          {percent(campaign.roi)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </MagicCard>
          </div>
        </Container>

        <Container delay={0.2}>
          <div className="relative rounded-2xl border border-border/50 bg-background/40">
            <MagicCard
              gradientFrom="#38bdf8"
              gradientTo="#3b82f6"
              gradientColor="rgba(59,130,246,0.1)"
              className="w-full overflow-hidden p-4 lg:p-8"
            >
              <div className="absolute right-0 bottom-0 z-20 h-1/4 w-1/4 bg-sky-500 blur-[8rem]" />
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">{t("audienceTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("audienceDescription")}
                </p>

                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-3xl font-semibold">
                        {format.number(84392)}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-sm text-green-500">
                        <TrendingUpIcon className="size-4" />
                        {t("audienceTrend", { value: 0.12 })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="brand-secondary"
                        aria-label={t("filter")}
                      >
                        <FilterIcon className="size-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="brand-secondary"
                        aria-label={t("download")}
                      >
                        <DownloadIcon className="size-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-4 py-2 text-sm text-muted-foreground">
                      <div>{t("columns.channel")}</div>
                      <div>{t("columns.users")}</div>
                      <div>{t("columns.sessions")}</div>
                      <div>{t("columns.conversion")}</div>
                    </div>
                    {CHANNELS.map((channel) => (
                      <div
                        key={channel.key}
                        className="grid grid-cols-4 border-t border-border/50 py-2 text-sm"
                      >
                        <div>{t(`channels.${channel.key}`)}</div>
                        <div>{compact(channel.users)}</div>
                        <div>{compact(channel.sessions)}</div>
                        <div className="font-semibold">
                          {percent(channel.rate)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </MagicCard>
          </div>
        </Container>
      </div>
    </div>
  )
}

export default Analysis
