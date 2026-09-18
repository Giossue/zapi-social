"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleHelp, Search } from "lucide-react"

import { publicSiteApi } from "@workspace/api-client"
import type { PublicSiteFaq } from "@workspace/contracts"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Card, CardContent } from "@workspace/ui/components/card"
import { DataTableHeader } from "@workspace/ui/components/data-table-controls"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableResetFiltersButton } from "@/components/table-reset-filters-button"
import { PageLoading } from "@/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { useTranslations } from "next-intl"

export function SupportFaqPanel() {
  const t = useTranslations("support")
  const [faqs, setFaqs] = useState<PublicSiteFaq[]>([])
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const response = await publicSiteApi.faqs({
        limit: 48,
        ...(query.trim() ? { q: query.trim() } : {}),
      })
      setFaqs(response.faqs)
    } catch (error) {
      console.error("Support FAQs request failed", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const hasQuery = Boolean(query.trim())

  let content
  if (isLoading && !faqs.length) {
    content = <PageLoading aria-label={t("faq.loading")} className="py-12" />
  } else if (loadError) {
    content = (
      <EmptyState
        action={
          <RetryButton onClick={() => void load()} variant="brand-secondary" />
        }
        description={t("faq.loadFailedDescription")}
        icon={CircleHelp}
        title={t("faq.loadFailedTitle")}
      />
    )
  } else if (faqs.length) {
    content = (
      <Accordion collapsible type="single">
        {faqs.map((faq) => (
          <AccordionItem key={faq.id} value={faq.id}>
            <AccordionTrigger className="text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  } else if (hasQuery) {
    content = (
      <EmptyState
        action={<TableResetFiltersButton onClick={() => setQuery("")} />}
        description={t("faq.noMatchesDescription")}
        icon={Search}
        title={t("noMatches")}
      />
    )
  } else {
    content = (
      <EmptyState
        description={t("faq.emptyDescription")}
        icon={CircleHelp}
        title={t("faq.emptyTitle")}
      />
    )
  }

  return (
    <Card variant="subtle">
      <DataTableHeader
        loading={isLoading && faqs.length > 0}
        search={{
          ariaLabel: t("faq.searchLabel"),
          onChange: setQuery,
          placeholder: t("faq.searchPlaceholder"),
          value: query,
        }}
      />
      <CardContent>{content}</CardContent>
    </Card>
  )
}
