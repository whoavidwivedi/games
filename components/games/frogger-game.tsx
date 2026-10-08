"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameFrame } from "@/hooks/use-game-tick"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useSwipe, type SwipeDirection } from "@/hooks/use-swipe"
import { createHighScore } from "@/lib/high-score"
import { accentVars } from "@/lib/games"
import {
  BOARD,
  GOAL_COLS,
  MOVING_LANES,
  initialState,
  reducer,
  type Status,
} from "@/lib/game-frogger"
import { cn } from "@/lib/utils"

const highScoreStore = createHighScore("frogger_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over",
  won: "All five goals!",
}

const HELP_STEPS = [
  "Hop with arrows / WASD (or swipe) one cell at a time.",
  "Dodge the cars and ride the logs across the river.",
  "Tuck into every empty goal slot on the top row for 10 points.",
  "Reaching land under a car or drifting off a log ends the hop; P pauses; R restarts.",
]

/** The lane row a moving lane occupies (3 road rows, then 3 river rows). */
function laneRow(index: number): number {
  return index < 3 ? index + 1 : index + 3
}

export function FroggerGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const swipe = useSwipe((direction: SwipeDirection) => {
    if (direction === "up") send({ type: "hop", dx: 0, dy: -1 })
    else if (direction === "down") send({ type: "hop", dx: 0, dy: 1 })
    else if (direction === "left") send({ type: "hop", dx: -1, dy: 0 })
    else send({ type: "hop", dx: 1, dy: 0 })
  })

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // The frame loop; dt travels as an action payload so the reducer stays pure.
  useGameFrame(state.status, (dt) => send({ type: "tick", dt }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const hop = (dx: number, dy: number) => {
        event.preventDefault()
        send({ type: "hop", dx, dy })
      }
      if (key === "arrowup" || key === "w") hop(0, -1)
      else if (key === "arrowdown" || key === "s") hop(0, 1)
      else if (key === "arrowleft" || key === "a") hop(-1, 0)
      else if (key === "arrowright" || key === "d") hop(1, 0)
      else return false
      return true
    },
  })

  const goalsFilled = state.goals.filter(Boolean).length

  return (
    <GameScreen
      style={accentVars("Frogger")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Frogger"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={storedBest} variant="outline" />
            <PixelScore label="Goals" value={goalsFilled} digits={1} />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div className="game-board relative mx-auto aspect-square shrink-0 overflow-hidden rounded-none border bg-background">
        {/* Lane tinting, one cell per grid square */}
        <div className="absolute inset-0 grid grid-cols-9 grid-rows-9">
          {Array.from({ length: BOARD * BOARD }, (_, index) => {
            const row = Math.floor(index / BOARD)
            return (
              <div
                key={index}
                className={cn(
                  "border-none",
                  row === 0 && "bg-muted/40",
                  row >= 1 && row <= 3 && "bg-muted/30",
                  row === 4 && "bg-background",
                  row >= 5 && row <= 7 && "bg-muted/20",
                  row === 8 && "bg-muted/40"
                )}
              />
            )
          })}
        </div>

        {/* Goal slots (row 0) */}
        {GOAL_COLS.map((col, slot) => (
          <div
            key={slot}
            className={cn(
              "absolute grid place-items-center border",
              state.goals[slot]
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[var(--accent-soft)]"
            )}
            style={{
              left: `${(col / BOARD) * 100}%`,
              top: `0%`,
              width: `${100 / BOARD}%`,
              height: `${100 / BOARD}%`,
            }}
          />
        ))}

        {/* Cars and logs, derived from each lane's offset */}
        {MOVING_LANES.map((lane, laneIndex) => {
          const row = laneRow(laneIndex)
          const spacing = lane.spacing
          const count = Math.ceil(BOARD / spacing)
          const bars: { left: number }[] = []
          for (let i = 0; i < count; i++) {
            const start = ((state.offsets[laneIndex] + i * spacing) % BOARD + BOARD) % BOARD
            bars.push({ left: start })
          }
          return bars.map((bar, barIndex) => (
            <div
              key={`${laneIndex}-${barIndex}`}
              className={cn(
                "absolute rounded-none",
                lane.kind === "car" ? "bg-[var(--accent)]" : "bg-[var(--accent-soft)]"
              )}
              style={{
                left: `${(bar.left / BOARD) * 100}%`,
                top: `${(row / BOARD) * 100}%`,
                width: `${(lane.len / BOARD) * 100}%`,
                height: `${100 / BOARD}%`,
              }}
            />
          ))
        })}

        {/* The frog */}
        <div
          className="absolute rounded-full bg-[var(--accent)]"
          style={{
            left: `${(state.frog.x / BOARD) * 100 - 100 / BOARD / 2}%`,
            top: `${(state.frog.y / BOARD) * 100 - 100 / BOARD / 2}%`,
            width: `${100 / BOARD}%`,
            height: `${100 / BOARD}%`,
          }}
        />
        <div
          className="absolute rounded-full bg-[var(--foreground)]"
          style={{
            left: `${(state.frog.x / BOARD) * 100 - 1.5}%`,
            top: `${(state.frog.y / BOARD) * 100 - 1.6}%`,
            width: "1.2%",
            height: "1.2%",
          }}
        />
        <div
          className="absolute rounded-full bg-[var(--foreground)]"
          style={{
            left: `${(state.frog.x / BOARD) * 100 + 0.4}%`,
            top: `${(state.frog.y / BOARD) * 100 - 1.6}%`,
            width: "1.2%",
            height: "1.2%",
          }}
        />

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          onToggle={() => send({ type: "toggle" })}
        >
          {(state.status === "over" || state.status === "won") && (
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
        hint="Arrows / WASD or swipe to hop · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}