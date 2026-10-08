// Pure Connect Four rules: drops, win detection, rematch tally. No React, no DOM.

import { toggle } from "./game-shared"

export const COLS = 7
export const ROWS = 6

/** A disc: 1 is player one (accent), 2 is player two (foreground). */
type Player = 1 | 2

export type Cell = Player | null

export type Status = "idle" | "running" | "paused" | "over"

export type State = {
  /** COLS×ROWS flat, row-major, top row first. */
  grid: Cell[]
  turn: Player
  /** Selected column, 0..COLS-1. */
  cursor: number
  status: Status
  /** 1, 2, or null when the board fills without a line (draw). */
  winner: Player | null
  wins1: number
  wins2: number
}

type Action =
  | { type: "drop"; col: number }
  | { type: "moveCursor"; dx: -1 | 1 }
  | { type: "select" }
  | { type: "toggle" }
  | { type: "newGame" }

export function emptyGrid(): Cell[] {
  return Array<Cell>(COLS * ROWS).fill(null)
}

/** The row index (0 = top) the disc lands in for a column, or null when full. */
export function landingRow(grid: Cell[], col: number): number | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[row * COLS + col] === null) return row
  }
  return null
}

/** The first player with four in a row, or null. */
export function winnerOf(grid: Cell[]): Player | null {
  const at = (col: number, row: number) => grid[row * COLS + col]
  const DIRS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ]
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = at(col, row)
      if (cell === null) continue
      for (const [dx, dy] of DIRS) {
        let match = true
        for (let step = 1; step < 4; step++) {
          const cx = col + dx * step
          const cy = row + dy * step
          if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) {
            match = false
            break
          }
          if (at(cx, cy) !== cell) {
            match = false
            break
          }
        }
        if (match) return cell
      }
    }
  }
  return null
}

/** True when no cell is empty. */
export function isFull(grid: Cell[]): boolean {
  return grid.every((cell) => cell !== null)
}

/** A fresh running game, keeping any rematch win tally. */
function freshGame(wins1 = 0, wins2 = 0): State {
  return {
    grid: emptyGrid(),
    turn: 1,
    cursor: Math.floor(COLS / 2),
    status: "running",
    winner: null,
    wins1,
    wins2,
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

/** Drop a disc into a column, resolving the winner, the draw, or the turn. */
function drop(state: State, col: number): State {
  const row = landingRow(state.grid, col)
  if (row === null) return state
  const grid = state.grid.slice()
  grid[row * COLS + col] = state.turn
  const winner = winnerOf(grid)

  if (winner !== null) {
    return {
      ...state,
      grid,
      winner,
      status: "over",
      wins1: winner === 1 ? state.wins1 + 1 : state.wins1,
      wins2: winner === 2 ? state.wins2 + 1 : state.wins2,
    }
  }
  if (isFull(grid)) {
    return { ...state, grid, winner: null, status: "over" }
  }
  return { ...state, grid, turn: state.turn === 1 ? 2 : 1 }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "drop": {
      if (state.status !== "running") return state
      if (!Number.isInteger(action.col) || action.col < 0 || action.col >= COLS) return state
      return drop(state, action.col)
    }

    case "moveCursor": {
      if (state.status !== "running") return state
      if (action.dx !== -1 && action.dx !== 1) return state
      const cursor = Math.min(COLS - 1, Math.max(0, state.cursor + action.dx))
      if (cursor === state.cursor) return state
      return { ...state, cursor }
    }

    case "select": {
      if (state.status !== "running") return state
      return drop(state, state.cursor)
    }

    case "toggle":
      return toggle(state, () => freshGame(state.wins1, state.wins2))

    case "newGame": {
      return freshGame(state.wins1, state.wins2)
    }
  }
}