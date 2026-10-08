import { describe, expect, test } from "bun:test"

import { toggleLifecycle } from "@/test-helpers"

import {
  BOARD,
  GOAL_COLS,
  MOVING_LANES,
  START,
  freshGame,
  initialState,
  offsetIndexForRow,
  reducer,
  vehicleRanges,
  type State,
} from "@/lib/game-frogger"

/** A running game, easily overridden. */
function make(overrides: Partial<State> = {}): State {
  return { ...freshGame(), ...overrides }
}

function runTicks(state: State, count: number, dt = 0.05): State {
  let next = state
  for (let i = 0; i < count; i++) next = reducer(next, { type: "tick", dt })
  return next
}

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    toggleLifecycle(reducer, initialState)
  })

  test("freshGame puts the frog at the start with empty goals", () => {
    const state = freshGame()
    expect(state.status).toBe("running")
    expect(state.frog).toEqual({ ...START })
    expect(state.goals.every((filled) => filled === false)).toBe(true)
    expect(state.score).toBe(0)
    expect(state.offsets.every((offset) => offset === 0)).toBe(true)
  })

  test("newGame resets the frog, goals, and score", () => {
    const played = make({
      frog: { x: 6, y: 2 },
      score: 30,
      goals: [true, true, false, false, false],
    })
    const fresh = reducer(played, { type: "newGame" })
    expect(fresh.frog).toEqual({ ...START })
    expect(fresh.score).toBe(0)
    expect(fresh.goals.every((filled) => filled === false)).toBe(true)
  })
})

describe("no-ops outside running", () => {
  test("hop and tick return the same reference outside running", () => {
    for (const status of ["idle", "paused", "over", "won"] as const) {
      const state = { ...freshGame(), status }
      expect(reducer(state, { type: "hop", dx: 1, dy: 0 })).toBe(state)
      expect(reducer(state, { type: "tick", dt: 0.05 })).toBe(state)
    }
  })

  test("a zero-dt tick and a zero hop are no-ops", () => {
    const state = freshGame()
    expect(reducer(state, { type: "tick", dt: 0 })).toBe(state)
    expect(reducer(state, { type: "hop", dx: 0, dy: 0 })).toBe(state)
  })

  test("a hop into the board edge is clamped and returns the same reference", () => {
    const left = make({ frog: { x: 0, y: 1 } })
    const right = make({ frog: { x: 8, y: 8 } })
    expect(reducer(left, { type: "hop", dx: -1, dy: 0 })).toBe(left)
    expect(reducer(right, { type: "hop", dx: 1, dy: 0 })).toBe(right)
  })
})

describe("hopping", () => {
  test("a hop moves the frog one cell and never mutates the input", () => {
    const state = freshGame()
    const next = reducer(state, { type: "hop", dx: 0, dy: -1 })
    expect(next.frog).toEqual({ x: 4, y: 7 })
    expect(state.frog).toEqual({ ...START })
  })

  test("a straight run to the goal fills a slot, scores, and resets the frog", () => {
    let state = freshGame()
    for (let i = 0; i < 8; i++) state = reducer(state, { type: "hop", dx: 0, dy: -1 })
    expect(state.frog).toEqual({ ...START })
    expect(state.score).toBe(10)
    expect(state.goals[GOAL_COLS.indexOf(4)]).toBe(true)
  })

  test("landing on a filled slot (or between slots) bounces with no score", () => {
    const filled = make({
      frog: { x: 4, y: 1 },
      goals: [false, false, true, false, false],
    })
    const bounced = reducer(filled, { type: "hop", dx: 0, dy: -1 })
    expect(bounced.frog).toEqual({ ...START })
    expect(bounced.score).toBe(0)
    expect(bounced.goals[2]).toBe(true)

    const between = make({ frog: { x: 3, y: 1 } })
    const odd = reducer(between, { type: "hop", dx: 0, dy: -1 })
    expect(odd.frog).toEqual({ ...START })
    expect(odd.score).toBe(0)
  })

  test("filling the last slot wins the round", () => {
    const state = make({
      frog: { x: 0, y: 1 },
      score: 40,
      goals: [false, true, true, true, true],
    })
    const next = reducer(state, { type: "hop", dx: 0, dy: -1 })
    expect(next.status).toBe("won")
    expect(next.score).toBe(50)
  })
})

describe("lanes and offsets", () => {
  test("offsetIndexForRow maps road and river rows to their lanes", () => {
    expect(offsetIndexForRow(1)).toBe(0)
    expect(offsetIndexForRow(3)).toBe(2)
    expect(offsetIndexForRow(5)).toBe(3)
    expect(offsetIndexForRow(7)).toBe(5)
    expect(offsetIndexForRow(4)).toBe(-1)
    expect(offsetIndexForRow(8)).toBe(-1)
  })

  test("vehicleRanges tiles every moving lane across the board", () => {
    const lane = MOVING_LANES[0] // road: spacing 3, len 1.4
    expect(vehicleRanges(lane, 0)).toEqual([
      [0, 1.4],
      [3, 4.4],
      [6, 7.4],
    ])
    // Offsets slide the fleet.
    expect(vehicleRanges(lane, 0.5)).toEqual([
      [0.5, 1.9],
      [3.5, 4.9],
      [6.5, 7.9],
    ])
  })

  test("ticks advance every lane offset", () => {
    const next = runTicks(freshGame(), 1)
    MOVING_LANES.forEach((lane, index) => {
      const expected = (((0 + lane.speed * 0.05) % BOARD) + BOARD) % BOARD
      expect(next.offsets[index]).toBeCloseTo(expected, 8)
    })
  })
})

describe("accidents", () => {
  test("a car sharing the frog's cell ends the hop", () => {
    const state = make({ frog: { x: 4, y: 1 } })
    expect(reducer(state, { type: "tick", dt: 0.05 }).status).toBe("over")
  })

  test("the gap between cars is safe", () => {
    const state = make({ frog: { x: 2.3, y: 1 } })
    expect(runTicks(state, 1).status).toBe("running")
  })

  test("the frog rides a log and stays aligned with it", () => {
    const state = make({ frog: { x: 1, y: 5 } }) // lane 3, log at [0,2)
    const next = reducer(state, { type: "tick", dt: 0.05 })
    const lane = MOVING_LANES[3]
    expect(next.frog.x).toBeCloseTo(1 + lane.speed * 0.05, 8)
    expect(next.frog.y).toBe(5)
    expect(next.offsets[3]).toBeCloseTo(lane.speed * 0.05, 8)
  })

  test("a river lane without a log under the frog is wet death", () => {
    const state = make({ frog: { x: 2.6, y: 7 } }) // lane 5 has a 1.2-cell gap here
    expect(reducer(state, { type: "tick", dt: 0.05 }).status).toBe("over")
  })

  test("a log carrying the frog off the edge ends the hop", () => {
    const state = make({ frog: { x: 8.7, y: 5 } })
    expect(reducer(state, { type: "tick", dt: 0.05 }).status).toBe("over")
  })
})