import type { ComponentType } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Game2048 } from "@/components/games/game-2048"
import { BreakoutGame } from "@/components/games/breakout-game"
import { ConnectFourGame } from "@/components/games/connect-four-game"
import { FlappyGame } from "@/components/games/flappy-game"
import { FroggerGame } from "@/components/games/frogger-game"
import { HangmanGame } from "@/components/games/hangman-game"
import { MemoryMatchGame } from "@/components/games/memory-match-game"
import { MinesweeperGame } from "@/components/games/minesweeper-game"
import { PongGame } from "@/components/games/pong-game"
import { SimonGame } from "@/components/games/simon-game"
import { SnakeGame } from "@/components/games/snake-game"
import { SpaceInvadersGame } from "@/components/games/space-invaders-game"
import { SudokuGame } from "@/components/games/sudoku-game"
import { TetrisGame } from "@/components/games/tetris-game"
import { TicTacToeGame } from "@/components/games/tic-tac-toe-game"
import { WhackAMoleGame } from "@/components/games/whack-a-mole-game"
import { GAMES } from "@/lib/games"

// The 16 playable games by URL slug. Titles come from the GAMES entries (the
// same strings the game components use for accentVars), so a route's label
// and accent colour always match its card.
const GAME_COMPONENTS: Record<string, ComponentType> = {
  "2048": Game2048,
  breakout: BreakoutGame,
  "connect-four": ConnectFourGame,
  flappy: FlappyGame,
  frogger: FroggerGame,
  hangman: HangmanGame,
  "memory-match": MemoryMatchGame,
  minesweeper: MinesweeperGame,
  pong: PongGame,
  simon: SimonGame,
  snake: SnakeGame,
  "space-invaders": SpaceInvadersGame,
  sudoku: SudokuGame,
  tetris: TetrisGame,
  "tic-tac-toe": TicTacToeGame,
  "whack-a-mole": WhackAMoleGame,
}

const slugOf = (href: string) => href.replace("/games/", "")
const titleOf = (slug: string) =>
  GAMES.find((game) => game.href === `/games/${slug}`)?.title

/** Every href in GAMES keeps its URL; anything else 404s. */
export const dynamicParams = false

export function generateStaticParams() {
  return GAMES.flatMap(({ href }) =>
    href ? [{ game: slugOf(href) }] : []
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>
}): Promise<Metadata> {
  const { game } = await params
  const title = titleOf(game)
  if (!title) notFound()
  return { title }
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ game: string }>
}) {
  const { game } = await params
  const Page = GAME_COMPONENTS[game]
  if (!Page) notFound()
  return <Page />
}