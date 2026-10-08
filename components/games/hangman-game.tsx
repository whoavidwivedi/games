"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { Button } from "@/components/ui/button"
import { useGameKeys } from "@/hooks/use-game-keys"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import { initialState, reducer, type Status } from "@/lib/game-hangman"
import { cn } from "@/lib/utils"

const highScoreStore = createHighScore("hangman_best")

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("")

// "over" and "won" texts are dynamic (they include the hidden word).
const OVERLAY_TEXT: Record<Exclude<Status, "over" | "won">, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
}

const HELP_STEPS = [
  "Guess one letter at a time from the A–Z pad or your keyboard.",
  "Each wrong guess draws one more part of the hanged man.",
  "Six wrong guesses end the round; guessing the word keeps your streak alive.",
  "P pauses; R restarts.",
]

/** The figure's six parts, revealed one per wrong guess. */
const PARTS = [
  <circle key="head" cx={42} cy={23} r={5} />,
  <path key="body" d="M42 28v14" />,
  <path key="arm-l" d="M42 33l-9 6" />,
  <path key="arm-r" d="M42 33l9 6" />,
  <path key="leg-l" d="M42 42l-8 11" />,
  <path key="leg-r" d="M42 42l8 11" />,
]

export function HangmanGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.streak)

  useEffect(() => {
    highScoreStore.save(state.streak) // save() no-ops when not a new best
  }, [state.streak])

  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "newGame" }),
    onKey: (key) => {
      if (/^[a-z]$/.test(key)) {
        if (state.status === "running") send({ type: "guess", letter: key })
        return true
      }
    },
  })

  const overlayText =
    state.status === "over"
      ? `Hanged! The word was ${state.word}`
      : state.status === "won"
        ? `Solved! ${state.word}`
        : OVERLAY_TEXT[state.status]

  const playAgain = state.status === "over" || state.status === "won"

  return (
    <GameScreen
      style={accentVars("Hangman")}
    >
      <GameHeader
        title="Hangman"
        badges={
          <>
            <PixelScore label="Score" value={state.streak} digits={2} />
            <PixelScore
              label="Best"
              value={best}
              digits={2}
              variant="outline"
            />
            <PixelScore label="Wrong" value={state.wrong} digits={1} />
          </>
        }
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      {/* The stack (slots + gallows + keyboard) defines the height, so the
          word boxes and keys never resize between rounds. */}
      <div className="game-board relative mx-auto shrink-0">
        <div className="flex flex-col gap-2 rounded-none border bg-muted p-3">
          <div className="flex h-10 items-center justify-center gap-1.5">
            {state.word.split("").map((letter, index) => {
              const revealed = state.guessed.includes(letter)
              return (
                <div
                  key={`${letter}-${index}`}
                  className="flex h-10 w-7 items-center justify-center border-b-2 border-[var(--accent-soft)]"
                >
                  <span
                    className={cn(
                      "text-xl font-semibold",
                      revealed ? "text-[var(--accent)]" : "opacity-0"
                    )}
                  >
                    {letter}
                  </span>
                </div>
              )
            })}
          </div>

          <svg viewBox="0 0 64 64" aria-hidden="true" className="mx-auto h-16 w-16">
            {/* Standing frame, always visible. */}
            <g
              stroke="var(--foreground)"
              strokeWidth={2}
              fill="none"
              opacity={0.35}
            >
              <path d="M12 58h40" />
              <path d="M16 58V8" />
              <path d="M16 8h26" />
              <path d="M42 8v10" />
            </g>
            {/* The hanged figure, one part per wrong guess. */}
            <g
              stroke="var(--accent)"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            >
              {PARTS.slice(0, state.wrong)}
            </g>
          </svg>

          <div className="grid grid-cols-7 gap-1">
            {ALPHABET.map((letter) => {
              const guessed = state.guessed.includes(letter)
              const correct = guessed && state.word.includes(letter)
              return (
                <Button
                  key={letter}
                  size="xs"
                  disabled={guessed}
                  className={cn(
                    "h-8 rounded-none p-0",
                    correct && "text-[var(--accent)]"
                  )}
                  onClick={() => send({ type: "guess", letter })}
                >
                  {letter}
                </Button>
              )
            })}
          </div>
        </div>

        <StatusOverlay
          status={state.status}
          label={overlayText}
          onToggle={() =>
            send(playAgain ? { type: "newGame" } : { type: "toggle" })
          }
        />

        {helpOpen && (
          <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <GameFooter
        status={state.status}
        hint="Tap letters or type · P pauses; R restarts"
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}