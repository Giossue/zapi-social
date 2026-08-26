import { Plus } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import type { PublicSiteLanguage } from "@workspace/contracts"

import {
  MARKETING_FALLBACK_LANGUAGES,
  marketingLanguageFlag,
} from "@/features/marketing/languages"

import Container from "./container"

const LanguageSupport = async ({
  languages,
}: {
  languages: PublicSiteLanguage[]
}) => {
  const t = await getTranslations("marketing.languages")
  const locale = await getLocale()
  const displayNames = new Intl.DisplayNames([locale], { type: "language" })

  const items = languages.length
    ? languages.map((language) => ({
        code: language.code,
        name: language.nativeName || language.name,
        flag: marketingLanguageFlag(language.code),
      }))
    : MARKETING_FALLBACK_LANGUAGES.map((code) => ({
        code,
        name: displayNames.of(code) ?? code,
        flag: marketingLanguageFlag(code),
      }))

  return (
    <div
      id="languages"
      className="relative mx-auto flex max-w-5xl flex-col items-center justify-center py-20"
    >
      <Container>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center text-center">
          <h2 className="mb-6 font-heading text-2xl leading-snug! font-medium md:text-4xl lg:text-5xl">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h2>
        </div>
      </Container>

      <div className="relative mx-auto grid w-full max-w-4xl grid-cols-2 items-start justify-start gap-6 pt-10 sm:grid-cols-3 md:grid-cols-4">
        <div className="absolute top-1/2 right-1/4 -z-10 h-14 w-3/5 -translate-y-1/2 -rotate-12 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 blur-[10rem] lg:h-20" />

        {items.map((language, index) => (
          <Container
            key={language.code}
            delay={0.05 * index}
            className="flex h-auto items-center space-x-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <span className="text-2xl">{language.flag}</span>
            <span className="text-lg lg:text-xl">{language.name}</span>
          </Container>
        ))}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted">
            <Plus size={14} />
          </span>
          <span>{t("more")}</span>
        </div>
      </div>
    </div>
  )
}

export default LanguageSupport
