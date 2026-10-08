"use client"

import { type ComponentProps, useSyncExternalStore } from "react"
import { RiMoonLine, RiSunLine } from "@remixicon/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// The theme is only known on the client; this hydrates cleanly (server
// snapshot false, client true) instead of flipping state in an effect.
const subscribeToNothing = () => () => {}
const getIsMounted = () => true
const getIsMountedOnServer = () => false

/**
 * Light/dark toggle as a plain shadcn icon button: a single click flips the
 * theme. The icon swaps to match the current mode until it is pressed again.
 */
export function ThemeToggle({
  size = "icon",
}: {
  /** Button size, so compact game headers can pass e.g. "icon-sm". */
  size?: ComponentProps<typeof Button>["size"]
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const isMounted = useSyncExternalStore(
    subscribeToNothing,
    getIsMounted,
    getIsMountedOnServer
  )

  const isDark = isMounted && resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size={size}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <RiMoonLine /> : <RiSunLine />}
    </Button>
  )
}
