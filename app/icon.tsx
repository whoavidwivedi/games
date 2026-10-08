import { ImageResponse } from "next/og"

import { OgDither } from "@/components/og-dither"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

/** The same dithered-blue field as the Open Graph card, on its own. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg,#050912,#0f2b52)",
        }}
      >
        <OgDither
          width={size.width}
          height={size.height}
          spacing={8}
          dot={2.5}
          color="#7dd3fc"
          opacity={0.7}
        />
      </div>
    ),
    { ...size }
  )
}