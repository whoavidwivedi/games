// Pure Minesweeper rules: no React, no DOM. The component only renders state.

import { toggle, type Dir } from "./game-shared"

export const ROWS = 9
export const COLS = 9
export const MINES = 10
export const SIZE = ROWS * COLS

export type Status = "idle" | "running" | "paused" | "over" | "won"

export type State = {
  mines: boolean[]
  revealed: boolean[]
  flagged: boolean[]
  /** Mine adjacency counts, recomputed whenever mines change. */
  counts: number[]
  status: Status
  /** Cells are keyboard/touch navigable (arrows + Space/F). */
  cursor: number
  /** Elapsed seconds while running. */
  time: number
  /** Whether the first reveal is still pending (it is always safe). */
  firstReveal: boolean
}

type Action =
  | { type: "reveal"; index: number }
  | { type: "flag"; index: number }
  | { type: "moveCursor"; dir: Dir }
  | { type: "tick" }
  | { type: "toggle" }
  | { type: "newGame" }

/** The up-to-8 in-bounds neighbours of a cell (flat index). */
export function neighbors(index: number): number[] {
  const row = Math.floor(index / COLS)
  const col = index % COLS
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const r = row + dr
      const c = col + dc
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) out.push(r * COLS + c)
    }
  }
  return out
}

/** How many mines sit on a cell's neighbours. */
export function countAdjacent(mines: boolean[], index: number): number {
  return neighbors(index).filter((n) => mines[n]).length
}

export function allCounts(mines: boolean[]): number[] {
  return mines.map((_, index) => countAdjacent(mines, index))
}

export function placeMines(): boolean[] {
  const mines = Array<boolean>(SIZE).fill(false)
  let placed = 0
  while (placed < MINES) {
    const index = Math.floor(Math.random() * SIZE)
    if (!mines[index]) {
      mines[index] = true
      placed++
    }
  }
  return mines
}

export function freshGame(): State {
  const mines = placeMines()
  return {
    mines,
    revealed: Array<boolean>(SIZE).fill(false),
    flagged: Array<boolean>(SIZE).fill(false),
    counts: allCounts(mines),
    status: "running",
    cursor: Math.floor(SIZE / 2),
    time: 0,
    firstReveal: true,
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reveal":
      return revealAt(state, action.index)

    case "flag": {
      if (state.status !== "running") return state
      if (state.revealed[action.index]) return state
      const flagged = state.flagged.slice()
      flagged[action.index] = !flagged[action.index]
      return { ...state, flagged }
    }

    case "moveCursor": {
      if (state.status !== "running") return state
      const col = state.cursor % COLS
      const row = Math.floor(state.cursor / COLS)
      let next = state.cursor
      if (action.dir === "left") next = row * COLS + (col - 1 + COLS) % COLS
      if (action.dir === "right") next = row * COLS + (col + 1) % COLS
      if (action.dir === "up") next = (row - 1 + ROWS) % ROWS * COLS + col
      if (action.dir === "down") next = (row + 1) % ROWS * COLS + col
      return next === state.cursor ? state : { ...state, cursor: next }
    }

    case "tick":
      if (state.status !== "running") return state
      return { ...state, time: state.time + 1 }

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame":
      return freshGame()
  }
}

function revealAt(state: State, index: number): State {
  if (state.status !== "running") return state
  if (state.revealed[index] || state.flagged[index]) return state

  // The first click must never blow up: move the mine away if it's here.
  let mines = state.mines
  if (state.firstReveal && mines[index]) {
    const swap = mines.findIndex((mine, i) => !mine && i !== index)
    if (swap !== -1) {
      mines = mines.slice()
      mines[index] = false
      mines[swap] = true
    }
  }

  const counts = allCounts(mines)
  const revealed = state.revealed.slice()
  // The clicked cell always opens (the hit-mine case shows it), then a flood
  // expands through its zero neighbours. Mines are never entered by the
  // flood, and flagged cells stay hidden.
  revealed[index] = true
  const queue = [index]
  const queued = new Set<number>([index])
  while (queue.length > 0) {
    const current = queue.pop() as number
    if (mines[current] || state.flagged[current]) continue
    revealed[current] = true
    if (counts[current] === 0) {
      for (const n of neighbors(current)) {
        if (!queued.has(n) && !state.flagged[n]) {
          queued.add(n)
          queue.push(n)
        }
      }
    }
  }

  const hitMine = mines[index]
  if (hitMine) {
    return { ...state, mines, revealed, counts, status: "over", firstReveal: false }
  }
  const won = revealed.every((isOpen, i) => isOpen || mines[i])
  return {
    ...state,
    mines,
    revealed,
    counts,
    status: won ? "won" : "running",
    firstReveal: false,
  }
}