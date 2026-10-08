import { describe, expect, test } from "bun:test"

import {
  BIRD_SIZE,
  BIRD_X,
  FLAP_V,
  GROUND_Y,
  PIPE_W,
  SPAWN_GAP,
  freshGame,
  initialState,
  reducer,
  type Pipe,
  type State,
} from "@/lib/game-flappy"

function game(overrides: Partial<State> = {}): State {
  return { ...freshGame(), ...overrides }
}

function pipe(overrides: Partial<Pipe> = {}): Pipe {
  return { id: 9, x: 60, gapTop: 30, passed: false, ...overrides }
}

const FLAP = { type: "flap" } as const
const dt = 0.01

describe("flap", () => {
  test("starts an idle game with an upward boost", () => {
    const next = reducer(initialState, FLAP)
    expect(next.status).toBe("running")
    expect(next.v).toBe(FLAP_V)
    expect(next.score).toBe(0)
  })

  test("resets the velocity while flying", () => {
    const next = reducer(game({ v: 40 }), FLAP)
    expect(next.v).toBe(FLAP_V)
  })

  test("does nothing while paused or over", () => {
    const paused = game({ status: "paused" })
    const over = game({ status: "over" })
    expect(reducer(paused, FLAP)).toBe(paused)
    expect(reducer(over, FLAP)).toBe(over)
  })
})

describe("tick", () => {
  test("gravity pulls the bird down", () => {
    const next = reducer(game({ y: 45, v: 0 }), { type: "tick", dt })
    expect(next.y).toBeGreaterThan(45)
    expect(next.v).toBeGreaterThan(0)
  })

  test("a flap lifts the bird", () => {
    const next = reducer(game({ y: 45, v: FLAP_V }), { type: "tick", dt })
    expect(next.y).toBeLessThan(45)
  })

  test("the ceiling clamps the bird and kills upward speed", () => {
    const next = reducer(game({ y: 3.2, v: -50 }), { type: "tick", dt })
    expect(next.y).toBe(BIRD_SIZE / 2)
    expect(next.v).toBe(0)
    expect(next.status).toBe("running")
  })

  test("touching the ground ends the run", () => {
    const start = game({ y: GROUND_Y - BIRD_SIZE / 2, v: 0 })
    const next = reducer(start, { type: "tick", dt })
    expect(next.status).toBe("over")
    expect(next.y).toBe(GROUND_Y - BIRD_SIZE / 2)
  })

  test("a huge frame gap is clamped", () => {
    const next = reducer(game({ y: 45, v: 0 }), { type: "tick", dt: 30 })
    expect(next.v).toBeLessThan(10)
    expect(next.y).toBeLessThan(46)
  })

  test("a pipe passing the bird scores exactly once", () => {
    const start = game({
      pipes: [pipe({ x: BIRD_X - PIPE_W - 1, gapTop: 30 })],
      y: 45,
    })
    const first = reducer(start, { type: "tick", dt })
    expect(first.score).toBe(1)
    expect(first.pipes[0].passed).toBe(true)

    const second = reducer(first, { type: "tick", dt })
    expect(second.score).toBe(1)
  })

  test("a pipe covering the bird ends the run", () => {
    const start = game({ pipes: [pipe({ x: BIRD_X - 2, gapTop: 60 })], y: 45 })
    const next = reducer(start, { type: "tick", dt })
    expect(next.status).toBe("over")
  })

  test("a new pipe spawns once the spacing is travelled", () => {
    const start = game({ pipes: [], spawnIn: 0.05 })
    const next = reducer(start, { type: "tick", dt })
    expect(next.pipes).toHaveLength(1)
    expect(next.pipes[0].x).toBe(100)
    expect(next.spawnIn).toBeGreaterThan(SPAWN_GAP - 2)
  })

  test("pipes that leave the board are removed", () => {
    const start = game({ pipes: [pipe({ x: -PIPE_W - 1, passed: true })] })
    const next = reducer(start, { type: "tick", dt })
    expect(next.pipes).toHaveLength(0)
  })

  test("ticks are ignored unless the run is active", () => {
    const idle = game({ status: "idle", y: 45 })
    expect(reducer(idle, { type: "tick", dt })).toBe(idle)
  })
})

describe("toggle and restart", () => {
  test("idle starts, running pauses, paused resumes", () => {
    expect(reducer(initialState, { type: "toggle" }).status).toBe("running")
    expect(reducer(game(), { type: "toggle" }).status).toBe("paused")
    expect(reducer(game({ status: "paused" }), { type: "toggle" }).status).toBe(
      "running"
    )
  })

  test("from game over it starts a fresh run", () => {
    const next = reducer(game({ status: "over", score: 7, y: 10 }), {
      type: "toggle",
    })
    expect(next.status).toBe("running")
    expect(next.score).toBe(0)
  })

  test("restart always starts a fresh run", () => {
    const next = reducer(game({ score: 5, status: "paused" }), {
      type: "restart",
    })
    expect(next.status).toBe("running")
    expect(next.score).toBe(0)
    expect(next.y).toBe(45)
  })
})
