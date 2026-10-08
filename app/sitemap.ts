import type { MetadataRoute } from "next"

import { GAMES } from "@/lib/games"
import { SITE_URL } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const games = GAMES.filter((game) => game.href).map((game) => ({
    url: `${SITE_URL}${game.href}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }))

  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/favourites`, changeFrequency: "monthly", priority: 0.6 },
    ...games,
  ]
}