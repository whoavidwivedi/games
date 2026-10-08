import { describe, expect, test } from "bun:test"

import {
  PUZZLES,
  SIZE,
  freshGame,
  initialState,
  isSolved,
  isValidSolution,
  reducer,
  type State,
} from "@/lib/game-sudoku"

function firstEmpty(puzzleIndex: number): number {
  return PUZZLES[puzzleIndex].given.findIndex((value) => value === 0)
}

/** Play a whole puzzle to the winning state by entering every solution value. */
function playWon(puzzleIndex = 0): State {
  const puzzle = PUZZLES[puzzleIndex]
  let state = freshGame(puzzleIndex)
  for (let index = 0; index < SIZE; index++) {
    if (puzzle.given[index] === 0) {
      state = reducer(state, { type: "select", index })
      state = reducer(state, { type: "set", value: puzzle.solution[index] })
    }
  }
  return state
}

describe("puzzles", () => {
  test("every puzzle has exactly 81 cells and givens that match its solution", () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle.given).toHaveLength(SIZE)
      expect(puzzle.solution).toHaveLength(SIZE)
      for (let index = 0; index < SIZE; index++) {
        if (puzzle.given[index] !== 0) {
          expect(puzzle.solution[index]).toBe(puzzle.given[index])
        }
      }
    }
  })

  test("every solution holds 1–9 exactly once in each row, column and box", () => {
    for (const puzzle of PUZZLES) {
      expect(isValidSolution(puzzle.solution)).toBe(true)
    }
  })

  test("isValidSolution rejects a tampered grid", () => {
    const broken = PUZZLES[0].solution.slice()
    broken[40] = broken[40] === 9 ? 1 : broken[40] + 1
    expect(isValidSolution(broken)).toBe(false)
  })

  test("isSolved only when every cell matches the solution", () => {
    const solution = PUZZLES[0].solution
    expect(isSolved(solution.slice(), solution)).toBe(true)
    expect(isSolved(Array<number>(SIZE).fill(0), solution)).toBe(false)
    const off = solution.slice()
    off[40] = off[40] === 9 ? 1 : off[40] + 1
    expect(isSolved(off, solution)).toBe(false)
  })
})

describe("selection and setting", () => {
  test("select identity is a same-reference no-op", () => {
    const state = reducer(initialState, { type: "select", index: 40 })
    expect(reducer(state, { type: "select", index: 40 })).toBe(state)
    expect(reducer(state, { type: "select", index: -1 })).toBe(state)
    expect(reducer(state, { type: "select", index: SIZE })).toBe(state)
  })

  test("set writes only into non-given cells", () => {
    let state = freshGame(0)
    const empty = firstEmpty(0)
    const givenIndex = PUZZLES[0].given.findIndex((value) => value !== 0)
    state = reducer(state, { type: "select", index: empty })
    state = reducer(state, { type: "set", value: 4 })
    expect(state.cells[empty]).toBe(4)

    const onGiven = reducer(state, { type: "select", index: givenIndex })
    const blocked = reducer(onGiven, { type: "set", value: 6 })
    expect(blocked).toBe(onGiven)
    expect(blocked.cells[givenIndex]).toBe(PUZZLES[0].given[givenIndex])
  })

  test("set is a same-reference no-op when idle or won", () => {
    const idleSelected = reducer(initialState, { type: "select", index: 40 })
    expect(reducer(idleSelected, { type: "set", value: 4 })).toBe(idleSelected)

    const won = playWon(0)
    expect(won.status).toBe("won")
    const wonSelected = reducer(won, { type: "select", index: 40 })
    expect(reducer(wonSelected, { type: "set", value: 4 })).toBe(wonSelected)
  })

  test("set without a selection or to the same value is a no-op", () => {
    const started = freshGame(0)
    expect(reducer(started, { type: "set", value: 5 })).toBe(started)

    const empty = firstEmpty(0)
    const selected = reducer(started, { type: "select", index: empty })
    const once = reducer(selected, { type: "set", value: 7 })
    expect(reducer(once, { type: "set", value: 7 })).toBe(once)
    expect(once.cells[empty]).toBe(7)
  })

  test("wrong entries increment errors and corrections decrement them", () => {
    let state = freshGame(0)
    const empty = firstEmpty(0)
    const solution = PUZZLES[0].solution
    const wrong = solution[empty] === 9 ? 1 : solution[empty] + 1

    state = reducer(state, { type: "select", index: empty })
    state = reducer(state, { type: "set", value: wrong })
    expect(state.errors).toBe(1)
    expect(state.cells[empty]).toBe(wrong)

    state = reducer(state, { type: "set", value: solution[empty] })
    expect(state.errors).toBe(0)
    expect(state.cells[empty]).toBe(solution[empty])
  })

  test("swapping one wrong value for another keeps the error count", () => {
    let state = freshGame(0)
    const empty = firstEmpty(0)
    const actual = PUZZLES[0].solution[empty]
    const wrongA = actual === 9 ? 1 : actual + 1
    const wrongB = wrongA === 9 ? 1 : wrongA + 1

    state = reducer(state, { type: "select", index: empty })
    state = reducer(state, { type: "set", value: wrongA })
    state = reducer(state, { type: "set", value: wrongB })
    expect(state.errors).toBe(1)
  })

  test("erasing clears a cell and never counts as an error", () => {
    let state = freshGame(0)
    const empty = firstEmpty(0)
    const actual = PUZZLES[0].solution[empty]
    const wrong = actual === 9 ? 1 : actual + 1

    state = reducer(state, { type: "select", index: empty })
    state = reducer(state, { type: "set", value: wrong })
    expect(state.errors).toBe(1)

    state = reducer(state, { type: "set", value: 0 })
    expect(state.cells[empty]).toBe(0)
    expect(state.errors).toBe(0)

    const alreadyEmpty = reducer(state, { type: "set", value: 0 })
    expect(alreadyEmpty).toBe(state)
  })
})

