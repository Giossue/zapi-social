import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { ThemeProvider } from "@/components/theme-provider"
import { SessionSynchronizer } from "@/features/identity/components/session-synchronizer"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Zapi Social",
  description: "Planifica, publica y mide tu contenido social.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={cn("dark antialiased font-sans", inter.variable, fontMono.variable)}>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <SessionSynchronizer />
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
