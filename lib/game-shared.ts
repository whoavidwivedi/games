/** Shared game-logic helpers, hoisted out of the 16 per-game reducers. */

export type Dir = "up" | "down" | "left" | "right"

/** Clamp `value` to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Clamp a tick delta so a backgrounded tab cannot teleport a game. */
export function clampDt(dt: number): number {
  return clamp(dt, 0, 0.05)
}

/**
 * The 5-line pause/resume toggle shared by the reducers: running→paused,
 * paused→running, anything else starts a fresh game via `fresh()`.
 */
export function toggle<S extends { status: string }>(
  state: S,
  fresh: () => S
): S {
  if (state.status === "running") return { ...state, status: "paused" }
  if (state.status === "paused") return { ...state, status: "running" }
  return fresh()
}