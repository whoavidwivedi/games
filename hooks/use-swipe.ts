"use client"

import { useEffect, useRef } from "react"
import type { TouchEvent } from "react"

export type SwipeDirection = "up" | "down" | "left" | "right"

/** Minimum distance in px before a gesture counts as a swipe. */
const THRESHOLD = 20

function directionOf(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left"
  return dy > 0 ? "down" : "up"
}

/**
 * Live swipe detection: fires the moment the finger crosses the threshold
 * rather than when it lifts, so controls react instantly. At most one swipe
 * per gesture, re-armed when the next finger lands.
 */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const onSwipeRef = useRef(onSwipe)

  useEffect(() => {
    onSwipeRef.current = onSwipe
  })

  const startRef = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const fire = (dx: number, dy: number) => {
    if (Math.hypot(dx, dy) < THRESHOLD) return
    firedRef.current = true
    onSwipeRef.current(directionOf(dx, dy))
  }

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY }
    firedRef.current = false
  }

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = startRef.current
    if (!start || firedRef.current) return
    const touch = event.touches[0]
    fire(touch.clientX - start.x, touch.clientY - start.y)
  }

  // Fallback for browsers that skip touchmove events.
  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = startRef.current
    startRef.current = null
    if (!start || firedRef.current) return
    const touch = event.changedTouches[0]
    fire(touch.clientX - start.x, touch.clientY - start.y)
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
