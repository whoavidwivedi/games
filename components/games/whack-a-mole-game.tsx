"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameFrame } from "@/hooks/use-game-tick"
import { useGameKeys } from "@/hooks/use-game-keys"
import { createHighScore } from "@/lib/high-score"
import { accentVars } from "@/lib/games"
import { HOLES, initialState, reducer, type Status } from "@/lib/game-whack-a-mole"

const highScoreStore = createHighScore("whack_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Time's up!",
}

const HELP_STEPS = [
  "Moles pop up across the three rows of holes.",
  "Tap a mole before it ducks away to score a point.",
  "Each mole stays up for under a second — beat the clock.",
  "The round lasts 30 seconds; P pauses; R restarts.",
]

export function WhackAMoleGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // The frame loop feeds the reducer's clock; dt travels as a payload.
  useGameFrame(state.status, (dt) => send({ type: "tick", dt }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
  })

  return (
    <GameScreen
      style={accentVars("Whack-a-Mole")}
    >
      <GameHeader
        title="Whack-a-Mole"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={storedBest} variant="outline" />
            <PixelScore label="Time" value={Math.ceil(state.timeLeft)} digits={2} />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-2 p-2">
          {Array.from({ length: HOLES }, (_, hole) => {
            const moleUp = state.active.some((mole) => mole.hole === hole)
            return (
              <button
                key={hole}
                type="button"
                aria-label={moleUp ? `Hole ${hole + 1}, mole up` : `Hole ${hole + 1}`}
                className="relative grid aspect-square place-items-center overflow-hidden rounded-none border border-border bg-muted"
                onClick={() => send({ type: "whack", hole })}
              >
                {moleUp && (
                  <span className="px-dither relative flex h-4/5 w-4/5 items-center justify-center rounded-full">
                    <span className="absolute top-1/3 left-[30%] size-1 rounded-full bg-[var(--foreground)]" />
                    <span className="absolute top-1/3 left-[62%] size-1 rounded-full bg-[var(--foreground)]" />
                  </span>
                )}
              </button>
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
        hint="Tap the moles · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}