describe("lifecycle", () => {
  test("initial state is idle on puzzle 0 with a fresh clone of the givens", () => {
    expect(initialState.status).toBe("idle")
    expect(initialState.puzzleIndex).toBe(0)
    expect(initialState.cells).toEqual(PUZZLES[0].given)
    expect(initialState.selected).toBeNull()
    expect(initialState.errors).toBe(0)
    expect(initialState.time).toBe(0)
  })

  test("toggle starts, pauses, resumes, and re-enters a fresh game after a win", () => {
    const started = reducer(initialState, { type: "toggle" })
    expect(started.status).toBe("running")
    expect(started.cells).toEqual(PUZZLES[0].given)
    expect(started.time).toBe(0)

    expect(reducer(started, { type: "toggle" }).status).toBe("paused")
    expect(
      reducer({ ...started, status: "paused" as const }, { type: "toggle" }).status
    ).toBe("running")

    // Winning, then toggling again, restarts the same puzzle.
    const afterWin = reducer(playWon(1), { type: "toggle" })
    expect(afterWin.status).toBe("running")
    expect(afterWin.puzzleIndex).toBe(1)
    expect(afterWin.cells).toEqual(PUZZLES[1].given)
    expect(afterWin.errors).toBe(0)
  })

  test("tick only counts time while running", () => {
    expect(reducer(initialState, { type: "tick" })).toBe(initialState)
    const started = reducer(initialState, { type: "toggle" })
    expect(reducer(started, { type: "tick" }).time).toBe(1)
    const paused = reducer(started, { type: "toggle" })
    expect(reducer(paused, { type: "tick" })).toBe(paused)
  })

  test("newGame resets the current puzzle", () => {
    let state = freshGame(1)
    const empty = firstEmpty(1)
    state = reducer(state, { type: "select", index: empty })
    state = reducer(state, { type: "set", value: 5 })
    state = reducer(state, { type: "tick" })

    const fresh = reducer(state, { type: "newGame" })
    expect(fresh.puzzleIndex).toBe(1)
    expect(fresh.status).toBe("running")
    expect(fresh.cells).toEqual(PUZZLES[1].given)
    expect(fresh.errors).toBe(0)
    expect(fresh.time).toBe(0)
  })

  test("nextPuzzle cycles through all three puzzles and resets each one", () => {
    let played = freshGame(0)
    const empty = firstEmpty(0)
    played = reducer(played, { type: "select", index: empty })
    played = reducer(played, { type: "set", value: 1 })
    played = reducer(played, { type: "tick" })

    const next = reducer(played, { type: "nextPuzzle" })
    expect(next.puzzleIndex).toBe(1)
    expect(next.cells).toEqual(PUZZLES[1].given)
    expect(next.errors).toBe(0)
    expect(next.time).toBe(0)
    expect(next.status).toBe("running")

    const two = reducer(next, { type: "nextPuzzle" })
    expect(two.puzzleIndex).toBe(2)
    const wrap = reducer(two, { type: "nextPuzzle" })
    expect(wrap.puzzleIndex).toBe(0)
    expect(wrap.cells).toEqual(PUZZLES[0].given)
  })
})

describe("win condition and immutability", () => {
  test("filling every empty cell with the solution wins exactly on the final entry", () => {
    const puzzle = PUZZLES[0]
    const empties: number[] = []
    for (let index = 0; index < SIZE; index++) {
      if (puzzle.given[index] === 0) empties.push(index)
    }

    let state = freshGame(0)
    for (const index of empties.slice(0, -1)) {
      state = reducer(state, { type: "select", index })
      state = reducer(state, { type: "set", value: puzzle.solution[index] })
    }
    expect(state.status).toBe("running")

    const last = empties[empties.length - 1]
    state = reducer(state, { type: "select", index: last })
    state = reducer(state, { type: "set", value: puzzle.solution[last] })
    expect(state.status).toBe("won")
    expect(state.errors).toBe(0)
    expect(isSolved(state.cells, puzzle.solution)).toBe(true)
  })

  test("reducer calls never share mutated arrays", () => {
    const empty = firstEmpty(0)
    const start = reducer(freshGame(0), { type: "select", index: empty })
    const a = reducer(start, { type: "set", value: 4 })
    const b = reducer(start, { type: "set", value: 6 })

    expect(a.cells).not.toBe(start.cells)
    expect(b.cells).not.toBe(start.cells)
    expect(a.cells).not.toBe(b.cells)
    expect(start.cells[empty]).toBe(0)
    expect(a.cells[empty]).toBe(4)
    expect(b.cells[empty]).toBe(6)
  })
})