// Pure Tic-Tac-Toe rules: no React, no DOM. The component only renders state.

import { toggle } from "./game-shared"

export type Cell = "x" | "o" | null
type Winner = "x" | "o" | "draw"
export type Status = "idle" | "running" | "paused" | "over"

const SIZE = 3

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
  /** Rounds won per player, kept across rematches for the session. */
  xWins: number
  oWins: number
}

type Action =
  | { type: "place"; index: number }
  | { type: "toggle" }
  | { type: "newGame" }

/** The winner of a finished board, or "draw" when it's full, else null. */
export function winnerOf(board: Cell[]): Winner | null {
  for (const [a, b, c] of WIN_LINES) {
    const mark = board[a]
    if (mark && mark === board[b] && mark === board[c]) return mark
  }
  return board.every((cell) => cell !== null) ? "draw" : null
}

function freshGame(xWins = 0, oWins = 0): State {
  return {
    board: Array<Cell>(SIZE * SIZE).fill(null),
    turn: "x",
    status: "running",
    winner: null,
    xWins,
    oWins,
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "place": {
      if (state.status !== "running") return state
      if (state.board[action.index] !== null) return state

      const board = state.board.slice()
      board[action.index] = state.turn
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
      return { ...state, board, turn: state.turn === "x" ? "o" : "x" }
    }

    case "toggle":
      // A fresh match, but the session tally sticks around.
      return toggle(state, () => freshGame(state.xWins, state.oWins))

    case "newGame":
      return freshGame(state.xWins, state.oWins)
  }
}