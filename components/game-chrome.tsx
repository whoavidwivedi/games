"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { RiArrowLeftLine } from "@remixicon/react"

import { HelpButton } from "@/components/game-help"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * The chrome every game screen shares: back button + title + badges + the
 * help/theme controls (header), the pause row and hint line (footer), and the
 * idle/paused/over layer over the board (status overlay), which owns every
 * play/replay button so a round never shows two of them.
 */

export function GameHeader({
  title,
  badges,
  steps,
  helpOpen,
  onToggleHelp,
}: {
  title: string
  badges: ReactNode
  steps: string[]
  helpOpen: boolean
  onToggleHelp: () => void
}) {
  const router = useRouter()
  /** Return to where the player came from (home or favourites); a fresh deep
      link has no history to go back to, so fall back to the game list. */
  const goBack = () => {
    if (window.history.state?.idx > 0) router.back()
    else router.replace("/")
  }

  return (
    <header className="flex h-7 shrink-0 items-center gap-2">
      {/* The name truncates before anything else can be squeezed, so a
          three-badge header on a narrow phone never crowds it out. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          onClick={goBack}
          className="shrink-0"
        >
          <RiArrowLeftLine />
        </Button>
        <span className="truncate text-sm font-semibold">{title}</span>
      </div>

      {/* Two groups, split by a hairline: readouts (score/best) are data,
          the i and theme buttons are controls — mixing them in one run made
          the scores look tappable and the icons look like stats. */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <div className="flex items-center gap-1">{badges}</div>
        <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-1.5">
          <HelpButton
            open={helpOpen}
            steps={steps}
            onClick={onToggleHelp}
          />
          <ThemeToggle size="icon-sm" />
        </div>
      </div>
    </header>
  )
}

/** True for the statuses that mean the round is finished (→ replay wording). */
const isFinished = (status: string, finished?: boolean) =>
  finished ?? (status === "over" || status === "won")

export function StatusOverlay({
  status,
  label,
  actionLabel,
  finished,
  onToggle,
  actions,
  children,
}: {
  status: string
  /** The overlay text; games build it from their own OVERLAY_TEXT map. */
  label: ReactNode
  /** Overrides the computed Resume/Play/Play again wording. */
  actionLabel?: ReactNode
  /** Which statuses count as a finished round. Default: "over" or "won". */
  finished?: boolean
  onToggle: () => void
  /** Extra buttons after the primary one (e.g. "Keep playing"). */
  actions?: ReactNode
  /** Extra line under the label (e.g. the final score). */
  children?: ReactNode
}) {
  if (status === "running") return null
  return (
    <div
      aria-live="polite"
      className="absolute inset-0 z-20 grid place-items-center rounded-none bg-background p-4"
    >
      {/* stopPropagation keeps board taps (e.g. flappy's pointerdown flap)
          from firing through the overlay */}
      <div
        className="flex w-full max-w-52 flex-col items-center gap-3"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="text-center text-sm font-medium">
          {label}
          {children}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onToggle}>
            {actionLabel ??
              (status === "paused"
                ? "Resume"
                : isFinished(status, finished)
                  ? "Play again"
                  : "Play")}
          </Button>
          {actions}
        </div>
      </div>
    </div>
  )
}

/**
 * The footer: the pause control while a round runs (play, resume, play again
 * and new round all live on the status overlay, so the bottom bar never
 * repeats them), plus the game's own extra controls and the hint line. The
 * row stays h-7 — the board reserves its height.
 */
export function GameFooter({
  status,
  hint,
  onToggle,
  actions,
  disabled,
  hidePrimaryWhenRunning,
}: {
  status: string
  /** The one-line control hint under the buttons. */
  hint: ReactNode
  onToggle: () => void
  /** Extra controls beside pause (e.g. Minesweeper's flag mode). */
  actions?: ReactNode
  /** Keeps pause dead while help is open (flappy). */
  disabled?: boolean
  /** 2048 has no pause, so it never offers one. */
  hidePrimaryWhenRunning?: boolean
}) {
  return (
    <footer className="flex shrink-0 flex-col gap-1.5">
      <div className="flex h-7 items-center justify-center gap-2">
        {status === "running" && !hidePrimaryWhenRunning && (
          <Button
            variant="default"
            size="sm"
            onClick={onToggle}
            disabled={disabled}
          >
            Pause
          </Button>
        )}
        {actions}
      </div>

      <p className="text-xs whitespace-nowrap text-muted-foreground">{hint}</p>
    </footer>
  )
}
