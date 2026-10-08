import { cn } from "@/lib/utils"

/**
 * The bird for Flappy, drawn as a smooth little vector sprite (same shape
 * language as the original, no pixel grid). The wing is a separate shape
 * that flaps around its left hinge while flying (see .fb-wing in
 * globals.css).
 */
export function PixelBird({ flying }: { flying: boolean }) {
  return (
    <svg viewBox="0 0 12 9" aria-hidden="true" className="h-full w-full">
      {/* Body */}
      <ellipse cx={4.2} cy={4.6} rx={3.9} ry={3.4} fill="var(--accent)" />
      {/* Beak: dark, pointing right */}
      <path d="M7.6 3.6 L11 4.6 L7.6 5.4 Z" fill="var(--foreground)" />
      {/* Eye */}
      <circle cx={6.5} cy={3.2} r={0.6} fill="var(--foreground)" />
      {/* Wing: sits over the body, flaps while flying */}
      <ellipse
        className={cn("fb-wing", flying && "fb-flap")}
        cx={3.3}
        cy={5.3}
        rx={2.3}
        ry={1.4}
        fill="var(--accent-soft)"
      />
    </svg>
  )
}