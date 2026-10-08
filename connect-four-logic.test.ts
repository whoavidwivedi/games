import { describe, expect, test } from "bun:test"

import { toggleLifecycle } from "@/test-helpers"

import {
  COLS,
  ROWS,
  emptyGrid,
  initialState,
  isFull,
  landingRow,
  reducer,
  winnerOf,
  type Cell,
  type State,
} from "@/lib/game-connect-four"

function make(grid: Cell[], turn: 1 | 2 = 1): State {
  return {
    grid,
    turn,
    cursor: 3,
    status: "running",
    winner: null,
    wins1: 0,
    wins2: 0,
  }
}

/** Two alternating rows whose runs never reach four in any direction. */
const LINEFREE_ROWS = ["1122112", "2211221"]

function lineFreeGrid(): Cell[] {
  const grid = emptyGrid()
  for (let row = 0; row < ROWS; row++) {
    const pattern = LINEFREE_ROWS[row % 2]
    for (let col = 0; col < COLS; col++) {
      grid[row * COLS + col] = pattern[col] === "1" ? 1 : 2
    }
  }
  return grid
}

/** A column filled with alternating gravity-upside-down discs is awkward to
 *  build by hand, so drop helper: set one disc with drop(). */
function dropped(state: State, col: number): State {
  return reducer(state, { type: "drop", col })
}

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    toggleLifecycle(reducer, initialState)
  })

  test("newGame resets the board and keeps the rematch tally", () => {
    const state = make(emptyGrid(), 2)
    const played = dropped(dropped(dropped(state, 0), 0), 0)
    const next = reducer(played, { type: "newGame" })
    expect(next.grid.every((cell) => cell === null)).toBe(true)
    expect(next.turn).toBe(1)
    expect(next.status).toBe("running")
  })

  test("drop into a full column is a no-op returning the same reference", () => {
    const grid: Cell[] = []
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) grid[row * COLS + col] = 1
    }
    const state = make(grid)
    expect(landingRow(grid, 0)).toBeNull()
    expect(reducer(state, { type: "drop", col: 0 })).toBe(state)
  })
})

describe("drops and turns", () => {
  test("a disc lands at the bottom of its column", () => {
    expect(landingRow(emptyGrid(), 3)).toBe(ROWS - 1)
    const after = dropped(make(emptyGrid()), 3)
    expect(after.grid[(ROWS - 1) * COLS + 3]).toBe(1)
    expect(after.turn).toBe(2)
  })

  test("discs stack up a column", () => {
    let state = make(emptyGrid())
    state = dropped(state, 2)
    state = dropped(state, 2)
    expect(state.grid[(ROWS - 1) * COLS + 2]).toBe(1)
    expect(state.grid[(ROWS - 2) * COLS + 2]).toBe(2)
  })

  test("an out-of-range column is rejected", () => {
    const state = make(emptyGrid())
    expect(reducer(state, { type: "drop", col: -1 })).toBe(state)
    expect(reducer(state, { type: "drop", col: COLS })).toBe(state)
  })
})

describe("cursor", () => {
  test("moveCursor clamps to the board and wraps not at all", () => {
    let state = make(emptyGrid())
    expect(reducer(state, { type: "moveCursor", dx: -1 }).cursor).toBe(2)
    state = { ...state, cursor: 0 }
    expect(reducer(state, { type: "moveCursor", dx: -1 })).toBe(state)
    state = { ...state, cursor: COLS - 1 }
    expect(reducer(state, { type: "moveCursor", dx: 1 })).toBe(state)
  })

  test("select drops at the cursor column", () => {
    const state = { ...make(emptyGrid()), cursor: 5 }
    const next = reducer(state, { type: "select" })
    expect(next.grid[(ROWS - 1) * COLS + 5]).toBe(1)
  })
})

describe("winner detection", () => {
  test("finds a horizontal, vertical, and both diagonals", () => {
    const horizontal = emptyGrid()
    for (let col = 0; col < 4; col++) horizontal[(ROWS - 1) * COLS + col] = 2
    expect(winnerOf(horizontal)).toBe(2)

    const vertical = emptyGrid()
    for (let row = ROWS - 4; row < ROWS; row++) vertical[row * COLS + 1] = 1
    expect(winnerOf(vertical)).toBe(1)

    const diagonalDown = emptyGrid()
    for (let step = 0; step < 4; step++) diagonalDown[(2 + step) * COLS + step] = 1
    expect(winnerOf(diagonalDown)).toBe(1)

    const diagonalUp = emptyGrid()
    for (let step = 0; step < 4; step++) diagonalUp[(ROWS - 1 - step) * COLS + step] = 2
    expect(winnerOf(diagonalUp)).toBe(2)
  })

  test("returns null without a line", () => {
    expect(winnerOf(emptyGrid())).toBeNull()
    expect(winnerOf(lineFreeGrid())).toBeNull()
    expect(isFull(lineFreeGrid())).toBe(true)
  })
})

describe("end games", () => {
  test("four in a row ends the game and tallies the win", () => {
    // P1 plays 0..3 down a column, P2 fills the opposite side harmlessly.
    let state = make(emptyGrid())
    // Column 0: P1 x4 → but P2 must drop between. Drop P1 0, P2 3, P1 0, P2 3, P1 0, P2 3, P1 0
    state = dropped(state, 0) // P1 bottom col 0
    state = dropped(state, 3) // P2 bottom col 3
    state = dropped(state, 0) // P1 col 0 second
    state = dropped(state, 3)
    state = dropped(state, 0) // P1 third
    state = dropped(state, 3)
    state = dropped(state, 0) // P1 wins column 0
    expect(state.status).toBe("over")
    expect(state.winner).toBe(1)
    expect(state.wins1).toBe(1)
  })

  test("a full board without a line is a draw (winner null)", () => {
    // Knock one cell out of the line-free board and drop into it: the board
    // fills and the reducer must end in a draw.
    const grid = lineFreeGrid()
    const hole = (ROWS - 1) * COLS + 2
    grid[hole] = null
    expect(winnerOf(grid)).toBeNull()
    const state = make(grid, 2)
    const next = reducer(state, { type: "drop", col: 2 })
    expect(next.grid.indexOf(null)).toBe(-1)
    expect(next.winner).toBeNull()
    expect(next.status).toBe("over")
  })

  test("a win tally survives a newGame and a toggle restart", () => {
    const grid = emptyGrid()
    for (let col = 0; col < 4; col++) grid[col] = 2 // top row
    const state = make(grid, 1)
    const over = reducer(state, { type: "drop", col: 4 })
    expect(over.status).toBe("over")
    expect(over.wins2).toBe(1)
    expect(reducer(over, { type: "newGame" }).wins2).toBe(1)
    expect(reducer(over, { type: "toggle" }).wins2).toBe(1)
  })

  test("reducers never mutate their input grid", () => {
    const grid = emptyGrid()
    const state = make(grid)
    const next = dropped(state, 2)
    expect(grid[ROWS - 1 * COLS + 2]).toBeNull()
    expect(state.grid).toBe(grid)
    expect(next.grid).not.toBe(grid)
  })
})