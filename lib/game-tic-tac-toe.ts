// Pure Tic-Tac-Toe rules: no React, no DOM. The component only renders state.

import { toggle } from "./game-shared"

export type Cell = "x" | "o" | null
type Winner = "x" | "o" | "draw"
export type Status = "idle" | "running" | "paused" | "over"
/** Who the "o" player is: a second person, or the computer. */
export type Mode = "two-player" | "system"

const SIZE = 3
const HUMAN = "x"
const SYSTEM = "o"

/** The eight lines that score: three rows, three columns, two diagonals. */
const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export type State = {
  board: Cell[]
  turn: "x" | "o"
  status: Status
  winner: Winner | null
  mode: Mode
  /** Rounds won per player, kept across rematches for the session. */
  xWins: number
  oWins: number
}

type Action =
  | { type: "place"; index: number }
  | { type: "toggle" }
  | { type: "newGame" }
  | { type: "setMode"; mode: Mode }

/** The winner of a finished board, or "draw" when it's full, else null. */
export function winnerOf(board: Cell[]): Winner | null {
  for (const [a, b, c] of WIN_LINES) {
    const mark = board[a]
    if (mark && mark === board[b] && mark === board[c]) return mark
  }
  return board.every((cell) => cell !== null) ? "draw" : null
}

const emptyBoard = (): Cell[] => Array<Cell>(SIZE * SIZE).fill(null)

const freeCells = (board: Cell[]) =>
  board.map((cell, index) => (cell === null ? index : -1)).filter((i) => i >= 0)

/**
 * The system's move: full minimax, so it never loses — it takes any win and
 * blocks every loss, and only settles for a draw when it is forced.
 */
export function bestMove(board: Cell[], ai: "x" | "o"): number {
  const human = ai === "x" ? "o" : "x"

  const outcome = (b: Cell[]): number | null => {
    const winner = winnerOf(b)
    if (winner === ai) return 10
    if (winner === human) return -10
    if (winner === "draw") return 0
    return null
  }

  const search = (b: Cell[], turn: "x" | "o"): number => {
    const settled = outcome(b)
    if (settled !== null) return settled
    const scores = freeCells(b).map((index) => {
      const next = b.slice()
      next[index] = turn
      return search(next, turn === "x" ? "o" : "x")
    })
    return turn === ai ? Math.max(...scores) : Math.min(...scores)
  }

  let best = freeCells(board)[0]
  let bestScore = -Infinity
  for (const index of freeCells(board)) {
    const next = board.slice()
    next[index] = ai
    const score = search(next, human)
    if (score > bestScore) {
      bestScore = score
      best = index
    }
  }
  return best
}

function freshGame(mode: Mode, xWins = 0, oWins = 0): State {
  return {
    board: emptyBoard(),
    turn: "x",
    status: "running",
    winner: null,
    mode,
    xWins,
    oWins,
  }
}

export const initialState: State = { ...freshGame("two-player"), status: "idle" }

/** Drop one mark, closing the round and awarding the tally on a win. */
function withMove(state: State, index: number, mark: "x" | "o"): State {
  const board = state.board.slice()
  board[index] = mark
  const winner = winnerOf(board)
  if (winner) {
    return {
      ...state,
      board,
      winner,
      status: "over",
      xWins: state.xWins + (winner === "x" ? 1 : 0),
      oWins: state.oWins + (winner === "o" ? 1 : 0),
    }
  }
  return { ...state, board, turn: mark === "x" ? "o" : "x" }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "place": {
      if (state.status !== "running") return state
      if (state.board[action.index] !== null) return state

      let next = withMove(state, action.index, state.turn)
      // Against the system, the computer answers as "o" immediately.
      if (
        next.status === "running" &&
        next.mode === "system" &&
        next.turn === SYSTEM
      ) {
        next = withMove(next, bestMove(next.board, SYSTEM), SYSTEM)
      }
      return next
    }

    case "toggle":
      // A fresh match, but the session tally sticks around.
      return toggle(state, () => freshGame(state.mode, state.xWins, state.oWins))

    case "newGame":
      return freshGame(state.mode, state.xWins, state.oWins)

    case "setMode":
      // Switching opponent starts a clean match with a clean tally.
      if (action.mode === state.mode) return state
      return freshGame(action.mode)
  }
}

/** The human always plays "x" and moves first, in both modes. */
export const humanMark = HUMAN