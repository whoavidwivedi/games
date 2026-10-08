import { describe, expect, test } from "bun:test"

import { stubMathRandom, toggleLifecycle, zeroDtTickNoOp } from "@/test-helpers"

import {
  HIDE_TIME,
  HOLES,
  ROUND,
  SPAWN_MAX,
  SPAWN_MIN,
  freshGame,
  initialState,
  reducer,
  type State,
} from "@/lib/game-whack-a-mole"

stubMathRandom()

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    toggleLifecycle(reducer, initialState)
  })

  test("freshGame starts the full round with no moles", () => {
    const state = freshGame()
    expect(state.status).toBe("running")
    expect(state.timeLeft).toBe(ROUND)
    expect(state.spawnIn).toBe(SPAWN_MIN)
    expect(state.active).toHaveLength(0)
    expect(state.score).toBe(0)
  })

  test("newGame resets the clock and score", () => {
    const played = reducer(
      { ...freshGame(), score: 5, timeLeft: 1, active: [{ hole: 0, hideIn: 0.5 }] },
      { type: "newGame" }
    )
    expect(played.timeLeft).toBe(ROUND)
    expect(played.score).toBe(0)
    expect(played.active).toHaveLength(0)
  })
})

describe("no-ops outside running", () => {
  test("whack and tick are no-ops outside running, returning the same reference", () => {
    for (const status of ["idle", "paused", "over"] as const) {
      const state = { ...freshGame(), status }
      expect(reducer(state, { type: "whack", hole: 0 })).toBe(state)
      expect(reducer(state, { type: "tick", dt: 0.05 })).toBe(state)
    }
  })

  test("a zero-dt tick is a no-op", () => {
    zeroDtTickNoOp(reducer, freshGame())
  })

  test("whacking an empty hole is a no-op", () => {
    const state = freshGame()
    expect(reducer(state, { type: "whack", hole: 4 })).toBe(state)
  })
})

describe("spawning and hiding", () => {
  test("a mole pops exactly when the spawn timer runs out", () => {
    let state = reducer(initialState, { type: "toggle" })
    expect(state.spawnIn).toBe(SPAWN_MIN)
    let guard = 0
    while (state.active.length === 0 && guard < 20) {
      state = reducer(state, { type: "tick", dt: 0.05 })
      guard++
    }
    expect(state.active).toHaveLength(1)
    expect(state.active[0].hole).toBeGreaterThanOrEqual(0)
    expect(state.active[0].hole).toBeLessThan(HOLES)
  })

  test("spawns never land on an occupied hole", () => {
    const state: State = {
      ...freshGame(),
      spawnIn: 0,
      active: [{ hole: 3, hideIn: HIDE_TIME }],
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.active).toHaveLength(2)
    expect(next.active.some((mole) => mole.hole === 3)).toBe(true)
    const spawned = next.active.find((mole) => mole.hole !== 3)
    expect(spawned).toBeDefined()
    if (spawned) {
      expect([0, 1, 2, 4, 5, 6, 7, 8]).toContain(spawned.hole)
      expect(spawned.hideIn).toBeLessThanOrEqual(HIDE_TIME)
      expect(spawned.hideIn).toBeGreaterThan(HIDE_TIME - 0.06)
    }
  })

  test("moles duck when their time is up", () => {
    const state: State = {
      ...freshGame(),
      active: [{ hole: 1, hideIn: 0.03 }],
      spawnIn: 5,
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.active).toHaveLength(0)
  })

  test("the spawn timer resets into the advertised window", () => {
    let state = reducer(initialState, { type: "toggle" })
    state = reducer(state, { type: "tick", dt: 0.05 })
    for (let i = 0; i < 20; i++) {
      state = reducer(state, { type: "tick", dt: 0.05 })
      if (state.active.length > 0) break
    }
    expect(state.active.length).toBe(1)
    expect(state.spawnIn).toBeGreaterThanOrEqual(SPAWN_MIN)
    expect(state.spawnIn).toBeLessThan(SPAWN_MAX)
  })
})

describe("whacking and the clock", () => {
  test("whacking a mole scores a point and removes it; the old array survives", () => {
    const moles = [
      { hole: 0, hideIn: 0.9 },
      { hole: 2, hideIn: 0.5 },
    ]
    const state: State = { ...freshGame(), active: moles }
    const next = reducer(state, { type: "whack", hole: 2 })
    expect(next.score).toBe(1)
    expect(next.active).toEqual([moles[0]])
    expect(state.active).toEqual(moles)
  })

  test("the round ends when the clock hits zero", () => {
    const state: State = { ...freshGame(), timeLeft: 0.03 }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.status).toBe("over")
    expect(next.timeLeft).toBe(0)
  })

  test("two whacks on separate moles tally correctly and stay in range", () => {
    let state: State = {
      ...freshGame(),
      active: [
        { hole: 0, hideIn: 0.9 },
        { hole: 1, hideIn: 0.9 },
        { hole: 2, hideIn: 0.9 },
      ],
    }
    state = reducer(state, { type: "whack", hole: 0 })
    state = reducer(state, { type: "whack", hole: 2 })
    expect(state.score).toBe(2)
    expect(state.active.map((mole) => mole.hole)).toEqual([1])
  })
})