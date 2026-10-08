/**
 * A blue pixel-ish bird, drawn with plain divs so `next/og` (satori) can render
 * it inside an ImageResponse. Shared by the Open Graph, Twitter and icon
 * images so the bird stays identical everywhere. `scale` multiplies every
 * dimension, keeping the intrinsic 300x260 proportions.
 */
export function OgBird({ scale = 1 }: { scale?: number }) {
  const px = (n: number) => Math.round(n * scale)

  return (
    <div style={{ position: "relative", display: "flex", width: px(300), height: px(260) }}>
      {/* wing */}
      <div
        style={{
          position: "absolute",
          left: px(18),
          top: px(120),
          width: px(120),
          height: px(86),
          borderRadius: "50%",
          background: "#1d4ed8",
          transform: "rotate(-18deg)",
          display: "flex",
        }}
      />
      {/* body */}
      <div
        style={{
          position: "absolute",
          left: px(40),
          top: px(18),
          width: px(225),
          height: px(224),
          borderRadius: "50%",
          background: "linear-gradient(135deg,#7dd3fc,#2563eb)",
          display: "flex",
        }}
      />
      {/* beak */}
      <div
        style={{
          position: "absolute",
          left: px(232),
          top: px(140),
          width: px(62),
          height: px(42),
          borderRadius: px(14),
          background: "#f59e0b",
          transform: "rotate(6deg)",
          display: "flex",
        }}
      />
      {/* eye */}
      <div
        style={{
          position: "absolute",
          left: px(188),
          top: px(52),
          width: px(80),
          height: px(80),
          borderRadius: "50%",
          background: "#f8fafc",
          display: "flex",
        }}
      />
      {/* pupil */}
      <div
        style={{
          position: "absolute",
          left: px(212),
          top: px(76),
          width: px(36),
          height: px(36),
          borderRadius: "50%",
          background: "#0b1220",
          display: "flex",
        }}
      />
    </div>
  )
}