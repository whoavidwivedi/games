import { Geist_Mono, Inter } from "next/font/google"
import type { Metadata } from "next"
import { ThemeProvider as NextThemesProvider } from "next-themes"

import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "Games",
    template: "%s · Games",
  },
  description: "Play classic games right in your browser.",
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