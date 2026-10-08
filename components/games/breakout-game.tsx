"use client"

import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react"

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
  BALL_R,
  BRICK_H,
  BRICK_TOP,
  BRICK_W,
  COLS,
  PADDLE_H,
  PADDLE_W,
  initialState,
  reducer,
  type Dir,
  type Status,
} from "@/lib/game-breakout"

const highScoreStore = createHighScore("breakout_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over",
  won: "All clear!",
}

const HELP_STEPS = [
  "Steer the paddle with ←/→ or A/D (swipe on touch).",
  "Space launches the ball; it speeds up as you rally it.",
  "Clear every brick for 10 points each before the ball falls.",
  "You get 3 lives; P pauses; R restarts.",
]

/** The paddle direction from the keys still held down. */
function dirForKeys(pressed: Set<string>): Dir {
  if (pressed.has("arrowleft") || pressed.has("a")) return -1
  if (pressed.has("arrowright") || pressed.has("d")) return 1
  return 0
}

export function BreakoutGame() {
  const [state, send] = useReducer(reducer, initialState)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const pressedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // The frame loop; dt travels as an action payload so the reducer stays pure.
  useGameFrame(state.status, (dt) => send({ type: "tick", dt }))

  // A swipe nudges the paddle for a beat, like a queued key press.
  const pulse = (dir: Dir) => {
    send({ type: "move", dir })
    window.setTimeout(() => send({ type: "move", dir: 0 }), 350)
  }
  const swipe = useSwipe((direction: SwipeDirection) => {
    if (direction === "left") pulse(-1)
    else if (direction === "right") pulse(1)
  })

  // Space launches the ball when it is stuck, otherwise toggles like the hook
  // defaults would; the paddle keys are held, so they keep the keyup closure.
  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const isMove =
        key === "arrowleft" || key === "arrowright" || key === "a" || key === "d"
      if (isMove) {
        event.preventDefault()
        pressedRef.current.add(key)
        send({ type: "move", dir: dirForKeys(pressedRef.current) })
        return true
      }

      if (key === " ") {
        const target = event.target
        const onControl =
          target instanceof HTMLElement &&
          target.closest("button, a, [role='button']") !== null
        if (!onControl) {
          event.preventDefault()
          if (state.status === "running" && state.stuck) send({ type: "launch" })
          else send({ type: "toggle" })
        }
        return true
      }
    },
  })

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key !== "arrowleft" && key !== "arrowright" && key !== "a" && key !== "d")
        return
      pressedRef.current.delete(key)
      send({ type: "move", dir: dirForKeys(pressedRef.current) })
    }

    const onBlur = () => {
      if (pressedRef.current.size === 0) return
      pressedRef.current.clear()
      send({ type: "move", dir: 0 })
    }

    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  return (
    <GameScreen
      style={accentVars("Breakout")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Breakout"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={storedBest} variant="outline" />
            <PixelScore label="Lives" value={state.lives} digits={1} />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div
        className="game-board relative mx-auto aspect-square shrink-0 overflow-hidden rounded-none border bg-background"
        onPointerDown={() => {
          if (state.status === "running" && state.stuck) send({ type: "launch" })
        }}
      >
        {state.bricks.map((alive, index) => {
          if (!alive) return null
          const col = index % COLS
          const row = Math.floor(index / COLS)
          return (
            <div
              key={index}
              className="absolute rounded-none bg-[var(--accent)]"
              style={{
                left: `${col * BRICK_W}%`,
                top: `${BRICK_TOP + row * BRICK_H}%`,
                width: `${BRICK_W}%`,
                height: `${BRICK_H}%`,
              }}
            />
          )
        })}

        {/* Paddle */}
        <div
          className="absolute rounded-none bg-[var(--accent)]"
          style={{
            left: `${state.paddleX - PADDLE_W / 2}%`,
            top: `${100 - PADDLE_H}%`,
            width: `${PADDLE_W}%`,
            height: `${PADDLE_H}%`,
          }}
        />

        {/* Ball */}
        {!state.stuck && (
          <div
            className="absolute rounded-none bg-[var(--foreground)]"
            style={{
              left: `${state.ball.x - BALL_R}%`,
              top: `${state.ball.y - BALL_R}%`,
              width: `${BALL_R * 2}%`,
              height: `${BALL_R * 2}%`,
            }}
          />
        )}

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
        hint="←→ / A D move · Space launch · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}