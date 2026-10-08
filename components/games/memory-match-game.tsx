"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { Button } from "@/components/ui/button"
import { useGameKeys } from "@/hooks/use-game-keys"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import { initialState, reducer, type Status } from "@/lib/game-memory-match"
import { cn } from "@/lib/utils"

// Fewer moves is better, so the best store runs in "min" mode.
const highScoreStore = createHighScore("memory_best", "min")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  won: "All pairs found!",
}

const HELP_STEPS = [
  "Tap a card to flip it face-up.",
  "Find its twin to lock the pair in place.",
  "A mismatch flips itself back after a short look.",
  "P pauses; R restarts.",
]

const KEY_DX: Record<string, -1 | 1> = {
  arrowleft: -1,
  arrowright: 1,
}

export function MemoryMatchGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  // Best (min) is the fewest moves; nothing stored yet shows the live run.
  const best = storedBest > 0 ? Math.min(storedBest, state.moves) : state.moves

  useEffect(() => {
    highScoreStore.save(state.moves) // save() no-ops when not a new best
  }, [state.moves])

  // A mismatch stays face-up for ~750ms, then flips back.
  useEffect(() => {
    if (state.status !== "running" || !state.resolving) return
    const id = setTimeout(() => send({ type: "resolve" }), 750)
    return () => clearTimeout(id)
  }, [state.status, state.resolving])

  // Space/Enter flip the hovered card instead of toggling, so they stay in
  // onKey and never fall through to the hook's toggle defaults.
  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const dx = KEY_DX[key]
      if (dx !== undefined) {
        event.preventDefault()
        send({ type: "moveCursor", dx })
        return true
      }

      if (key === " " || key === "enter") {
        const target = event.target
        const onControl =
          target instanceof HTMLElement &&
          target.closest("button, a, [role='button']") !== null

        if (!onControl) {
          event.preventDefault()
          if (!state.resolving) send({ type: "flip", index: state.cursor })
        }
        return true
      }
    },
  })

  return (
    <GameScreen
      style={accentVars("Memory Match")}
    >
      <GameHeader
        title="Memory Match"
        badges={
          <>
            <PixelScore label="Moves" value={state.moves} digits={3} />
            <PixelScore label="Best" value={best} digits={3} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* Sized against the screen; the 4×4 grid keeps cards square no matter
          what the chrome says. */}
      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-px border bg-border p-px">
          {state.cards.map((card, index) => {
            const isOpen = state.matched.includes(card.value) || state.flipped.includes(index)
            return (
              <Button
                key={card.id}
                size="xs"
                aria-label={
                  isOpen
                    ? `Card ${index + 1}, value ${card.value}`
                    : `Hidden card ${index + 1}`
                }
                className={cn(
                  "h-full w-full rounded-none border-none p-0",
                  isOpen
                    ? "bg-[var(--accent)]"
                    : "bg-background px-dither",
                  state.cursor === index &&
                    state.status === "running" &&
                    "ring-2 ring-[var(--accent)]"
                )}
                onClick={() => send({ type: "flip", index })}
              >
                {isOpen ? (
                  <span className="text-2xl font-semibold text-background">
                    {card.value}
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-pipe)]" />
                )}
              </Button>
            )
          })}
        </div>

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          onToggle={() => send({ type: "toggle" })}
        >
          {state.status === "won" && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {state.moves} moves
            </span>
          )}
        </StatusOverlay>

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <GameFooter
        status={state.status}
        hint="Tap cards or Arrow keys + Space · P pauses; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}