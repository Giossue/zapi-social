export const MARKETING_LANGUAGE_FLAGS: Record<string, string> = {
  be: "🇧🇾",
  de: "🇩🇪",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  hi: "🇮🇳",
  it: "🇮🇹",
  ja: "🇯🇵",
  ka: "🇬🇪",
  kk: "🇰🇿",
  ko: "🇰🇷",
  pl: "🇵🇱",
  ro: "🇷🇴",
  ru: "🇷🇺",
  th: "🇹🇭",
  tr: "🇹🇷",
  uk: "🇺🇦",
  vi: "🇻🇳",
  zh: "🇨🇳",
}

export const MARKETING_FALLBACK_LANGUAGES = Object.keys(
  MARKETING_LANGUAGE_FLAGS
)

export function marketingLanguageFlag(code: string): string {
  return (
    MARKETING_LANGUAGE_FLAGS[code.toLowerCase().split("-")[0] ?? ""] ?? "🌐"
  )
}
