// Pure Sudoku rules: no React, no DOM. The component only renders state.

import { toggle } from "./game-shared"

export const ROWS = 9
export const COLS = 9
const BOX = 3
export const SIZE = ROWS * COLS

export type Status = "idle" | "running" | "paused" | "won"

export type State = {
  /** Current board, flat 81; 0 = empty. Starts as a clone of the givens. */
  cells: number[]
  /** Flat index of the highlighted cell, or null. */
  selected: number | null
  /** How many non-given cells currently hold a value that differs from the
   *  solution (incremented on a wrong entry, decremented when it is fixed
   *  or erased). */
  errors: number
  /** Which of PUZZLES is being played. */
  puzzleIndex: number
  /** Elapsed seconds while running. */
  time: number
  status: Status
}

type Action =
  | { type: "select"; index: number }
  | { type: "set"; value: number }
  | { type: "nextPuzzle" }
  | { type: "tick" }
  | { type: "toggle" }
  | { type: "newGame" }

/**
 * The solved grid every puzzle is a mask of. Source: the classic newspaper
 * "difficult" starter layout, hand-checked — every row, column and 3×3 box
 * contains 1–9 exactly once (asserted by isValidSolution in the tests).
 */
const SOLUTION: number[] = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
]

/**
 * Three hand-authored puzzles (81 flat; 0 = empty). Each given set is a mask
 * of the shared SOLUTION above — every non-zero given equals the solution at
 * that position, so the givens never contradict the solve.
 */
export const PUZZLES: { given: number[]; solution: number[]; name: string }[] = [
  {
    // 30 givens — the classic full opening band.
    name: "Classic",
    given: [
      5, 3, 0, 0, 7, 0, 0, 0, 0,
      6, 0, 0, 1, 9, 5, 0, 0, 0,
      0, 9, 8, 0, 0, 0, 0, 6, 0,
      8, 0, 0, 0, 6, 0, 0, 0, 3,
      4, 0, 0, 8, 0, 3, 0, 0, 1,
      7, 0, 0, 0, 2, 0, 0, 0, 6,
      0, 6, 0, 0, 0, 0, 2, 8, 0,
      0, 0, 0, 4, 1, 9, 0, 0, 5,
      0, 0, 0, 0, 8, 0, 0, 7, 9,
    ],
    solution: SOLUTION,
  },
  {
    // 30 givens — spread more evenly, same solution underneath.
    name: "Starter",
    given: [
      0, 3, 4, 0, 7, 0, 9, 0, 0,
      6, 0, 0, 1, 0, 5, 0, 4, 0,
      0, 9, 0, 0, 0, 2, 0, 0, 7,
      0, 0, 9, 7, 0, 1, 0, 0, 0,
      0, 2, 0, 0, 5, 0, 0, 9, 0,
      0, 0, 0, 9, 0, 4, 8, 0, 0,
      9, 0, 0, 5, 0, 0, 0, 8, 0,
      0, 8, 0, 0, 1, 0, 0, 0, 5,
      0, 0, 5, 0, 8, 0, 1, 0, 9,
    ],
    solution: SOLUTION,
  },
  {
    // 26 givens — the sparsest mask of the three.
    name: "Sparse",
    given: [
      0, 0, 4, 0, 0, 8, 0, 0, 0,
      6, 0, 0, 0, 9, 0, 0, 4, 0,
      0, 9, 0, 3, 0, 0, 0, 6, 0,
      8, 0, 0, 0, 6, 0, 0, 0, 3,
      0, 0, 6, 0, 0, 3, 7, 0, 0,
      7, 0, 0, 0, 2, 0, 0, 0, 6,
      0, 6, 0, 0, 0, 0, 2, 8, 0,
      0, 0, 0, 4, 1, 9, 0, 0, 5,
      0, 0, 0, 0, 0, 0, 0, 7, 9,
    ],
    solution: SOLUTION,
  },
]

/** True when every position of `cells` equals `solution` (incl. the givens). */
export function isSolved(cells: number[], solution: number[]): boolean {
  for (let index = 0; index < SIZE; index++) {
    if (cells[index] !== solution[index]) return false
  }
  return true
}

/** Structural check: every row, column and 3×3 box holds 1–9 exactly once. */
export function isValidSolution(solution: number[]): boolean {
  if (solution.length !== SIZE) return false
  const seen = () => new Set<number>()

  for (let row = 0; row < ROWS; row++) {
    const values = seen()
    for (let col = 0; col < COLS; col++) {
      const value = solution[row * COLS + col]
      if (value < 1 || value > 9 || values.has(value)) return false
      values.add(value)
    }
  }

  for (let col = 0; col < COLS; col++) {
    const values = seen()
    for (let row = 0; row < ROWS; row++) {
      const value = solution[row * COLS + col]
      if (value < 1 || value > 9 || values.has(value)) return false
      values.add(value)
    }
  }

  for (let boxRow = 0; boxRow < ROWS; boxRow += BOX) {
    for (let boxCol = 0; boxCol < COLS; boxCol += BOX) {
      const values = seen()
      for (let row = boxRow; row < boxRow + BOX; row++) {
        for (let col = boxCol; col < boxCol + BOX; col++) {
          const value = solution[row * COLS + col]
          if (value < 1 || value > 9 || values.has(value)) return false
          values.add(value)
        }
      }
    }
  }

  return true
}

/** A fresh, running game on the given puzzle (defaults to the first). */
export function freshGame(puzzleIndex = 0): State {
  const puzzle = PUZZLES[puzzleIndex % PUZZLES.length]
  return {
    cells: puzzle.given.slice(),
    selected: null,
    errors: 0,
    puzzleIndex: puzzleIndex % PUZZLES.length,
    time: 0,
    status: "running",
  }
}

export const initialState: State = {
  ...freshGame(0),
  status: "idle",
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select": {
      if (action.index < 0 || action.index >= SIZE) return state
      if (action.index === state.selected) return state
      return { ...state, selected: action.index }
    }

    case "set":
      return setValue(state, action.value)

    case "nextPuzzle":
      return freshGame(state.puzzleIndex + 1)

    case "tick":
      if (state.status !== "running") return state
      return { ...state, time: state.time + 1 }

    case "toggle":
      return toggle(state, () => freshGame(state.puzzleIndex))

    case "newGame":
      return freshGame(state.puzzleIndex)
  }
}

/** Enter `value` (0 erases) into the selected cell, running only. */
function setValue(state: State, value: number): State {
  if (state.status !== "running") return state
  if (state.selected === null) return state
  if (value < 0 || value > 9) return state

  const puzzle = PUZZLES[state.puzzleIndex]
  const index = state.selected
  // The givens are locked forever: set never touches them.
  if (puzzle.given[index] !== 0) return state
  // Same-reference no-op when nothing would change.
  if (state.cells[index] === value) return state

  const cells = state.cells.slice()
  const previous = cells[index]
  cells[index] = value

  // Errors count non-given cells that differ from the solution.
  let errors = state.errors
  if (previous !== 0 && previous !== puzzle.solution[index]) errors--
  if (value !== 0 && value !== puzzle.solution[index]) errors++
  if (errors < 0) errors = 0

  if (isSolved(cells, puzzle.solution)) {
    return { ...state, cells, errors, status: "won" }
  }
  return { ...state, cells, errors }
}