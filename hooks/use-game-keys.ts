"use client"

import { useEffect, useRef } from "react"

/**
 * The keyboard scaffolding every game repeats: ignore auto-repeat, one
 * keydown stream, the help overlay keeps the floor (Esc / I closes it), then
 * R = restart, P = toggle, Space/Enter = toggle when the press did not
 * originate on a control (those fire themselves on keyup).
 *
 * Game-specific keys go in `onKey`, which runs first; return true from it to
 * say the key was consumed so the defaults below do not also fire.
 */
export function useGameKeys({
  helpOpen,
  closeHelp,
  toggle,
  restart,
  onKey,
}: {
  helpOpen: boolean
  closeHelp: () => void
  toggle: () => void
  restart: () => void
  onKey?: (key: string, event: KeyboardEvent) => boolean | void
}) {
  // Handlers are inline closures; keep them in a ref so the listener is
  // attached once instead of on every render.
  const options = useRef({ helpOpen, closeHelp, toggle, restart, onKey })
  useEffect(() => {
    options.current = { helpOpen, closeHelp, toggle, restart, onKey }
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const key = event.key.toLowerCase()
      const opts = options.current

      if (opts.helpOpen) {
        // Instructions have the floor; only closing gets through.
        if (key === "escape" || key === "i") {
          event.preventDefault()
          opts.closeHelp()
        }
        return
      }

      if (opts.onKey?.(key, event)) return

      if (key === "r") {
        opts.restart()
        return
      }

      if (key === "p") {
        opts.toggle()
        return
      }

      // Space/Enter fire a focused control themselves (Space on keyup), so
      // handling them here too would toggle twice.
      const target = event.target
      const onControl =
        target instanceof HTMLElement &&
        target.closest("button, a, [role='button']") !== null

      if (!onControl && (key === " " || key === "enter")) {
        event.preventDefault()
        opts.toggle()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
