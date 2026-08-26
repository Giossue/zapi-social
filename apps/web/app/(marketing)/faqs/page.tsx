import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

import Container from "@/features/marketing/components/container"
import MarketingPageHeader from "@/features/marketing/components/page-header"
import MarketingPagination from "@/features/marketing/components/pagination"
import MarketingSearchForm from "@/features/marketing/components/search-form"
import Wrapper from "@/features/marketing/components/wrapper"
import { getSiteFaqs, getSiteOverview } from "@/features/marketing/site"

interface FaqsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.faqsPage")
  return { title: t("title"), description: t("subtitle") }
}

export default async function FaqsPage({ searchParams }: FaqsPageProps) {
  const site = await getSiteOverview()
  if (site && !site.sections.showFaqs) notFound()

  const params = await searchParams
  const query = params.q?.trim() || undefined
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const t = await getTranslations("marketing.faqsPage")
  const data = await getSiteFaqs({ q: query, page, limit: 12 })
  const faqs = data?.faqs ?? []
  const total = data?.total ?? 0
  const limit = data?.limit ?? 12
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <Wrapper className="relative py-20 lg:py-32">
      <MarketingPageHeader title={t("title")} description={t("subtitle")} />

      <Container className="mt-10">
        <MarketingSearchForm
          action="/faqs"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          submitLabel={t("searchAction")}
          defaultValue={query}
        />
      </Container>

      <Container className="mt-10">
        {faqs.length ? (
          <div className="mx-auto w-full max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-accent-foreground/80">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
          <p className="text-center text-accent-foreground/70">
            {query ? t("noResults", { query }) : t("empty")}
          </p>
        )}
      </Container>

      <MarketingPagination
        basePath="/faqs"
        query={query}
        page={page}
        limit={limit}
        total={total}
        rangeLabel={t("range", { from, to, total })}
        previousLabel={t("previous")}
        nextLabel={t("next")}
      />
    </Wrapper>
  )
}
