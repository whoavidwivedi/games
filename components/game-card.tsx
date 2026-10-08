"use client"

import Link from "next/link"

import { GameCover } from "@/components/game-cover"
import { Button } from "@/components/ui/button"
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
 * A game tile. Only the heart and the Play button are interactive — tapping
 * anywhere else on the card does nothing. The cover's dither is a static
 * frozen field. Coming-soon tiles stay dimmed and show no Play button.
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
      <GameCover waveColor={waveColor} className="aspect-[21/10]">
        {/* Coming-soon games can't be favourited yet, so no heart. */}
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
          <Button
            render={<Link href={href} />}
            nativeButton={false}
            className="rounded-full"
          >
            Play
          </Button>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            Coming soon
          </span>
        )}
      </CardContent>
    </Card>
  )
}