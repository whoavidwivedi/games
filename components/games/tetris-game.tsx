"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useGameTick } from "@/hooks/use-game-tick"
import { useSwipe } from "@/hooks/use-swipe"
import { createHighScore } from "@/lib/high-score"
import { accentVars } from "@/lib/games"
import { H, W, initialState, reducer, type Status } from "@/lib/game-tetris"
import { cn } from "@/lib/utils"

const highScoreStore = createHighScore("tetris_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over",
}

const HELP_STEPS = [
  "Arrows or WASD move, rotate, and soft drop the falling piece.",
  "Space drops the piece straight to the floor.",
  "Fill complete rows to clear them and score.",
  "P pauses; R restarts.",
]

export function TetrisGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.score)
  const [helpOpen, setHelpOpen] = useState(false)

  const swipe = useSwipe((dir) => {
    if (dir === "left") send({ type: "move", dx: -1 })
    else if (dir === "right") send({ type: "move", dx: 1 })
    else if (dir === "up") send({ type: "rotate" })
    else send({ type: "softDrop" })
  })

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // Gravity cadence: a fixed 100ms interval dispatches dt as an action payload
  // so the reducer stays pure and the cadence is independent of frame rate.
  useGameTick(state.status, 100, () => send({ type: "tick", dt: 0.1 }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const movedBy = (dx: -1 | 1) => {
        event.preventDefault()
        send({ type: "move", dx })
      }
      if (key === "arrowleft" || key === "a") {
        movedBy(-1)
        return true
      }
      if (key === "arrowright" || key === "d") {
        movedBy(1)
        return true
      }
      if (key === "arrowup" || key === "w") {
        event.preventDefault()
        send({ type: "rotate" })
        return true
      }
      if (key === "arrowdown" || key === "s") {
        event.preventDefault()
        send({ type: "softDrop" })
        return true
      }
      if (key === " ") {
        event.preventDefault()
        send({ type: "hardDrop" })
        return true
      }
    },
  })

  // Active piece cells as flat indices, for the board pass.
  const pieceSet =
    state.status !== "over" && state.piece
      ? new Set(
          state.piece.cells.map((cell) => (state.pieceY + cell.y) * W + (state.pieceX + cell.x))
        )
      : null

  return (
    <GameScreen
      style={accentVars("Tetris")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Tetris"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={best} variant="outline" />
            <PixelScore label="Level" value={state.level} digits={2} />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-10 grid-rows-10 gap-px border bg-border p-px">
          {Array.from({ length: W * H }, (_, index) => {
            const active = pieceSet !== null && pieceSet.has(index)
            const locked = state.field[index] !== null
            return (
              <div
                key={index}
                className={cn(
                  "rounded-none",
                  active
                    ? "bg-[var(--accent)]"
                    : locked
                      ? "bg-[var(--accent-soft)]"
                      : "bg-background"
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

      <GameFooter
        status={state.status}
        hint="←→ move · ↑ rotate · ↓ soft · Space hard drop · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}