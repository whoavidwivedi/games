import { afterEach, beforeEach, expect } from "bun:test"

/** A mulberry32 PRNG, from the per-file copies removed from the tests. */
export function seedRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stub Math.random with a seeded generator for every test in the file,
 *  restoring the original afterwards. Returns the generator for direct use. */
export function stubMathRandom(seed = 0x2f6e2b1): () => number {
  const nextRandom = seedRandom(seed)
  let original: typeof Math.random
  beforeEach(() => {
    original = Math.random
    Math.random = nextRandom
  })
  afterEach(() => {
    Math.random = original
  })
  return nextRandom
}

/** The shared toggle lifecycle: idle → running → paused → running, and `over`
 *  restarts. Returns the first running state so files can add game-specific
 *  assertions on it. */
export function toggleLifecycle<State extends { status: string }>(
  reducer: (state: State, action: { type: "toggle" }) => State,
  initial: State
): State {
  expect(initial.status).toBe("idle")
  const started = reducer(initial, { type: "toggle" })
  expect(started.status).toBe("running")
  expect(reducer(started, { type: "toggle" }).status).toBe("paused")
  expect(reducer({ ...started, status: "paused" }, { type: "toggle" }).status).toBe("running")
  expect(reducer({ ...started, status: "over" }, { type: "toggle" }).status).toBe("running")
  return started
}

/** A zero-dt tick must return the same state reference. */
export function zeroDtTickNoOp<State>(
  reducer: (state: State, action: { type: "tick"; dt: number }) => State,
  state: State
): void {
  expect(reducer(state, { type: "tick", dt: 0 })).toBe(state)
}