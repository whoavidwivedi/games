"use client"

import { usePathname } from "next/navigation"

import { GameCard } from "@/components/game-card"
import type { Game } from "@/lib/games"

/**
 * The card grid on both shell pages. Keyed by the route so every hop
 * between Games and Favourites remounts it and replays the entrance — the
 * swap reads the same in both directions instead of only the one that
 * happens to mount fresh.
 */
export function GamesSection({ games }: { games: Game[] }) {
  const pathname = usePathname()

  return (
    <section key={pathname} className="shell-in flex flex-col gap-3">
      <div className="grid auto-rows-max grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {games.map((game) => (
          <GameCard key={game.title} {...game} />
        ))}
      </div>
    </section>
  )
}
