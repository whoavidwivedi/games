"use client"

import { useEffect, useRef } from "react"

/**
 * The tick loops every game repeats: run only while `status` is "running".
 * The callback lives in a ref so it can read the latest dispatch without
 * restarting the loop.
 */

/** Fixed-cadence tick (ms), e.g. snake's step or tetris gravity. */
export function useGameTick(
  status: string,
  ms: number,
  tick: () => void
) {
  const saved = useRef(tick)
  useEffect(() => {
    saved.current = tick
  })

  useEffect(() => {
    if (status !== "running") return
    const id = window.setInterval(() => saved.current(), ms)
    return () => window.clearInterval(id)
  }, [status, ms])
}

/**
 * Per-frame tick; dt (seconds) travels as an action payload so the reducer
 * stays pure. rAF keeps motion smooth and independent of frame rate.
 */
export function useGameFrame(
  status: string,
  tick: (dt: number) => void
) {
  const saved = useRef(tick)
  useEffect(() => {
    saved.current = tick
  })

  useEffect(() => {
    if (status !== "running") return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      saved.current((now - last) / 1000)
      last = now
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [status])
}
