"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"
import type { CSSProperties } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useSwipe } from "@/hooks/use-swipe"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import {
  INITIAL_STATE,
  SIZE,
  gameReducer,
  tileBackground,
  tileText,
  type Dir,
  type Status,
} from "@/lib/game-2048"
import { cn } from "@/lib/utils"

const highScoreStore = createHighScore("2048_best")

const KEY_DIRS: Record<string, Dir> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
}

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  won: "2048 reached!",
  over: "No more moves",
}

/** Per-digit delay from the number-pop-in snippet: the last two digits
 * trail so multi-digit numbers roll in; a lone digit never waits. */
function digitStagger(position: number, count: number): number | undefined {
  if (count < 2) return undefined
  if (position === count - 2) return 1
  if (position === count - 1) return 2
  return undefined
}

/** 2048 has no pause: `running` only exists to complete the record (the
 *  footer never shows a button for it, and the overlay is hidden while a
 *  round runs), and the overlay's own label comes from this map. */
const PRIMARY_LABEL: Record<Status, string> = {
  idle: "Play",
  running: "Pause",
  won: "Keep playing",
  over: "Play again",
}

const HELP_STEPS = [
  "Swipe or use the arrow keys / WASD to slide every tile.",
  "Tiles that share a number merge into their sum.",
  "Reach 2048 to win, then keep going for a higher score.",
  "R starts a new game.",
]

/** Layout math shared by the static cells and the sliding tiles, so both
 * always agree on where a cell is no matter the board size. */
const BOARD_VARS = {
  "--pad": "8px",
  "--gap": "8px",
  "--cell": "calc((min(100cqw, 100cqh) - 2 * var(--pad) - 3 * var(--gap)) / 4)",
} as CSSProperties

export function Game2048() {
  const [state, send] = useReducer(gameReducer, INITIAL_STATE)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.score)
  // Fires while the finger is still moving, so swipes respond immediately.
  const swipe = useSwipe((dir) => send({ type: "move", dir }))
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    highScoreStore.save(state.score) // save() no-ops when not a new best
  }, [state.score])

  // No pause in 2048, so space/p/enter (and arrow keys) are game moves, not
  // toggles: intercept them all so the hook's toggle defaults never fire.
  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "newGame" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key, event) => {
      const dir = KEY_DIRS[key]

      if (dir) {
        event.preventDefault()
        send({ type: "move", dir })
        return true
      }

      if (key === " " || key === "p" || key === "enter") {
        // Space/Enter fire a focused control themselves (Space on keyup), so
        // handling them here too would press it twice.
        const target = event.target
        const onControl =
          target instanceof HTMLElement &&
          target.closest("button, a, [role='button']") !== null

        if (!onControl) {
          event.preventDefault()
          if (state.status === "won") send({ type: "keepPlaying" })
          else if (state.status !== "running") send({ type: "newGame" })
        }
        return true
      }
    },
  })

  return (
    <GameScreen
      style={accentVars("2048")}
      {...(helpOpen ? {} : swipe)}
    >
      <GameHeader
        title="2048"
        badges={
          <>
            <PixelScore label="Score" value={state.score} digits={5} />
            <PixelScore label="Best" value={best} digits={5} variant="outline" />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* Sized against the screen (.game-board reserves the fixed chrome);
          the column centres header, board and footer as one group, so they
          hug the board and any slack lands at the screen edges. The board is
          also a size container so --cell's cq units track the board itself. */}
      <div
        className="game-board [container-type:size] relative mx-auto aspect-square shrink-0"
        style={BOARD_VARS}
      >
        {/* Static empty cells: the fixed baseline the tiles slide over. */}
        <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-[var(--gap)] rounded-none border bg-muted p-[var(--pad)]">
          {Array.from({ length: SIZE * SIZE }, (_, index) => (
            <div key={index} className="rounded-none bg-background" />
          ))}
        </div>

        {/* Tiles are placed with transform only: identity (id) keeps the
              same DOM node alive across moves, so the transform change tweens
              into a slide instead of a jump. */}
        {state.tiles.map((tile) => (
          <div
            key={tile.id}
            className={cn(
              "absolute top-0 left-0 flex h-[var(--cell)] w-[var(--cell)] items-center justify-center rounded-none",
              "transition-transform duration-150 ease-out motion-reduce:transition-none",
              tile.merged && "z-10" // sits above the remnants sliding under it
            )}
            style={{
              backgroundColor: tileBackground(tile.value),
              transform: `translate(calc(var(--pad) + ${tile.col} * (var(--cell) + var(--gap))), calc(var(--pad) + ${tile.row} * (var(--cell) + var(--gap))))`,
            } as CSSProperties}
          >
            <span
              // Remounting when the value changes is what replays the
              // pop-in: merges get `is-animating`, spawns don't.
              key={tile.value}
              className={cn(
                "t-digit-group font-semibold",
                tile.merged && "is-animating",
                tileText(tile.value)
              )}
            >
              {String(tile.value)
                .split("")
                .map((char, position, chars) => (
                  <span
                    key={position}
                    className="t-digit"
                    data-stagger={digitStagger(position, chars.length)}
                  >
                    {char}
                  </span>
                ))}
            </span>
          </div>
        ))}

        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          actionLabel={PRIMARY_LABEL[state.status]}
          onToggle={() =>
            send(
              state.status === "won"
                ? { type: "keepPlaying" }
                : { type: "newGame" }
            )
          }
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
        hint="Arrows / WASD or swipe"
        onToggle={() =>
          send(
            state.status === "won"
              ? { type: "keepPlaying" }
              : { type: "newGame" }
          )
        }
        hidePrimaryWhenRunning
      />
    </GameScreen>
  )
}