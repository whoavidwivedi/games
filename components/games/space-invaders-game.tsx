"use client"

import {
  memo,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

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
  ALIEN_H,
  ALIEN_W,
  PLAYER_H,
  PLAYER_W,
  PLAYER_Y,
  initialState,
  reducer,
  type Dir,
  type Status,
} from "@/lib/game-space-invaders"

const highScoreStore = createHighScore("space_invaders_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over",
  won: "Earth saved!",
}

const HELP_STEPS = [
  "Slide left/right (or ← →) to duck under the alien block.",
  "Hold Space (or tap the board) to fire - the cannon auto-repeats.",
  "Top-row aliens are worth 30, middle 20, bottom 10.",
  "Don't let the block land on you; P pauses; R restarts.",
]

/** A blocky 11×8 invader sprite filled with the game colour. */
const ALIEN_MASK = [
  "..X.....X..",
  "..X.....X..",
  ".X.X...X.X.",
  ".XXXX.XXXX.",
  "XX.XXXXX.XX",
  "XXXXXXXXXXX",
  ".XX.XXX.XX.",
  "..X.....X..",
]

/** A blocky 11×8 invader sprite filled with the game colour. Memoised: the
 *  block re-renders every frame, and these ~40 rects never change. */
const InvaderSprite = memo(function InvaderSprite() {
  return (
    <svg viewBox="0 0 11 8" aria-hidden="true" className="h-full w-full" fill="var(--accent)">
      {ALIEN_MASK.map((row, r) =>
        row.split("").map((cell, c) =>
          cell === "X" ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1.05} height={1.05} />
          ) : null
        )
      )}
    </svg>
  )
})

const Cannon = memo(function Cannon() {
  return (
    <svg viewBox="0 0 12 6" aria-hidden="true" className="h-full w-full">
      <rect y={3} width={12} height={3} rx={0.5} fill="var(--accent)" />
      <rect x={4} width={4} height={3} fill="var(--accent)" />
    </svg>
  )
})

export function SpaceInvadersGame() {
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

  const pulse = (dir: Dir) => {
    send({ type: "move", dir })
    window.setTimeout(() => send({ type: "move", dir: 0 }), 300)
  }
  const swipe = useSwipe((direction: SwipeDirection) => {
    if (direction === "left") pulse(-1)
    else if (direction === "right") pulse(1)
  })

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const isMove = key === "arrowleft" || key === "arrowright" || key === "a" || key === "d"
      if (isMove) {
        event.preventDefault()
        pressedRef.current.add(key)
        const steered: Dir = pressedRef.current.has("arrowleft") || pressedRef.current.has("a") ? -1 : pressedRef.current.has("arrowright") || pressedRef.current.has("d") ? 1 : 0
        send({ type: "move", dir: steered })
        return true
      }
      if (key === " ") {
        event.preventDefault()
        send({ type: "setFire", on: true })
        return true
      }
      if (key === "enter") {
        send({ type: "toggle" })
        return true
      }
    },
  })

  // The keydown side of held keys lives in useGameKeys; keyup and blur keep
  // the same story so the cannon stops and the ship doesn't drift.
  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === " ") {
        send({ type: "setFire", on: false })
        return
      }
      if (key !== "arrowleft" && key !== "arrowright" && key !== "a" && key !== "d") return
      pressedRef.current.delete(key)
      const steered: Dir = pressedRef.current.has("arrowleft") || pressedRef.current.has("a") ? -1 : pressedRef.current.has("arrowright") || pressedRef.current.has("d") ? 1 : 0
      send({ type: "move", dir: steered })
    }

    const onBlur = () => {
      pressedRef.current.clear()
      send({ type: "move", dir: 0 })
      send({ type: "setFire", on: false })
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
      style={accentVars("Space Invaders")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="Space Invaders"
        badges={
          <>
            <PixelScore label="Score" value={state.score} />
            <PixelScore label="Best" value={storedBest} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div
        className="game-board relative mx-auto aspect-square shrink-0 overflow-hidden rounded-none border bg-background"
        onPointerDown={() => {
          if (state.status === "running") send({ type: "shoot" })
        }}
      >
        {/* The alien block */}
        {state.aliens.map((alien, index) =>
          alien.alive ? (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${alien.x}%`,
                top: `${alien.y}%`,
                width: `${ALIEN_W}%`,
                height: `${ALIEN_H}%`,
              }}
            >
              <InvaderSprite />
            </div>
          ) : null
        )}

        {/* Player cannon */}
        <div
          className="absolute"
          style={{
            left: `${state.playerX - PLAYER_W / 2}%`,
            top: `${PLAYER_Y}%`,
            width: `${PLAYER_W}%`,
            height: `${PLAYER_H}%`,
          }}
        >
          <Cannon />
        </div>

        {/* Player bullets */}
        {state.bullets.map((bullet, index) => (
          <div
            key={index}
            className="absolute rounded-none bg-[var(--accent)]"
            style={{
              left: `${bullet.x - 0.5}%`,
              top: `${bullet.y}%`,
              width: "1%",
              height: "4%",
            }}
          />
        ))}

        {/* Invader shots */}
        {state.shots.map((shot, index) => (
          <div
            key={index}
            className="absolute rounded-none bg-[var(--foreground)]"
            style={{
              left: `${shot.x - 0.5}%`,
              top: `${shot.y}%`,
              width: "1%",
              height: "5%",
            }}
          />
        ))}

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
        hint="←→ move · Space fire · P pause; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}