import { Badge } from "@/components/ui/badge"

/**
 * A fixed-width score readout. The number always reserves `digits` character
 * cells (zero-padded, arcade-style), so the badge never shifts or resizes
 * when the value grows a digit — the header stays rock stable from 0 to the
 * cap. tabular-nums keeps every digit the same width in the regular font.
 */
export function PixelScore({
  label,
  value,
  digits = 4,
  variant = "secondary",
}: {
  label: string
  value: number
  digits?: number
  variant?: "secondary" | "outline"
}) {
  const clamped = Math.max(0, Math.min(value, 10 ** digits - 1))
  const text = String(clamped).padStart(digits, "0")

  return (
    <Badge
      variant={variant}
      tabIndex={-1}
      aria-label={`${label} ${value}`}
      className="rounded-none"
    >
      <span className="text-[10px] font-medium opacity-60">{label}</span>
      <span className="ml-1 text-xs font-semibold tabular-nums">{text}</span>
    </Badge>
  )
}