import { Geist_Mono, Inter } from "next/font/google"
import type { Metadata } from "next"
import { ThemeProvider as NextThemesProvider } from "next-themes"

import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SITE_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

const description =
  "A retro browser arcade: play Snake and Tic-Tac-Toe instantly — no accounts, no ads."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Arcade",
    template: "%s · Arcade",
  },
  applicationName: "Arcade",
  description,
  keywords: ["arcade", "browser games", "snake", "tic-tac-toe", "retro games"],
  openGraph: {
    type: "website",
    siteName: "Arcade",
    title: "Arcade",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arcade",
    description,
  },
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)] select-none [-webkit-tap-highlight-color:transparent]">
            <SiteHeader />
            {children}
          </div>
        </NextThemesProvider>
      </body>
    </html>
  )
}