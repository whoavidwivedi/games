"use client"

import type { ReactNode } from "react"

import Dither from "@/components/dither"
import { cn } from "@/lib/utils"

/** waveColor is 0–1; dim it into the backdrop the waves drift against. */
function backdrop([r, g, b]: [number, number, number]): [number, number, number] {
  return [r * 0.12, g * 0.1, b * 0.16]
}

/**
 * A game card's cover: the React Bits dithered-noise shader running in the
 * game's colour over a dark tint of it. The field is rendered once and
 * frozen — it keeps a single crisp pixel look and never animates or changes,
 * hovered or not.
 */
export function GameCover({
  waveColor,
  className,
  children,
}: {
  /** The game's card colour as 0–1 RGB. */
  waveColor: [number, number, number]
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Dither
        waveColor={waveColor}
        backgroundColor={backdrop(waveColor)}
        colorNum={4}
        pixelSize={3}
        waveFrequency={3}
        waveAmplitude={0.24}
        className="absolute inset-0"
      />
      <div className="relative">{children}</div>
    </div>
  )
}