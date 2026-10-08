import type { ComponentType } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SnakeGame } from "@/components/games/snake-game"
import { TicTacToeGame } from "@/components/games/tic-tac-toe-game"
import { GAMES } from "@/lib/games"

// The playable games by URL slug. Titles come from the GAMES entries (the same
// strings the game components use for accentVars), so a route's label and
// accent colour always match its card.
const GAME_COMPONENTS: Record<string, ComponentType> = {
  snake: SnakeGame,
  "tic-tac-toe": TicTacToeGame,
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