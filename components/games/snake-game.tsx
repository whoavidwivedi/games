"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useGameTick } from "@/hooks/use-game-tick"
import { useSwipe } from "@/hooks/use-swipe"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import {
  KEY_DIRS,
  SIZE,
  TICK_MS,
  initialState,
  reducer,
  type Status,
} from "@/lib/game-snake"
import { cn } from "@/lib/utils"

// --- High score (localStorage-backed so it survives reloads) ---------------

const highScoreStore = createHighScore("snake_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over",
}

const HELP_STEPS = [
  "Swipe or use the arrow keys / WASD to steer.",
  "Eat the dots to grow and score.",
  "Walls and your own tail end the game.",
  "P pauses; R restarts.",
]

export function SnakeGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.score)
  // Fires while the finger is still moving, so swipes respond immediately.
  const swipe = useSwipe((dir) => send({ type: "turn", dir }))
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  useGameTick(state.status, TICK_MS, () => send({ type: "tick" }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "restart" }),
    onKey: (key, event) => {
      const dir = KEY_DIRS[key]
      if (!dir) return false
      event.preventDefault()
      send({ type: "turn", dir })
      return true
    },
  })

  const cells = new Map<number, number>()
  state.snake.forEach((segment, index) => {
    cells.set(segment.y * SIZE + segment.x, index)
  })
  const foodIndex = state.food.y * SIZE + state.food.x

  return (
    <GameScreen
      style={accentVars("Snake")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Snake"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={best} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* Sized against the screen (.game-board reserves the fixed chrome);
          the column centres header, board and footer as one group, so they
          hug the board and any slack lands at the screen edges. */}
      <div className="game-board relative mx-auto aspect-square shrink-0">
        {/* Explicit rows and columns pin the cells to equal squares that
              never change size with game state. */}
        <div className="grid h-full w-full grid-cols-[repeat(20,minmax(0,1fr))] grid-rows-[repeat(20,minmax(0,1fr))] gap-px overflow-hidden rounded-none border bg-border">
          {Array.from({ length: SIZE * SIZE }, (_, index) => {
            const segment = cells.get(index)
            return (
              <div
                key={index}
                className={cn(
                  "bg-background",
                  segment === 0 && "bg-[var(--accent)]",
                  segment !== undefined &&
                    segment !== 0 &&
                    "bg-[var(--accent-soft)]",
                  index === foodIndex && "bg-[var(--food)]"
                )}
              />
            )
          })}
        </div>

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          onToggle={() => send({ type: "toggle" })}
        >
          {state.status === "over" && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Score {state.score}
            </span>
          )}
        </StatusOverlay>

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      {/* Two fixed rows: buttons, then a full-width hint line that can't
          wrap, so the footer height never changes with the game state and
          the board's cells stay exactly the same size from idle to playing. */}
      <GameFooter
        status={state.status}
        hint="Arrows / WASD or swipe"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}