/**
 * A dithered dot field for `next/og` images. Satori stretches gradients
 * instead of tiling them, and its `flex-wrap` drops everything past the first
 * row on large grids — so we lay the dots out as explicit flex rows, which
 * gives the field an exact height.
 */
export function OgDither({
  width,
  height,
  spacing,
  dot,
  color = "#60a5fa",
  opacity = 0.5,
}: {
  width: number
  height: number
  spacing: number
  dot: number
  color?: string
  opacity?: number
}) {
  const cols = Math.floor(width / spacing)
  const rows = Math.floor(height / spacing)
  const margin = (spacing - dot) / 2

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          style={{ display: "flex", flexDirection: "row", height: spacing }}
        >
          {Array.from({ length: cols }, (_, col) => (
            <div
              key={col}
              style={{
                width: dot,
                height: dot,
                margin,
                borderRadius: "50%",
                background: color,
                opacity,
                display: "flex",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}