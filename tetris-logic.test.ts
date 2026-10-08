import { describe, expect, test } from "bun:test"

import { stubMathRandom, toggleLifecycle } from "@/test-helpers"

import {
  H,
  SHAPES,
  W,
  cellsOf,
  collides,
  freshGame,
  gainedFor,
  gravityFor,
  initialState,
  reducer,
  type State,
} from "@/lib/game-tetris"

stubMathRandom()

function piece(type: number): State["piece"] {
  return { type, cells: cellsOf(SHAPES[type]) }
}

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    toggleLifecycle(reducer, initialState)
  })

  test("newGame deals a clean empty board", () => {
    const started = reducer(initialState, { type: "toggle" })
    const played = reducer(started, { type: "hardDrop" })
    const fresh = reducer(played, { type: "newGame" })
    expect(fresh.status).toBe("running")
    expect(fresh.score).toBe(0)
    expect(fresh.lines).toBe(0)
    expect(fresh.level).toBe(1)
    expect(fresh.field.every((cell) => cell === null)).toBe(true)
    expect(fresh.piece).not.toBeNull()
    expect(fresh.dropIn).toBe(gravityFor(1))
  })

  test("every action is a same-reference no-op outside running", () => {
    for (const status of ["idle", "paused", "over"] as const) {
      const state: State = { ...freshGame(), status }
      expect(reducer(state, { type: "tick", dt: 0.1 })).toBe(state)
      expect(reducer(state, { type: "move", dx: -1 })).toBe(state)
      expect(reducer(state, { type: "rotate" })).toBe(state)
      expect(reducer(state, { type: "softDrop" })).toBe(state)
      expect(reducer(state, { type: "hardDrop" })).toBe(state)
    }
  })
})

describe("gravity and movement", () => {
  test("tick deducts dropIn and clamps dt to 0.05", () => {
    const state: State = { ...freshGame(), dropIn: 0.3 }
    const after = reducer(state, { type: "tick", dt: 0.1 })
    expect(after.dropIn).toBeCloseTo(0.25)
    expect(after.pieceY).toBe(0)
  })

  test("tick drops the piece when dropIn runs out and resets it", () => {
    const state: State = { ...freshGame(), dropIn: 0.04, pieceY: 0 }
    const next = reducer(state, { type: "tick", dt: 0.1 })
    expect(next.pieceY).toBe(1)
    expect(next.dropIn).toBe(gravityFor(next.level))
  })

  test("move slides into free space but not through the wall", () => {
    const state: State = { ...freshGame(), piece: piece(5), pieceX: 7, pieceY: 0 }
    expect(reducer(state, { type: "move", dx: 1 })).toBe(state)
    const moved = reducer(state, { type: "move", dx: -1 })
    expect(moved.pieceX).toBe(6)
    expect(moved.field).toEqual(state.field)
  })

  test("rotate is blocked when the rotated piece collides", () => {
    const field = Array<number | null>(W * H).fill(null)
    // T at (3,5): rotated cells touch (4,7) = index 74.
    field[74] = 1
    const state: State = {
      ...freshGame(),
      field,
      piece: piece(5),
      pieceX: 3,
      pieceY: 5,
    }
    expect(reducer(state, { type: "rotate" })).toBe(state)
  })

  test("rotate turns the piece when the space is free", () => {
    const state: State = { ...freshGame(), piece: piece(5), pieceX: 3, pieceY: 5 }
    const next = reducer(state, { type: "rotate" })
    expect(next.piece).not.toBeNull()
    expect(next.piece?.type).toBe(5)
    expect(next.piece?.cells).not.toEqual(state.piece?.cells)
    expect(collides(next.field, next.piece!.cells, next.pieceX, next.pieceY)).toBe(false)
  })

  test("softDrop drops one row and locks when blocked", () => {
    const field = Array<number | null>(W * H).fill(null)
    // O at (4,8) rests on two locked cells at row 9.
    field[9 * W + 4] = 1
    field[9 * W + 5] = 1
    const state: State = { ...freshGame(), field, piece: piece(3), pieceX: 4, pieceY: 8 }
    const next = reducer(state, { type: "softDrop" })
    expect(next.status).toBe("running")
    expect(next.field[8 * W + 4]).not.toBeNull()
    expect(next.field[8 * W + 5]).not.toBeNull()
    expect(next.field[9 * W + 4]).not.toBeNull()
    expect(next.field[9 * W + 5]).not.toBeNull()
  })

  test("hardDrop falls to the floor, locks, and spawns a fresh piece", () => {
    const state: State = { ...freshGame(), piece: piece(3), pieceX: 4, pieceY: 2 }
    const next = reducer(state, { type: "hardDrop" })
    expect(next.status).toBe("running")
    // O is 2 tall; from y=2 it can fall to y=8.
    expect(next.field[8 * W + 4]).toBe(3)
    expect(next.field[8 * W + 5]).toBe(3)
    expect(next.field[9 * W + 4]).toBe(3)
    expect(next.field[9 * W + 5]).toBe(3)
    // A fresh piece spawned at the top row.
    expect(next.piece).not.toBeNull()
    expect(next.pieceX).toBeGreaterThanOrEqual(0)
    expect(next.pieceY).toBe(0)
    expect(collides(next.field, next.piece!.cells, next.pieceX, next.pieceY)).toBe(false)
  })
})

