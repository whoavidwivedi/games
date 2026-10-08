import { ImageResponse } from "next/og"

import { OgBird } from "@/components/og-bird"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1220",
        }}
      >
        <OgBird scale={0.2} />
      </div>
    ),
    { ...size }
  )
}