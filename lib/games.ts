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
    description: "Play against a friend locally.",
    href: "/games/tic-tac-toe",
    waveColor: [0.055, 0.647, 0.914],
  },
  {
    title: "2048",
    description: "Slide tiles to reach 2048.",
    href: "/games/2048",
    waveColor: [0.961, 0.62, 0.043],
  },
  {
    title: "Minesweeper",
    description: "Clear the board without hitting mines.",
    href: "/games/minesweeper",
    waveColor: [0.957, 0.247, 0.369],
  },
  {
    title: "Tetris",
    description: "Stack and clear falling lines of blocks.",
    href: "/games/tetris",
    waveColor: [0.545, 0.361, 0.965],
  },
  {
    title: "Pong",
    description: "Rally the ball past your opponent.",
    href: "/games/pong",
    waveColor: [0.024, 0.714, 0.831],
  },
  {
    title: "Breakout",
    description: "Smash every brick with a bouncing ball.",
    href: "/games/breakout",
    waveColor: [0.976, 0.451, 0.086],
  },
  {
    title: "Flappy",
    description: "Tap to fly through the gaps in the pipes.",
    href: "/games/flappy",
    waveColor: [0.231, 0.51, 0.965],
  },
  {
    title: "Memory Match",
    description: "Find all the pairs hidden on the board.",
    href: "/games/memory-match",
    waveColor: [0.851, 0.275, 0.937],
  },
  {
    title: "Simon",
    description: "Repeat the growing sequence of colours.",
    href: "/games/simon",
    waveColor: [0.388, 0.4, 0.945],
  },
  {
    title: "Connect Four",
    description: "Line up four discs before your rival does.",
    href: "/games/connect-four",
    waveColor: [0.937, 0.267, 0.267],
  },
  {
    title: "Whack-a-Mole",
    description: "Pop the moles before they duck away.",
    href: "/games/whack-a-mole",
    waveColor: [0.918, 0.702, 0.031],
  },
  {
    title: "Space Invaders",
    description: "Shoot down the descending alien formation.",
    href: "/games/space-invaders",
    waveColor: [0.659, 0.333, 0.969],
  },
  {
    title: "Frogger",
    description: "Hop across the road and river unharmed.",
    href: "/games/frogger",
    waveColor: [0.518, 0.8, 0.086],
  },
  {
    title: "Hangman",
    description: "Guess the word one letter at a time.",
    href: "/games/hangman",
    waveColor: [0.078, 0.722, 0.651],
  },
  {
    title: "Sudoku",
    description: "Fill the grid so every row, column and box fits.",
    href: "/games/sudoku",
    waveColor: [0.443, 0.443, 0.478],
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
