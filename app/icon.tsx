import { ImageResponse } from "next/og"

import { OgBird } from "@/components/og-bird"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

/** The bird on the same dithered-blue field as the Open Graph card. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#050912,#0f2b52)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(rgba(96,165,250,0.5) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        />
        <OgBird scale={0.2} />
      </div>
    ),
    { ...size }
  )
}