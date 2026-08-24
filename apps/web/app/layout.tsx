import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { ShieldAlert } from "lucide-react"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { cn } from "@workspace/ui/lib/utils"

import { ThemeProvider } from "@/components/theme-provider"
import { SessionSynchronizer } from "@/features/identity/components/session-synchronizer"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  return { title: "Zapi Social", description: t("description") }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const demoMode = process.env.DEMO_MODE === "true"
  const tDemo = demoMode ? await getTranslations("demoMode") : null

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "dark font-sans antialiased",
        inter.variable,
        fontMono.variable
      )}
    >
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <TooltipProvider>
              <SessionSynchronizer />
              {children}
              {tDemo ? (
                <Alert className="fixed right-4 bottom-4 max-w-md">
                  <ShieldAlert />
                  <AlertTitle>{tDemo("title")}</AlertTitle>
                  <AlertDescription>{tDemo("description")}</AlertDescription>
                </Alert>
              ) : null}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
