"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useGameTick } from "@/hooks/use-game-tick"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import { PADS, initialState, reducer, type Status } from "@/lib/game-simon"
import { cn } from "@/lib/utils"

const highScoreStore = createHighScore("simon_best")

/** How long each pad stays lit during the sequence playback. */
const STEP_MS = 650

// "over" text is dynamic (it shows the reached length), so it is built
// outside this record.
const OVERLAY_TEXT: Record<Exclude<Status, "over">, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  won: "Perfect streak!",
}

const HELP_STEPS = [
  "Watch the pads light up in a sequence.",
  "Then tap them back in exactly the same order.",
  "Every round you clear adds one more pad.",
  "P pauses; R restarts.",
]

/** One accent-tinted tone per pad, so each quadrant reads at a glance. */
const PAD_CLASSES = [
  "bg-[var(--accent)] hover:bg-[var(--accent)]",
  "bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]",
  "bg-[var(--accent-pipe)] hover:bg-[var(--accent-pipe)]",
  "border-2 border-[var(--accent)] bg-[var(--background)] hover:bg-[var(--background)]",
]

const KEY_PADS: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
}

export function SimonGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.score)

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // Playback: step through the sequence one pad every STEP_MS while it is
  // being shown; the reducer hands over to "input" at the end. useGameTick
  // only runs while the derived status is "running" (running + showing).
  const playback =
    state.status === "running" && state.phase === "show" ? "running" : "stopped"
  useGameTick(playback, STEP_MS, () => send({ type: "step" }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      if (key.startsWith("arrow")) {
        event.preventDefault()
        return true
      }

      const pad = KEY_PADS[key]
      if (pad !== undefined) {
        event.preventDefault()
        send({ type: "press", pad })
        return true
      }
    },
  })

  const overlayText =
    state.status === "over"
      ? `Got to ${state.score}`
      : OVERLAY_TEXT[state.status]

  return (
    <GameScreen
      style={accentVars("Simon")}
    >
      <GameHeader
        title="Simon"
        badges={
          <>
            <PixelScore label="Score" value={state.score} digits={2} />
            <PixelScore label="Best" value={best} digits={2} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* Quadrant pads; presses during playback are ignored by the reducer. */}
      <div className="game-board relative mx-auto aspect-square shrink-0">
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1 border bg-border p-1">
          {Array.from({ length: PADS }, (_, pad) => {
            const lit =
              state.status === "running" &&
              state.phase === "show" &&
              state.seq[state.showPos] === pad
            return (
              <Button
                key={pad}
                aria-label={`Pad ${pad + 1}`}
                className={cn(
                  "h-full w-full rounded-none p-0 transition-all",
                  PAD_CLASSES[pad],
                  lit && "brightness-150"
                )}
                onClick={() => send({ type: "press", pad })}
              />
            )
          })}
        </div>

        <StatusOverlay
          status={state.status}
          label={overlayText}
          onToggle={() =>
            send(
              state.status === "over"
                ? { type: "begin" }
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
        hint="Watch, then tap · 1–4 keys · P pauses; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}