describe("line clears and scoring", () => {
  test("gainedFor maps cleared rows to base points", () => {
    expect(gainedFor(0)).toBe(0)
    expect(gainedFor(1)).toBe(100)
    expect(gainedFor(2)).toBe(300)
    expect(gainedFor(3)).toBe(500)
    expect(gainedFor(4)).toBe(800)
  })

  test("a single cleared row scores 100 × level", () => {
    const field = Array<number | null>(W * H).fill(null)
    for (let c = 0; c < W; c++) {
      if (c < 4 || c >= 8) field[9 * W + c] = 1
    }
    const state: State = {
      ...freshGame(),
      field,
      piece: piece(0),
      pieceX: 4,
      pieceY: 8,
      score: 0,
      lines: 0,
      level: 1,
    }
    const next = reducer(state, { type: "hardDrop" })
    expect(next.lines).toBe(1)
    expect(next.score).toBe(100)
    expect(next.level).toBe(1)
    expect(next.status).toBe("running")
    expect(next.field.slice(9 * W, 10 * W).every((cell) => cell === null)).toBe(true)
  })

  test("a double clear scores 300 × level and levels up after five rows", () => {
    const field = Array<number | null>(W * H).fill(null)
    for (let row = 8; row <= 9; row++) {
      for (let c = 0; c < W; c++) {
        if (c < 4 || c >= 6) field[row * W + c] = 1
      }
    }
    const state: State = {
      ...freshGame(),
      field,
      piece: piece(3),
      pieceX: 4,
      pieceY: 8,
      score: 0,
      lines: 3,
      level: 1,
    }
    const next = reducer(state, { type: "hardDrop" })
    expect(next.lines).toBe(5)
    expect(next.level).toBe(2)
    expect(next.score).toBe(300)
  })

  test("a spawn that collides with the stack ends the game", () => {
    // Rows 0–1 partially block the centre 3–7 columns that every spawn
    // touches — partial, so they never clear — while the O at (4,8) can
    // still lock into the free rows 8–9. Once it does, the next spawn dies.
    const field = Array<number | null>(W * H).fill(null)
    for (let c = 3; c <= 7; c++) {
      field[c] = 1
      field[W + c] = 1
    }
    const state: State = { ...freshGame(), field, piece: piece(3), pieceX: 4, pieceY: 8 }
    const next = reducer(state, { type: "softDrop" })
    expect(next.status).toBe("over")
    expect(next.field[4]).not.toBeNull()
  })
})

describe("immutability", () => {
  test("reducer calls never mutate the input state", () => {
    const field = Array<number | null>(W * H).fill(null)
    field[9 * W + 4] = 1
    const state: State = { ...freshGame(), field, piece: piece(3), pieceX: 4, pieceY: 8 }
    const originalField = state.field.slice()
    const originalCells = state.piece?.cells.slice()

    reducer(state, { type: "hardDrop" })
    reducer(state, { type: "rotate" })
    reducer(state, { type: "softDrop" })
    reducer(state, { type: "move", dx: 1 })

    expect(state.field).toEqual(originalField)
    expect(state.piece?.cells).toEqual(originalCells)
  })

  test("two calls from the same state don't affect each other", () => {
    const state: State = { ...freshGame(), piece: piece(5), pieceX: 3, pieceY: 5 }
    const first = reducer(state, { type: "rotate" })
    const second = reducer(state, { type: "rotate" })
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(state.piece?.cells).not.toEqual(first.piece?.cells)
  })
})

describe("full run with stubbed random", () => {
  test("a whole game ends in 'over' with consistent invariants", () => {
    let state = freshGame()
    let steps = 0
    while (state.status === "running" && steps < 300_000) {
      // A deterministic driver that steers and drops a little so the run
      // reaches every code path: rotate, move, hard drop, and gravity ticks.
      if (steps % 7 === 0) state = reducer(state, { type: "rotate" })
      if (steps % 13 === 0) {
        state = reducer(state, { type: "move", dx: steps % 2 === 0 ? 1 : -1 })
      }
      if (steps % 101 === 97) state = reducer(state, { type: "hardDrop" })
      else state = reducer(state, { type: "tick", dt: 0.05 })

      if (state.status === "running") {
        expect(state.field.length).toBe(W * H)
        expect(
          state.field.every((cell) => cell === null || (cell >= 0 && cell < SHAPES.length))
        ).toBe(true)
        expect(state.level).toBe(1 + Math.floor(state.lines / 5))
        expect(state.dropIn).toBeGreaterThan(0)
        expect(state.dropIn).toBeLessThanOrEqual(gravityFor(state.level))
        expect(state.piece).not.toBeNull()
        expect(collides(state.field, state.piece!.cells, state.pieceX, state.pieceY)).toBe(false)
      }
      steps++
    }
    expect(steps).toBeLessThan(300_000)
    expect(steps).toBeGreaterThan(100)
    expect(state.status).toBe("over")
    expect(state.field.length).toBe(H * W)
  })
})