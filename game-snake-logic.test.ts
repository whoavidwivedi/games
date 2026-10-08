import { describe, expect, test } from "bun:test"

import { SIZE, START, initialState, reducer, type State } from "@/lib/game-snake"

/** A snake game, easily overridden. */
function make(overrides: Partial<State> = {}): State {
  return { ...initialState, ...overrides }
}

describe("snake turns", () => {
  test("prevents instant reversals", () => {
    const running = make({ snake: START, status: "running" })
    const leftTurn = reducer(running, { type: "turn", dir: "left" })
    expect(leftTurn.pendingDir).toBe("right")

    const next = reducer({ ...leftTurn, dir: "right", pendingDir: "right" }, {
      type: "turn",
      dir: "up",
    })
    expect(next.pendingDir).toBe("up")
  })

  test("keeps the current direction when the player tries to reverse into a wall", () => {
    const state = make({
      status: "running",
      snake: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }],
      dir: "right",
      pendingDir: "right",
    })

    const next = reducer(state, { type: "turn", dir: "left" })
    expect(next.pendingDir).toBe("right")
  })
})

describe("snake tick", () => {
  test("moves forward and grows when it eats food", () => {
    const state = make({
      status: "running",
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      food: { x: 6, y: 5 },
      dir: "right",
      pendingDir: "right",
    })

    const next = reducer(state, { type: "tick" })
    expect(next.snake[0]).toEqual({ x: 6, y: 5 })
    expect(next.snake).toHaveLength(4)
    expect(next.score).toBe(1)
  })

  test("ends the game on wall collisions", () => {
    const state = make({
      status: "running",
      snake: [
        { x: 0, y: 10 },
        { x: 1, y: 10 },
        { x: 2, y: 10 },
      ],
      dir: "left",
      pendingDir: "left",
      food: { x: 14, y: 10 },
    })

    const next = reducer(state, { type: "tick" })
    expect(next.status).toBe("over")
  })

  test("ends the game on self collision", () => {
    const state = make({
      status: "running",
      // Head (5,5) moves up into (5,4) — its own neck (the tail at (4,3)
      // vacates, but (5,4) is still body).
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 5, y: 3 },
        { x: 4, y: 3 },
      ],
      dir: "up",
      pendingDir: "up",
      food: { x: 14, y: 10 },
    })

    const next = reducer(state, { type: "tick" })
    expect(next.status).toBe("over")
  })

  test("ignores ticks when the run is not active", () => {
    const state = make({ status: "paused" })
    expect(reducer(state, { type: "tick" })).toEqual(state)
  })
})

describe("snake lifecycle", () => {
  test("toggle starts a fresh run when idle and pauses/resumes while active", () => {
    expect(reducer(initialState, { type: "toggle" }).status).toBe("running")
    expect(reducer(make({ status: "running" }), { type: "toggle" }).status).toBe(
      "paused"
    )
    expect(reducer(make({ status: "paused" }), { type: "toggle" }).status).toBe(
      "running"
    )
  })

  test("restart always starts a fresh game", () => {
    const next = reducer(make({ score: 8, status: "paused" }), { type: "restart" })
    expect(next.status).toBe("running")
    expect(next.score).toBe(0)
    expect(next.snake.length).toBe(3)
    expect(next.snake.every((segment) => segment.x >= 0 && segment.x < SIZE && segment.y >= 0 && segment.y < SIZE)).toBe(true)
  })
})

describe("snake no-ops", () => {
  test("returns the same reference when the action does not apply", () => {
    const paused = make({ status: "paused" })
    expect(reducer(paused, { type: "tick" })).toBe(paused)
    expect(reducer(paused, { type: "turn", dir: "up" })).toBe(paused)
    expect(reducer(initialState, { type: "tick" })).toBe(initialState)
  })
})

describe("snake full run", () => {
  test("a straight run ends at the wall", () => {
    let state = reducer(initialState, { type: "toggle" })
    for (let i = 0; i < SIZE * 2 && state.status === "running"; i++) {
      state = reducer(state, { type: "tick" })
    }
    expect(state.status).toBe("over")
  })
})