"use client"

import { useSyncExternalStore } from "react"

import { GamesSection } from "@/components/games-section"
import { favorites, gameId } from "@/lib/favorites"
import { GAMES } from "@/lib/games"

export default function FavouritesPage() {
  const favouriteIds = useSyncExternalStore(
    favorites.subscribe,
    favorites.read,
    favorites.readOnServer
  )
  // Only playable games can be favourited, so ignore any stale stored ids for
  // coming-soon games.
  const favourites = GAMES.filter(
    (game) => game.href && favouriteIds.includes(gameId(game.title))
  )

  return favourites.length > 0 ? (
    <GamesSection games={favourites} />
  ) : (
    <p className="shell-in py-10 text-center text-sm text-muted-foreground">
      No favourites yet. Tap the heart on a game to save it here.
    </p>
  )
}