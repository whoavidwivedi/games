"use client"

import { useReducer, useState } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { Button } from "@/components/ui/button"
import { useGameKeys } from "@/hooks/use-game-keys"
import { accentVars } from "@/lib/games"
import { initialState, reducer, type Status } from "@/lib/game-tic-tac-toe"

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "",
}

const HELP_STEPS = [
  "Take turns on one phone, or switch to System to play the computer.",
  "Tap a cell to drop your mark — X always starts.",
  "Line up three in a row to win the round.",
  "The tally carries across rematches.",
]

/** A cross, drawn as two accent bars (the incumbent first player). */
function MarkX() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2/3 w-2/3">
      <rect x={4.6} y={0.2} width={2.8} height={11.6} rx={1} fill="var(--accent)" transform="rotate(45 6 6)" />
      <rect x={4.6} y={0.2} width={2.8} height={11.6} rx={1} fill="var(--accent)" transform="rotate(-45 6 6)" />
    </svg>
  )
}

/** A nought, drawn as a foreground ring. */
function MarkO() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2/3 w-2/3">
      <circle
        cx={6}
        cy={6}
        r={4.6}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.6}
      />
    </svg>
  )
}

const KEY_CELLS: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
}

export function TicTacToeGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)
  const system = state.mode === "system"

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const cell = KEY_CELLS[key]
      if (cell !== undefined) {
        event.preventDefault()
        send({ type: "place", index: cell })
        return true
      }
    },
  })

  const overText =
    state.status === "over"
      ? state.winner === "draw"
        ? "It's a draw"
        : state.winner === "x"
          ? system
            ? "You win!"
            : "X wins!"
          : system
            ? "System wins!"
            : "O wins!"
      : OVERLAY_TEXT[state.status]
  const turnText =
    state.status === "running"
      ? system
        ? "Your turn"
        : state.turn === "x"
          ? "X to move"
          : "O to move"
      : "Tap a cell to play"

  return (
    <GameScreen style={accentVars("Tic-Tac-Toe")}>
      <GameHeader
        title="Tic-Tac-Toe"
        badges={
          <>
            <PixelScore label={system ? "You" : "X"} value={state.xWins} digits={2} />
            <PixelScore
              label={system ? "CPU" : "O"}
              value={state.oWins}
              digits={2}
              variant="outline"
            />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* The board stays exactly square whatever the header/footer say, so
          cells never resize between rounds. */}
      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-1 border bg-border p-1">
          {state.board.map((cell, index) => (
            <button
              key={index}
              type="button"
              aria-label={cell ? `${cell} at ${index + 1}` : `Empty cell ${index + 1}`}
              className="grid aspect-square place-items-center rounded-none border bg-background transition-colors hover:bg-muted"
              onClick={() => send({ type: "place", index })}
            >
              {cell === "x" && <MarkX />}
              {cell === "o" && <MarkO />}
            </button>
          ))}
        </div>

        <StatusOverlay
          status={state.status}
          label={overText}
          onToggle={() =>
            send(
              state.status === "over"
                ? { type: "newGame" }
                : { type: "toggle" }
            )
          }
        />

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <GameFooter
        status={state.status}
        hint={`${turnText} · P pauses; R restarts`}
        onToggle={() => send({ type: "toggle" })}
        actions={
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant={system ? "outline" : "default"}
              onClick={() => send({ type: "setMode", mode: "two-player" })}
            >
              2 Player
            </Button>
            <Button
              size="xs"
              variant={system ? "default" : "outline"}
              onClick={() => send({ type: "setMode", mode: "system" })}
            >
              System
            </Button>
          </div>
        }
      />
    </GameScreen>
  )
}