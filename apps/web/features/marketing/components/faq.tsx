import { getTranslations } from "next-intl/server"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import type { PublicSiteFaq } from "@workspace/contracts"

import Container from "./container"

const FAQ = async ({ faqs }: { faqs: PublicSiteFaq[] }) => {
  if (!faqs.length) return null

  const t = await getTranslations("marketing.faq")

  return (
    <div
      id="faq"
      className="flex w-full flex-col items-center justify-center py-12 md:py-16 lg:py-24"
    >
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="mt-6 font-heading text-2xl leading-snug! font-medium md:text-4xl lg:text-5xl">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h2>
          <p className="mt-4 text-center text-base text-accent-foreground/80 md:text-lg">
            {t("subtitle")}
          </p>
        </div>
      </Container>
      <Container className="mt-8 md:mt-12">
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
      </Container>
    </div>
  )
}

export default FAQ
