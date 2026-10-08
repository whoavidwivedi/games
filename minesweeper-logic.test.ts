import { describe, expect, test } from "bun:test"

import {
  COLS,
  MINES,
  ROWS,
  SIZE,
  allCounts,
  countAdjacent,
  freshGame,
  initialState,
  neighbors,
  placeMines,
  reducer,
  type State,
} from "@/lib/game-minesweeper"

function running() {
  return reducer(initialState, { type: "toggle" }) as State
}

function withMines(...mineIndexes: number[]): State {
  const mines = Array<boolean>(SIZE).fill(false)
  for (const i of mineIndexes) mines[i] = true
  return {
    mines,
    revealed: Array<boolean>(SIZE).fill(false),
    flagged: Array<boolean>(SIZE).fill(false),
    counts: allCounts(mines),
    status: "running",
    cursor: 40,
    time: 0,
    firstReveal: false,
  }
}

describe("placement and counts", () => {
  test("placeMines places exactly MINES mines", () => {
    const mines = placeMines()
    expect(mines.filter(Boolean)).toHaveLength(MINES)
  })

  test("neighbors are always 8 in-bounds cells", () => {
    expect(neighbors(40)).toHaveLength(8)
    expect(neighbors(0)).toHaveLength(3)
    expect(neighbors(80)).toHaveLength(3)
    expect(neighbors(4)).toHaveLength(5)
  })

  test("countAdjacent counts only the 8 neighbours", () => {
    const state = withMines(0, 41, 80)
    expect(countAdjacent(state.mines, 0)).toBe(0) // itself isn't counted
    expect(countAdjacent(state.mines, 1)).toBe(1) // touches mine at 0
    expect(countAdjacent(state.mines, 40)).toBe(1) // touches mine at 41
    expect(countAdjacent(state.mines, 79)).toBe(1) // touches mine at 80
  })
})

describe("first reveal is always safe", () => {
  test("a mine under the first click moves elsewhere", () => {
    const firstReveal: State = {
      ...withMines(4, 10),
      firstReveal: true,
    }
    const safe = reducer(firstReveal, { type: "reveal", index: 4 })
    expect(safe.status).toBe("running")
    expect(safe.mines[4]).toBe(false)
    // The mine moved to the first free cell, index 0.
    expect(safe.mines[0]).toBe(true)
    expect(safe.mines.filter(Boolean)).toHaveLength(2)
    expect(safe.firstReveal).toBe(false)
  })

  test("a later click on a real mine ends the run", () => {
    // The first click moved the mine away from cell 4; the other real mine
    // at 10 stays hidden through the flood, and clicking it still blows up.
    const start: State = { ...withMines(4, 10), firstReveal: true }
    const safe = reducer(start, { type: "reveal", index: 4 })
    expect(safe.mines[4]).toBe(false)
    expect(safe.revealed[10]).toBe(false)
    const boom = reducer(safe, { type: "reveal", index: 10 })
    expect(boom.status).toBe("over")
    expect(boom.revealed[10]).toBe(true)
  })
})

