"use client"

import { useReducer, useState } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { Button } from "@/components/ui/button"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useSwipe } from "@/hooks/use-swipe"
import { accentVars } from "@/lib/games"
import {
  MINES,
  SIZE,
  initialState,
  reducer,
  type Status,
} from "@/lib/game-minesweeper"
import { cn } from "@/lib/utils"

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Boom!",
  won: "Board cleared!",
}

const HELP_STEPS = [
  "Tap a cell to reveal what's under it.",
  "The number says how many mines touch that cell.",
  "Right-click (or flag mode) marks suspected mines.",
  "Clear every safe cell to win; P pauses; R restarts.",
]

const KEY_DIRS: Record<string, "up" | "down" | "left" | "right"> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
}

/** A flag marker, drawn as a small accent pennant. */
function Flag() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-1/2 w-1/2">
      <path d="M2 1v10" stroke="var(--foreground)" strokeWidth={1.6} />
      <path d="M2.2 1.4h6.4L7 3.6l1.6 2.2H2.2z" fill="var(--accent)" />
    </svg>
  )
}

/** A mine, drawn as a spiky disc. */
function Mine() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-1/2 w-1/2">
      <circle cx={6} cy={6} r={3.4} fill="var(--accent)" />
      {[0, 45, 90, 135].map((angle) => (
        <rect
          key={angle}
          x={5.6}
          y={0.4}
          width={0.8}
          height={3}
          fill="var(--accent)"
          transform={`rotate(${angle} 6 6)`}
          rx={0.4}
        />
      ))}
    </svg>
  )
}

export function MinesweeperGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)
  const [flagMode, setFlagMode] = useState(false)
  const swipe = useSwipe((dir) => send({ type: "moveCursor", dir }))

  // Space reveals and F flags instead of toggling, so they stay in onKey and
  // never fall through to the hook's toggle-on-space default. Enter toggles
  // (the hook default), R restarts, P pauses.
  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const dir = KEY_DIRS[key]
      if (dir) {
        event.preventDefault()
        send({ type: "moveCursor", dir })
        return true
      }

      if (key === " ") {
        event.preventDefault()
        send({ type: "reveal", index: state.cursor })
        return true
      }

      if (key === "f") {
        event.preventDefault()
        send({ type: "flag", index: state.cursor })
        return true
      }
    },
  })

  const flagsPlaced = state.flagged.filter(Boolean).length

  return (
    <GameScreen
      style={accentVars("Minesweeper")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Minesweeper"
        badges={
          <>
            <PixelScore label="Time" value={state.time} digits={3} />
            <PixelScore
              label="Mines"
              value={Math.max(0, MINES - flagsPlaced)}
              digits={3}
              variant="outline"
            />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* Sized against the screen; the grid stays 9×9 and square, so cells
          never change size mid-game. */}
      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-[repeat(9,minmax(0,1fr))] grid-rows-[repeat(9,minmax(0,1fr))] gap-px bg-border p-px">
          {Array.from({ length: SIZE }, (_, index) => {
            const open = state.revealed[index]
            const count = state.counts[index]
            return (
              <button
                key={index}
                type="button"
                aria-label={
                  open
                    ? `Revealed cell ${index + 1}`
                    : `Hidden cell ${index + 1}`
                }
                className={cn(
                  "relative grid place-items-center rounded-none border-none",
                  open ? "bg-muted" : "bg-background hover:bg-muted/60",
                  state.cursor === index &&
                    state.status === "running" &&
                    "ring-2 ring-[var(--accent)]"
                )}
                onClick={() =>
                  send({ type: flagMode ? "flag" : "reveal", index })
                }
                onContextMenu={(event) => {
                  event.preventDefault()
                  send({ type: "flag", index })
                }}
              >
                {open && count > 0 && (
                  <span className="text-xs font-semibold text-[var(--accent)]">
                    {count}
                  </span>
                )}
                {open && state.mines[index] && <Mine />}
                {!open && state.flagged[index] && <Flag />}
              </button>
            )
          })}
        </div>

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          onToggle={() => send({ type: "toggle" })}
        >
          {(state.status === "over" || state.status === "won") && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Time {state.time}s
            </span>
          )}
        </StatusOverlay>

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <GameFooter
        status={state.status}
        hint={`Tap to ${flagMode ? "flag" : "reveal"} · Arrows + Space/F · P pauses; R restarts`}
        onToggle={() => send({ type: "toggle" })}
        actions={
          <Button
            variant={flagMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setFlagMode((mode) => !mode)}
            aria-pressed={flagMode}
          >
            {flagMode ? "Flag on" : "Reveal"}
          </Button>
        }
      />
    </GameScreen>
  )
}