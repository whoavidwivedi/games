"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"
import { RiDeleteBackLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useGameTick } from "@/hooks/use-game-tick"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import {
  COLS,
  PUZZLES,
  ROWS,
  SIZE,
  initialState,
  reducer,
  type Status,
} from "@/lib/game-sudoku"
import { cn } from "@/lib/utils"

// --- High score (fastest solve wins, so "min" is better) ---------------------

const highScoreStore = createHighScore("sudoku_best", "min")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  won: "Solved!",
}

const HELP_STEPS = [
  "Fill every row, column and 3×3 box with the digits 1–9.",
  "Tap a cell, then use the pad or the 1–9 keys to enter it.",
  "The givens are locked; wrong entries count as errors.",
  "P pauses; R restarts.",
]

/** Wrap the selection across the row/column edges. */
function step(from: number, dir: "up" | "down" | "left" | "right"): number {
  const row = Math.floor(from / COLS)
  const col = from % COLS
  if (dir === "left") return row * COLS + (col - 1 + COLS) % COLS
  if (dir === "right") return row * COLS + (col + 1) % COLS
  if (dir === "up") return (row - 1 + ROWS) % ROWS * COLS + col
  return (row + 1) % ROWS * COLS + col
}

export function SudokuGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const [helpOpen, setHelpOpen] = useState(false)

  // Record a new best time the moment the board is solved (min store, so the
  // save only ever fires on a solve — never mid-puzzle).
  useEffect(() => {
    if (state.status === "won" && highScoreStore.isBetter(state.time)) {
      highScoreStore.save(state.time)
    }
  }, [state.status, state.time])

  // Game loop: one tick per second while running.
  useGameTick(state.status, 1000, () => send({ type: "tick" }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      if (
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "arrowup" ||
        key === "arrowdown"
      ) {
        event.preventDefault()
        const dir = key.slice(5) as "left" | "right" | "up" | "down"
        send({ type: "select", index: step(state.selected ?? Math.floor(SIZE / 2), dir) })
        return true
      }

      if (/^[1-9]$/.test(key)) {
        event.preventDefault()
        send({ type: "set", value: Number(key) })
        return true
      }

      if (key === "backspace" || key === "0") {
        event.preventDefault()
        send({ type: "set", value: 0 })
        return true
      }
    },
  })

  const puzzle = PUZZLES[state.puzzleIndex]
  // The pad (and digit keys) may only edit a running, non-given, selected cell.
  const canType =
    state.status === "running" &&
    state.selected !== null &&
    puzzle.given[state.selected] === 0

  return (
    <GameScreen
      style={accentVars("Sudoku")}
    >
      <GameHeader
        title="Sudoku"
        badges={
          <>
            <PixelScore label="Time" value={state.time} digits={3} />
            <PixelScore label="Best" value={storedBest} digits={3} variant="outline" />
            <PixelScore label="Errors" value={state.errors} digits={2} />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* The square board; heavier border-doubles frame each 3×3 box. */}
      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-9 grid-rows-9">
          {state.cells.map((value, index) => {
            const row = Math.floor(index / COLS)
            const col = index % COLS
            const given = puzzle.given[index] !== 0
            return (
              <Button
                key={index}
                variant="ghost"
                aria-label={
                  given
                    ? `Given ${value}, row ${row + 1} column ${col + 1}`
                    : value !== 0
                      ? `Cell value ${value}, row ${row + 1} column ${col + 1}`
                      : `Empty cell, row ${row + 1} column ${col + 1}`
                }
                className={cn(
                  "grid h-full w-full place-items-center rounded-none border-border p-0",
                  col % 3 === 0 ? "border-l-2" : "border-l",
                  row % 3 === 0 ? "border-t-2" : "border-t",
                  col === COLS - 1 && "border-r-2",
                  row === ROWS - 1 && "border-b-2",
                  given
                    ? "font-semibold text-[var(--accent)]"
                    : "text-foreground",
                  state.selected === index &&
                    state.status === "running" &&
                    "ring-2 ring-[var(--accent)]"
                )}
                onClick={() => send({ type: "select", index })}
              >
                {value !== 0 ? value : ""}
              </Button>
            )
          })}
        </div>

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          finished={state.status === "won"}
          onToggle={() => send({ type: "toggle" })}
        >
          {state.status === "won" && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Time {state.time}s
            </span>
          )}
        </StatusOverlay>

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      {/* The entry pad sits between the square board and the footer, so the
          board itself never grows. */}
      <div className="grid shrink-0 grid-cols-10 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button
            key={digit}
            variant="outline"
            size="sm"
            className="rounded-none"
            disabled={!canType}
            onClick={() => send({ type: "set", value: digit })}
          >
            {digit}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="rounded-none"
          disabled={!canType}
          aria-label="Erase selected cell"
          onClick={() => send({ type: "set", value: 0 })}
        >
          <RiDeleteBackLine />
        </Button>
      </div>

      <GameFooter
        status={state.status}
        hint="Fill 1–9 in every row · 1–9 keys · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}