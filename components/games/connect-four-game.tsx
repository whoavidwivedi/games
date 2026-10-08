"use client"

import { useReducer, useState } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useSwipe, type SwipeDirection } from "@/hooks/use-swipe"
import { accentVars } from "@/lib/games"
import {
  COLS,
  initialState,
  reducer,
  type Status,
} from "@/lib/game-connect-four"
import { cn } from "@/lib/utils"

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "",
}

const HELP_STEPS = [
  "Two players share one phone; 1 is accent, 2 is the outline discs.",
  "Tap a column to drop your disc into it.",
  "Line up four in a row — any direction — to win the round.",
  "Win tallies carry across rematches; P pauses; R restarts.",
]

const KEY_COLS: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
}

export function ConnectFourGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)
  const swipe = useSwipe((direction: SwipeDirection) => {
    if (direction === "left") send({ type: "moveCursor", dx: -1 })
    else if (direction === "right") send({ type: "moveCursor", dx: 1 })
    else if (direction === "down") send({ type: "select" })
  })

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const col = KEY_COLS[key]
      if (col !== undefined) {
        event.preventDefault()
        send({ type: "drop", col })
        return true
      }

      if (key === "arrowleft" || key === "a") {
        event.preventDefault()
        send({ type: "moveCursor", dx: -1 })
        return true
      }
      if (key === "arrowright" || key === "d") {
        event.preventDefault()
        send({ type: "moveCursor", dx: 1 })
        return true
      }
      if (key === "arrowdown" || key === "s") {
        event.preventDefault()
        send({ type: "select" })
        return true
      }
    },
  })

  const overText =
    state.status === "over"
      ? state.winner === null
        ? "It's a draw"
        : state.winner === 1
          ? "P1 wins!"
          : "P2 wins!"
      : OVERLAY_TEXT[state.status]

  return (
    <GameScreen
      style={accentVars("Connect Four")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Connect Four"
        badges={
          <>
            <PixelScore label="P1" value={state.wins1} digits={2} />
            <PixelScore label="P2" value={state.wins2} digits={2} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-[repeat(7,minmax(0,1fr))] grid-rows-[repeat(6,minmax(0,1fr))] gap-1 border bg-border p-1">
          {state.grid.map((cell, index) => {
            const col = index % COLS
            const cursorHere =
              state.status === "running" && state.cursor === col
            return (
              <button
                key={index}
                type="button"
                aria-label={`Column ${col + 1}, row ${Math.floor(index / COLS) + 1}${
                  cell ? (cell === 1 ? ", P1" : ", P2") : ", empty"
                }`}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-none border-none bg-background",
                  cursorHere && "ring-2 ring-inset ring-[var(--accent)]"
                )}
                onClick={() => send({ type: "drop", col })}
              >
                <span
                  className={cn(
                    "h-3/4 w-3/4 rounded-full",
                    cell === 1 && "bg-[var(--accent)]",
                    cell === 2 &&
                      "border-[3px] border-[var(--foreground)] bg-transparent"
                  )}
                />
              </button>
            )
          })}
        </div>

        <StatusOverlay
          status={state.status}
          label={overText}
          actionLabel={state.status === "over" ? "Rematch" : undefined}
          onToggle={() =>
            state.status === "over"
              ? send({ type: "newGame" })
              : send({ type: "toggle" })
          }
        />

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <GameFooter
        status={state.status}
        hint="Tap a column · 1–7 keys · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}