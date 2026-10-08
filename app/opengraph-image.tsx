import { ImageResponse } from "next/og"

import { OgDither } from "@/components/og-dither"

export const alt = "Arcade — Snake, Tic-Tac-Toe and more, in your browser"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** A dithered-blue field with the wordmark — no other art. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg,#070b16,#0e2138 70%)",
        }}
      >
        <OgDither width={size.width} height={size.height} spacing={22} dot={4} />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 128,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1,
              color: "#ffffff",
            }}
          >
            ARCADE
          </div>
          <div style={{ display: "flex", fontSize: 36, color: "#93c5fd" }}>
            Classic games, right in your browser
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 30,
            color: "#cbd5e1",
          }}
        >
          <div style={{ display: "flex" }}>Snake</div>
          <div
            style={{
              display: "flex",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#3b82f6",
            }}
          />
          <div style={{ display: "flex" }}>Tic-Tac-Toe</div>
          <div
            style={{
              display: "flex",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#3b82f6",
            }}
          />
          <div style={{ display: "flex" }}>More coming soon</div>
        </div>
      </div>
    ),
    { ...size }
  )
}