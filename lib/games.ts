import type { CSSProperties } from "react"

export interface Game {
  title: string
  description: string
  /** Omit it to mark the game as not playable yet. */
  href?: string
  /** RGB (0–1) colour used for the card's dithered cover. */
  waveColor: [number, number, number]
}

export const GAMES: Game[] = [
  {
    title: "Snake",
    description: "Eat food, grow longer, don't hit the walls or yourself.",
    href: "/games/snake",
    waveColor: [0.063, 0.725, 0.506],
  },
  {
    title: "Tic-Tac-Toe",
    description: "Play a friend or a system opponent that never loses.",
    href: "/games/tic-tac-toe",
    waveColor: [0.055, 0.647, 0.914],
  },
]

/** The colour a game uses on its card, looked up by title. */
function gameColor(title: string): [number, number, number] {
  return GAMES.find((game) => game.title === title)?.waveColor ?? [0.5, 0.5, 0.5]
}

/** Render a 0–1 RGB triple as a CSS colour, optionally translucent. */
function rgbCss(
  [r, g, b]: [number, number, number],
  alpha = 1
): string {
  const to = (value: number) => Math.round(value * 255)
  return `rgb(${to(r)} ${to(g)} ${to(b)} / ${alpha})`
}

/**
 * Custom properties that carry a game's card colour into the game itself, so
 * the board, pieces and accents match the tile the player tapped.
 */
export function accentVars(title: string): CSSProperties {
  const color = gameColor(title)
  return {
    "--accent": rgbCss(color),
    "--accent-soft": rgbCss(color, 0.55),
    "--accent-pipe": rgbCss(color, 0.85),
    "--food": "rgb(239 68 68)",
    "--bonus": "rgb(250 204 21)",
  } as CSSProperties
}
