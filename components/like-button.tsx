"use client"

import {
  type CSSProperties,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"
import { RiHeartFill } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { favorites, gameId } from "@/lib/favorites"
import { cn } from "@/lib/utils"

const PARTICLES = 8
const BURST_MS = 850

/**
 * Eight dots sprayed evenly around the heart, each with a little jitter so
 * no two bursts look the same. The vectors ride in as CSS custom
 * properties, which the t-like keyframes read per particle.
 */
function spray(): Record<string, string>[] {
  return Array.from({ length: PARTICLES }, (_, index) => {
    const angle =
      (index / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
    const distance = 14 + Math.random() * 10
    return {
      "--px": `${(Math.cos(angle) * distance).toFixed(1)}px`,
      "--py": `${(Math.sin(angle) * distance).toFixed(1)}px`,
      "--pdur": `${Math.round(450 + Math.random() * 200)}ms`,
      "--pdelay": `${Math.round(Math.random() * 100)}ms`,
      "--p-end-scale": (0.4 + Math.random() * 0.4).toFixed(2),
      "--psize": (0.7 + Math.random() * 0.7).toFixed(2),
    }
  })
}

/**
 * Heart button for a game card. Toggling fills the heart and sprinkles the
 * t-like celebration; the store keeps every heart (and the favourites
 * section) in sync across the page.
 */
export function LikeButton({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  const ids = useSyncExternalStore(
    favorites.subscribe,
    favorites.read,
    favorites.readOnServer
  )
  const liked = ids.includes(gameId(title))

  // is-init holds the pop back until a real click: a stored favourite
  // re-fills right after hydration, which would replay the pop on load.
  const [touched, setTouched] = useState(false)
  // The burst id remounts the particle dots so a fresh like restarts them.
  const [burst, setBurst] = useState<{
    id: number
    dots: Record<string, string>[]
  } | null>(null)

  useEffect(() => {
    if (!burst) return
    const timer = setTimeout(() => setBurst(null), BURST_MS)
    return () => clearTimeout(timer)
  }, [burst])

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      data-liked={liked ? "true" : "false"}
      aria-pressed={liked}
      aria-label={
        liked ? `Remove ${title} from favourites` : `Add ${title} to favourites`
      }
      className={cn(
        "t-like relative text-muted-foreground",
        touched && "is-init",
        burst && "is-bursting",
        className
      )}
      onClick={() => {
        setTouched(true)
        favorites.toggle(gameId(title))
        if (!liked) setBurst({ id: Date.now(), dots: spray() })
      }}
    >
      <span className="t-like-icon">
        <RiHeartFill className="t-like-heart stroke-2" />
      </span>
      {burst && (
        <span className="t-like-particles" key={burst.id}>
          {burst.dots.map((dot, index) => (
            <i key={index} style={dot as CSSProperties} />
          ))}
        </span>
      )}
    </Button>
  )
}