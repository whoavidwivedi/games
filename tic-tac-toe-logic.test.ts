import { describe, expect, test } from "bun:test"

import {
  bestMove,
  initialState,
  reducer,
  winnerOf,
  type Cell,
  type State,
} from "@/lib/game-tic-tac-toe"

function board(cells: (Cell | string)[]): Cell[] {
  return cells.map((c) => (c === "." ? null : (c as Cell)))
}

describe("winnerOf", () => {
  test("finds a horizontal win", () => {
    expect(winnerOf(board(["x", "x", "x", ".", ".", ".", ".", ".", "."]))).toBe("x")
  })

  test("finds a vertical win", () => {
    expect(winnerOf(board(["o", ".", ".", "o", ".", ".", "o", ".", "."]))).toBe("o")
  })

  test("finds a diagonal win", () => {
    expect(winnerOf(board(["x", ".", ".", ".", "x", ".", ".", ".", "x"]))).toBe("x")
  })

  test("returns null while nobody has won", () => {
    expect(winnerOf(board(["x", "o", ".", ".", "x", ".", ".", ".", "."]))).toBeNull()
  })

  test("calls a full board with no line a draw", () => {
    expect(
      winnerOf(board(["x", "o", "x", "o", "x", "o", "o", "x", "o"]))
    ).toBe("draw")
  })
})

describe("place", () => {
  test("alternates turns after a move", () => {
    const first = reducer(initialState, { type: "toggle" }) // running
    expect(first.status).toBe("running")
    const placed = reducer(first, { type: "place", index: 4 })
    expect(placed.board[4]).toBe("x")
    expect(placed.turn).toBe("o")
  })

  test("ignores a move into an occupied cell", () => {
    const state: State = {
      ...initialState,
      status: "running",
      board: board(["x", ".", ".", ".", ".", ".", ".", ".", "."]),
    }
    const next = reducer(state, { type: "place", index: 0 })
    expect(next).toEqual(state)
  })

  test("ignores moves from a paused or finished board", () => {
    const paused: State = { ...initialState, status: "paused" }
    expect(reducer(paused, { type: "place", index: 0 })).toEqual(paused)
    const over: State = { ...initialState, status: "over", board: board(["x", "x", "x", ".", ".", ".", ".", ".", "."]), winner: "x" }
    expect(reducer(over, { type: "place", index: 3 })).toEqual(over)
  })

  test("a winning move closes the round and awards the tally", () => {
    const state: State = {
      ...initialState,
      status: "running",
      turn: "x",
      board: board(["x", "x", ".", "o", "o", ".", ".", ".", "."]),
    }
    const next = reducer(state, { type: "place", index: 2 })
    expect(next.status).toBe("over")
    expect(next.winner).toBe("x")
    expect(next.xWins).toBe(1)
    expect(next.oWins).toBe(0)
  })

  test("the last cell can force a draw", () => {
    const state: State = {
      ...initialState,
      status: "running",
      turn: "o",
      board: board(["x", "o", "x", "x", "o", "o", "o", "x", "."]),
    }
    const next = reducer(state, { type: "place", index: 8 })
    expect(next.status).toBe("over")
    expect(next.winner).toBe("draw")
  })
})

describe("system opponent", () => {
  test("bestMove takes an immediate win", () => {
    const b = board(["o", "o", ".", "x", "x", ".", ".", ".", "."])
    const move = bestMove(b, "o")
    const next = b.slice()
    next[move] = "o"
    expect(winnerOf(next)).toBe("o")
  })

  test("bestMove blocks the opponent's winning move", () => {
    const b = board(["x", "x", ".", "o", ".", ".", ".", ".", "."])
    expect(bestMove(b, "o")).toBe(2)
  })

  test("the system answers every human move", () => {
    let state: State = { ...initialState, status: "running", mode: "system" }
    state = reducer(state, { type: "place", index: 4 })
    expect(state.board[4]).toBe("x")
    expect(state.board.filter((cell) => cell !== null)).toHaveLength(2)
    expect(state.turn).toBe("x")
  })

  test("the system never lets the human win a runaway game", () => {
    let state: State = {
      ...initialState,
      mode: "system",
      status: "running",
    }
    while (state.status === "running") {
      const empty = state.board
        .map((cell, i) => (cell === null ? i : -1))
        .filter((i) => i >= 0)[0]
      state = reducer(state, { type: "place", index: empty })
    }
    expect(state.winner).not.toBe("x")
  })

  test("switching mode resets the board and the tally", () => {
    const next = reducer(
      { ...initialState, xWins: 3, oWins: 2, mode: "system" },
      { type: "setMode", mode: "two-player" }
    )
    expect(next.mode).toBe("two-player")
    expect(next.xWins).toBe(0)
    expect(next.oWins).toBe(0)
    expect(next.status).toBe("running")
    expect(next.board.every((cell) => cell === null)).toBe(true)
  })
})

describe("lifecycle", () => {
  test("toggle starts fresh, pauses, resumes", () => {
    expect(reducer(initialState, { type: "toggle" }).status).toBe("running")
    const running = reducer(initialState, { type: "toggle" })
    expect(reducer(running, { type: "toggle" }).status).toBe("paused")
    expect(reducer({ ...running, status: "paused" }, { type: "toggle" }).status).toBe("running")
  })

  test("a rematch keeps the session tally", () => {
    const played: State = {
      ...initialState,
      status: "over",
      board: board(["x", "x", "x", ".", ".", ".", ".", ".", "."]),
      winner: "x",
      xWins: 2,
      oWins: 1,
    }
    const next = reducer(played, { type: "newGame" })
    expect(next.status).toBe("running")
    expect(next.xWins).toBe(2)
    expect(next.oWins).toBe(1)
    expect(next.board.every((cell) => cell === null)).toBe(true)
  })

  test("reducer calls never share array instances", () => {
    const a = reducer(initialState, { type: "toggle" })
    const b = reducer(a, { type: "place", index: 0 })
    const c = reducer(a, { type: "place", index: 1 })
    expect(b.board[0]).toBe("x")
    expect(c.board[0]).toBeNull()
    expect(c.board[1]).toBe("x")
    expect(b.board[1]).toBeNull()
  })
})