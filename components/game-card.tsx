"use client"

import Link from "next/link"

import { GameCover } from "@/components/game-cover"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LikeButton } from "@/components/like-button"
import type { Game } from "@/lib/games"
import { cn } from "@/lib/utils"

/**
 * A game tile. The whole card is one link — a stretched overlay sits behind
 * the heart — so a phone can tap it anywhere, not just the Play pill, which
 * stays as the visual cue. The heart rides above the overlay (z-20) so it
 * still toggles without navigating. Tiles without an href stay dimmed.
 */
export function GameCard({ title, description, href, waveColor }: Game) {
  const comingSoon = !href

  return (
    <Card
      className={cn(
        "relative h-full gap-0 overflow-hidden rounded-2xl py-0 shadow-none",
        comingSoon && "opacity-70"
      )}
    >
      {href && (
        <Link
          href={href}
          aria-label={`Play ${title}`}
          className="absolute inset-0 z-10 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        />
      )}

      <GameCover waveColor={waveColor} className="aspect-[21/10]">
        {!comingSoon && (
          <LikeButton
            title={title}
            className="absolute top-2 right-2 z-20 bg-background hover:bg-muted dark:hover:bg-muted"
          />
        )}
      </GameCover>

      <CardHeader className="gap-1.5 px-4 pt-3.5">
        <CardTitle className="text-base font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-xs">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-auto flex items-center justify-end px-4 pt-3.5 pb-3.5">
        {href ? (
          <span className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-2.5 text-sm font-medium whitespace-nowrap text-primary-foreground">
            Play
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Coming soon</span>
        )}
      </CardContent>
    </Card>
  )
}