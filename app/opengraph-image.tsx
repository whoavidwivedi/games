import { ImageResponse } from "next/og"

import { OgBird } from "@/components/og-bird"

export const alt = "Arcade — Snake, Tic-Tac-Toe and more, in your browser"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

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
        {/* Dither: a blue dot grid across the whole canvas. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(rgba(96,165,250,0.45) 1.5px, transparent 1.5px)",
            backgroundSize: "14px 14px",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                display: "flex",
                fontSize: 112,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1,
                color: "#ffffff",
              }}
            >
              ARCADE
            </div>
            <div style={{ display: "flex", fontSize: 34, color: "#93c5fd" }}>
              Classic games, right in your browser
            </div>
          </div>
          <OgBird scale={1.25} />
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