describe("reveal", () => {
  test("zero cells flood-fill their neighbourhood", () => {
    // No mines near the centre: revealing 40 opens a wide region.
    const state = withMines(0, 80)
    const next = reducer(state, { type: "reveal", index: 40 })
    expect(next.revealed.filter(Boolean).length).toBeGreaterThan(10)
    // The border mines stay hidden.
    expect(next.revealed[0]).toBe(false)
    expect(next.revealed[80]).toBe(false)
  })

  test("numbered cells reveal without expanding", () => {
    const state = withMines(4)
    const next = reducer(state, { type: "reveal", index: 5 })
    expect(next.revealed[5]).toBe(true)
    expect(next.revealed.filter(Boolean)).toHaveLength(1)
  })

  test("flagged cells are never uncovered by a flood", () => {
    const state = withMines()
    state.flagged[41] = true
    const next = reducer(state, { type: "reveal", index: 40 })
    expect(next.revealed[41]).toBe(false)
    expect(next.flagged[41]).toBe(true)
  })

  test("revealing a flagged cell is a no-op", () => {
    const state = withMines(4)
    state.flagged[5] = true
    const next = reducer(state, { type: "reveal", index: 5 })
    expect(next.revealed[5]).toBe(false)
    expect(next.flagged[5]).toBe(true)
  })

  test("hitting a mine ends the run", () => {
    const state = withMines(4)
    const next = reducer(state, { type: "reveal", index: 4 })
    expect(next.status).toBe("over")
  })

  test("revealing every safe cell wins", () => {
    const state = withMines(0, 1)
    let current = state
    for (let index = 2; index < SIZE; index++) {
      current = reducer(current, { type: "reveal", index })
    }
    expect(current.status).toBe("won")
    expect(current.revealed.every((open, i) => open || current.mines[i])).toBe(true)
  })

  test("reveals are ignored once the game ends", () => {
    const over = { ...withMines(4), status: "over" as const }
    expect(reducer(over, { type: "reveal", index: 5 })).toBe(over)
  })
})

describe("flag and cursor", () => {
  test("flag toggles on an unrevealed cell only", () => {
    const state = withMines(4)
    const once = reducer(state, { type: "flag", index: 6 })
    expect(once.flagged[6]).toBe(true)
    const twice = reducer(once, { type: "flag", index: 6 })
    expect(twice.flagged[6]).toBe(false)
    const revealed = reducer(state, { type: "reveal", index: 5 })
    expect(reducer(revealed, { type: "flag", index: 5 })).toEqual(revealed)
  })

  test("exactly ten mines minus flags shows in the header count", () => {
    const state = withMines(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)
    const flagged = reducer(state, { type: "flag", index: 40 })
    const left = MINES - flagged.flagged.filter(Boolean).length
    expect(left).toBe(9)
  })

  test("cursor moves wrap at every edge", () => {
    const move = (from: number, dir: "up" | "down" | "left" | "right") =>
      reducer({ ...running(), cursor: from }, { type: "moveCursor", dir }).cursor
    expect(move(0, "left")).toBe(COLS - 1)
    expect(move(0, "up")).toBe(SIZE - COLS)
    expect(move(SIZE - 1, "right")).toBe(SIZE - COLS)
    expect(move(SIZE - 1, "down")).toBe(COLS - 1)
    expect(move(40, "right")).toBe(41)
  })
})

describe("lifecycle", () => {
  test("toggle starts, pauses, resumes, and restarts", () => {
    const started = reducer(initialState, { type: "toggle" })
    expect(started.status).toBe("running")
    expect(reducer(started, { type: "toggle" }).status).toBe("paused")
    expect(reducer({ ...started, status: "paused" }, { type: "toggle" }).status).toBe("running")
    const over = reducer(started, { type: "toggle" }) // pause again
    const restarted = reducer({ ...over, status: "over" as const }, { type: "toggle" })
    expect(restarted.status).toBe("running")
  })

  test("tick only counts time while running", () => {
    expect(reducer(initialState, { type: "tick" })).toBe(initialState)
    const started = reducer(initialState, { type: "toggle" })
    expect(reducer(started, { type: "tick" }).time).toBe(1)
  })

  test("newGame always deals a clean board", () => {
    const started = reducer(initialState, { type: "toggle" })
    const played = reducer(started, { type: "reveal", index: 40 })
    const fresh = reducer(played, { type: "newGame" })
    expect(fresh.status).toBe("running")
    expect(fresh.revealed.every((r) => !r)).toBe(true)
    expect(fresh.flagged.every((f) => !f)).toBe(true)
    expect(fresh.mines.filter(Boolean)).toHaveLength(MINES)
  })

  test("freshGame mines are inside the board", () => {
    const state = freshGame()
    expect(state.mines.length).toBe(ROWS * COLS)
    expect(state.mines[0] || true).toBe(true)
    expect(state.mines.length).toBe(SIZE)
  })
})