"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelBird } from "@/components/pixel-bird"
import { PixelScore } from "@/components/pixel-score"
import { useGameFrame } from "@/hooks/use-game-tick"
import { useGameKeys } from "@/hooks/use-game-keys"
import { createHighScore } from "@/lib/high-score"
import { accentVars } from "@/lib/games"
import {
  BIRD_SIZE,
  BIRD_X,
  GAP,
  GROUND,
  PIPE_W,
  initialState,
  reducer,
  type Status,
} from "@/lib/game-flappy"

// --- High score (localStorage-backed so it survives reloads) ---------------

const highScoreStore = createHighScore("flappy_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play or tap to start",
  running: "",
  paused: "Paused",
  over: "Game over",
}

const HELP_STEPS = [
  "Tap the board, or press Space / W / Up, to flap.",
  "Glide through the gaps between the pipes.",
  "Touching a pipe or the ground ends the run.",
  "P pauses; R restarts.",
]

export function FlappyGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.score)
  const [helpOpen, setHelpOpen] = useState(false)
  // Whether opening the panel paused an active run, so closing it resumes
  // exactly that run and nothing else.
  const pausedByHelp = useRef(false)

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // The flight loop. rAF keeps the run smooth; dt travels as an action
  // payload so the reducer stays pure.
  useGameFrame(state.status, (dt) => send({ type: "tick", dt }))

  const closeHelp = useCallback(() => {
    setHelpOpen(false)
    if (pausedByHelp.current) {
      pausedByHelp.current = false
      send({ type: "toggle" })
    }
  }, [])

  const toggleHelp = () => {
    if (helpOpen) {
      closeHelp()
      return
    }
    setHelpOpen(true)
    // Reading the rules must not cost a life.
    if (state.status === "running") {
      pausedByHelp.current = true
      send({ type: "toggle" })
    }
  }

  // Space/Up/W flap during a run, or toggle to start/resume otherwise; the
  // per-game handling takes over from the hook's toggle-on-space default.
  useGameKeys({
    helpOpen,
    closeHelp,
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "restart" }),
    onKey: (key, event) => {
      if (key === " " || key === "arrowup" || key === "w") {
        // preventDefault also stops a focused control from firing twice.
        event.preventDefault()
        if (state.status === "running") send({ type: "flap" })
        else send({ type: "toggle" })
        return true
      }
    },
  })

  const flap = () => {
    // The whole board is the flap button; while reading instructions the
    // tap must not reach the game.
    if (!helpOpen) send({ type: "flap" })
  }

  const tilt = Math.max(-25, Math.min(state.v * 0.8, 70))

  return (
    <GameScreen
      style={accentVars("Flappy")}
    >
      <GameHeader
        title="Flappy"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={best} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={toggleHelp}
      />

      {/* Sized against the screen (.game-board reserves the fixed chrome);
          the column centres header, board and footer as one group, so they
          hug the board and any slack lands at the screen edges. */}
      <div
        className="game-board relative mx-auto aspect-square shrink-0 cursor-pointer overflow-hidden rounded-none border bg-background"
        onPointerDown={flap}
      >
        {state.pipes.map((pipe) => (
          <Fragment key={pipe.id}>
            {/* Top pipe: its mouth is the bottom edge. */}
            <div
              className="absolute top-0 rounded-none px-dither"
              style={{
                left: `${pipe.x}%`,
                width: `${PIPE_W}%`,
                height: `${pipe.gapTop}%`,
              }}
            />
            <div
              className="absolute rounded-none px-dither"
              style={{
                left: `${pipe.x}%`,
                width: `${PIPE_W}%`,
                top: `${pipe.gapTop + GAP}%`,
                bottom: `${GROUND}%`,
              }}
            />
          </Fragment>
        ))}

        <div
          className="absolute inset-x-0 bottom-0 border-t bg-[var(--accent-soft)]"
          style={{ height: `${GROUND}%` }}
        />

        <div
          className="absolute"
          style={{
            left: `${BIRD_X - BIRD_SIZE / 2}%`,
            top: `${state.y - BIRD_SIZE / 2}%`,
            width: `${BIRD_SIZE}%`,
            height: `${BIRD_SIZE}%`,
            transform: `rotate(${tilt}deg)`,
          }}
        >
          <PixelBird flying={state.status === "running"} />
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

        {helpOpen && <HelpOverlay steps={HELP_STEPS} onClose={closeHelp} />}
      </div>

      <GameFooter
        status={state.status}
        hint="Space / W / Up or tap to flap"
        onToggle={() => send({ type: "toggle" })}
        disabled={helpOpen}
      />
    </GameScreen>
  )
}