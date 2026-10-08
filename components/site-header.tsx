"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { RiHeartLine, RiHome6Line } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * The header shown on the shell pages (home + favourites). It stays mounted
 * across client-side navigation: tapping the heart swaps "Games" to
 * "Favourites" and the home button swaps it back, remounting the title off
 * the route so the t-text-swap entrance replays on the way out *and* the way
 * back (a plain reload replays it too, which is what keeps it alive when the
 * browser restores a back-navigation as a full page load). Game routes
 * render their own in-game header, so this renders nothing there.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const onFavourites = pathname === "/favourites"

  const title = onFavourites ? "Favourites" : "Games"

  // Game routes render their own in-game header, so nothing is shown here.
  const hiddenOnRoute = pathname.startsWith("/games/")

  if (hiddenOnRoute) return null

  return (
    <header className="flex shrink-0 items-center justify-between gap-2">
      <h1 key={pathname} className="t-text-swap text-base font-semibold">
        {title}
      </h1>

      <div className="flex items-center gap-1">
        {onFavourites ? (
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/" />}
            nativeButton={false}
            aria-label="Back to games"
            title="Back to games"
          >
            <RiHome6Line />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/favourites" />}
            nativeButton={false}
            aria-label="Favourites"
            title="Favourites"
          >
            <RiHeartLine />
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}