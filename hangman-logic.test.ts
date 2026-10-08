import { describe, expect, test } from "bun:test"

import { stubMathRandom } from "@/test-helpers"

import {
  MAX_WRONG,
  WORDS,
  freshGame,
  initialState,
  pickWord,
  reducer,
  type State,
} from "@/lib/game-hangman"

stubMathRandom()

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("")

/** Guess every unique letter of the word in order (a perfect run). */
function solve(state: State): State {
  let current = state
  for (const letter of [...new Set(current.word)]) {
    current = reducer(current, { type: "guess", letter })
  }
  return current
}

describe("words", () => {
  test("WORDS holds 20+ common 4–8 letter words, no repeats or repeated letters", () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(WORDS).size).toBe(WORDS.length)
    for (const word of WORDS) {
      expect(word.length).toBeGreaterThanOrEqual(4)
      expect(word.length).toBeLessThanOrEqual(8)
      expect(word).toMatch(/^[a-z]+$/)
      expect([...new Set(word)].length).toBe(word.length)
    }
  })

  test("pickWord draws from WORDS", () => {
    expect(WORDS).toContain(pickWord())
  })
})

describe("lifecycle", () => {
  test("initial state is idle", () => {
    expect(initialState.status).toBe("idle")
    expect(initialState.guessed).toEqual([])
    expect(initialState.wrong).toBe(0)
    expect(initialState.streak).toBe(0)
  })

  test("toggle starts, pauses, resumes, and restarts", () => {
    const running = reducer(initialState, { type: "toggle" })
    expect(running.status).toBe("running")
    expect(reducer(running, { type: "toggle" }).status).toBe("paused")
    expect(
      reducer({ ...running, status: "paused" }, { type: "toggle" }).status
    ).toBe("running")

    const used: State = { ...running, guessed: ["b"], wrong: 2 }
    const fresh = reducer(used, { type: "newGame" })
    expect(fresh.status).toBe("running")
    expect(fresh.guessed).toEqual([])
    expect(fresh.wrong).toBe(0)
  })

  test("guesses are ignored outside running", () => {
    expect(reducer(initialState, { type: "guess", letter: "a" })).toBe(
      initialState
    )
    const paused: State = { ...initialState, status: "paused" }
    expect(reducer(paused, { type: "guess", letter: "a" })).toBe(paused)
    const over: State = { ...initialState, status: "over" }
    expect(reducer(over, { type: "guess", letter: "a" })).toBe(over)
    const won: State = { ...initialState, status: "won" }
    expect(reducer(won, { type: "guess", letter: "a" })).toBe(won)
  })
})

describe("guess", () => {
  test("a correct guess reveals the letter and adds no wrongs", () => {
    const state: State = { ...freshGame(), word: "blitz" }
    const next = reducer(state, { type: "guess", letter: "b" })
    expect(next.guessed).toEqual(["b"])
    expect(next.wrong).toBe(0)
    expect(next.status).toBe("running")
  })

  test("a repeated letter is a same-reference no-op", () => {
    const state: State = { ...freshGame(), word: "blitz", guessed: ["b"] }
    expect(reducer(state, { type: "guess", letter: "b" })).toBe(state)
  })

  test("wrong guesses count up and the sixth ends the run", () => {
    let state: State = { ...freshGame(), word: "blitz", streak: 3 }
    const wrongLetters = ALPHABET.filter((letter) => !state.word.includes(letter))
    for (let i = 0; i < MAX_WRONG; i++) {
      state = reducer(state, { type: "guess", letter: wrongLetters[i] })
      if (i < MAX_WRONG - 1) {
        expect(state.status).toBe("running")
        expect(state.streak).toBe(3)
      }
    }
    expect(state.status).toBe("over")
    expect(state.wrong).toBe(MAX_WRONG)
    expect(state.streak).toBe(0)
  })

  test("guessing every unique letter wins without touching the streak", () => {
    let state: State = { ...freshGame(), word: "blitz", streak: 2 }
    state = solve(state)
    expect(state.status).toBe("won")
    expect(state.streak).toBe(2) // the streak earns on the NEXT newGame
  })

  test("the winning guess can come after wrong ones", () => {
    let state: State = { ...freshGame(), word: "blitz" }
    state = reducer(state, { type: "guess", letter: "q" })
    state = reducer(state, { type: "guess", letter: "b" })
    state = reducer(state, { type: "guess", letter: "l" })
    state = reducer(state, { type: "guess", letter: "i" })
    state = reducer(state, { type: "guess", letter: "t" })
    state = reducer(state, { type: "guess", letter: "z" })
    expect(state.status).toBe("won")
    expect(state.wrong).toBe(1)
  })
})

describe("streak", () => {
  test("newGame after a win carries the streak forward", () => {
    const won: State = { ...freshGame(), status: "won", streak: 2 }
    const next = reducer(won, { type: "newGame" })
    expect(next.status).toBe("running")
    expect(next.streak).toBe(3)
    expect(next.guessed).toEqual([])
    expect(next.wrong).toBe(0)
  })

  test("newGame after a loss keeps the reset streak at zero", () => {
    const over: State = { ...freshGame(), status: "over", streak: 0 }
    const next = reducer(over, { type: "newGame" })
    expect(next.status).toBe("running")
    expect(next.streak).toBe(0)
  })

  test("newGame mid-run leaves the streak alone", () => {
    const started: State = { ...freshGame(), streak: 4 }
    const next = reducer(started, { type: "newGame" })
    expect(next.status).toBe("running")
    expect(next.streak).toBe(4)
  })

  test("restarting from a win via toggle also earns the streak", () => {
    const won: State = { ...freshGame(), status: "won", streak: 5 }
    const next = reducer(won, { type: "toggle" })
    expect(next.status).toBe("running")
    expect(next.streak).toBe(6)
  })
})

describe("full lifecycle", () => {
  test("with a stubbed random, win twice then a loss resets the streak", () => {
    let state = freshGame()
    expect(state.status).toBe("running")
    expect(state.streak).toBe(0)

    state = solve(state)
    expect(state.status).toBe("won")
    state = reducer(state, { type: "newGame" })
    expect(state.streak).toBe(1)

    state = solve(state)
    expect(state.status).toBe("won")
    state = reducer(state, { type: "newGame" })
    expect(state.streak).toBe(2)

    // Third word: six wrong guesses lose the run and wipe the streak.
    const wrongLetters = ALPHABET.filter((letter) => !state.word.includes(letter))
    for (let i = 0; i < MAX_WRONG; i++) {
      state = reducer(state, { type: "guess", letter: wrongLetters[i] })
    }
    expect(state.status).toBe("over")
    expect(state.streak).toBe(0)

    state = reducer(state, { type: "newGame" })
    expect(state.status).toBe("running")
    expect(state.streak).toBe(0)
  })
})