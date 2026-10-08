"use client"

import { useEffect, useReducer, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameFrame } from "@/hooks/use-game-tick"
import { useGameKeys } from "@/hooks/use-game-keys"
import { createHighScore } from "@/lib/high-score"
import { accentVars } from "@/lib/games"
import {
  BALL_R,
  PADDLE_H,
  PADDLE_W,
  initialState,
  reducer,
  type Dir,
  type Side,
  type Status,
} from "@/lib/game-pong"

const highScoreStore = createHighScore("pong_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over",
}

const HELP_STEPS = [
  "W/S steer your left paddle; ↑/↓ steer the right one.",
  "In 1P the right paddle is the CPU — toggle 2P in the footer.",
  "First to 5 points wins the match.",
  "P pauses; R restarts.",
]

/** The commanded direction a side gets from the keys still held down. */
function dirForSide(pressed: Set<string>, side: Side): Dir {
  if (side === "l") {
    if (pressed.has("w")) return -1
    if (pressed.has("s")) return 1
  }
  if (pressed.has("arrowup")) return -1
  if (pressed.has("arrowdown")) return 1
  return 0
}

export function PongGame() {
  const [state, send] = useReducer(reducer, initialState)
  const currentBest = Math.max(state.scoreL, state.scoreR)
  const [helpOpen, setHelpOpen] = useState(false)
  // Keys currently held, feeding setMove on keydown and keyup.
  const pressedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    highScoreStore.save(currentBest) // save() no-ops when not a new best
  }, [currentBest])

  // The frame loop. rAF keeps the rally smooth; dt travels as an action
  // payload so the reducer stays pure.
  useGameFrame(state.status, (dt) => send({ type: "tick", dt }))

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const isLeft = key === "w" || key === "s"
      const isRight = key === "arrowup" || key === "arrowdown"
      if (isLeft || isRight) {
        event.preventDefault()
        pressedRef.current.add(key)
        const side: Side = isLeft ? "l" : "r"
        send({ type: "setMove", side, dir: dirForSide(pressedRef.current, side) })
        return true
      }
    },
  })

  // The keydown side of held keys lives in useGameKeys; keyup and blur keep
  // the same story so nothing is left drifting.
  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isLeft = key === "w" || key === "s"
      const isRight = key === "arrowup" || key === "arrowdown"
      if (!isLeft && !isRight) return
      pressedRef.current.delete(key)
      const side: Side = isLeft ? "l" : "r"
      send({ type: "setMove", side, dir: dirForSide(pressedRef.current, side) })
    }

    // Losing window focus with a key held would leave the paddle drifting.
    const onBlur = () => {
      if (pressedRef.current.size === 0) return
      pressedRef.current.clear()
      send({ type: "setMove", side: "l", dir: 0 })
      send({ type: "setMove", side: "r", dir: 0 })
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
      style={accentVars("Pong")}
    >
      <GameHeader
        title="Pong"
        badges={
          <>
            <PixelScore label="P1" value={state.scoreL} digits={1} />
            <PixelScore label="P2" value={state.scoreR} digits={1} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div className="game-board relative mx-auto aspect-square shrink-0 overflow-hidden rounded-none border bg-background">
        {/* Centre line */}
        <div className="absolute top-0 left-1/2 h-full border-l border-dashed border-border" />

        {/* Left paddle */}
        <div
          className="absolute rounded-none bg-[var(--accent)]"
          style={{
            left: 0,
            top: `${state.padL - PADDLE_H / 2}%`,
            width: `${PADDLE_W}%`,
            height: `${PADDLE_H}%`,
          }}
        />

        {/* Right paddle */}
        <div
          className="absolute rounded-none bg-[var(--accent)]"
          style={{
            right: 0,
            top: `${state.padR - PADDLE_H / 2}%`,
            width: `${PADDLE_W}%`,
            height: `${PADDLE_H}%`,
          }}
        />

        {/* Ball (a small square) */}
        <div
          className="absolute rounded-none bg-[var(--accent)]"
          style={{
            left: `${state.ball.x - BALL_R}%`,
            top: `${state.ball.y - BALL_R}%`,
            width: `${BALL_R * 2}%`,
            height: `${BALL_R * 2}%`,
          }}
        />

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          onToggle={() => send({ type: "toggle" })}
        >
          {state.status === "over" && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {state.scoreL} – {state.scoreR}
            </span>
          )}
        </StatusOverlay>

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <GameFooter
        status={state.status}
        hint="W/S vs ↑/↓ · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => send({ type: "toggleCpu" })}
            aria-pressed={!state.cpu}
          >
            1P ↔ 2P
          </Button>
        }
      />
    </GameScreen>
  )
}