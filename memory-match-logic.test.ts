import { describe, expect, test } from "bun:test"

import { stubMathRandom } from "@/test-helpers"

import {
  CARDS,
  PAIRS,
  freshGame,
  initialState,
  reducer,
  shuffle,
  type State,
} from "@/lib/game-memory-match"

stubMathRandom()

/** A running board dealt from explicit values (two of each pair expected). */
function deckState(cards: number[]): State {
  return {
    cards: cards.map((value, index) => ({ id: index + 1, value })),
    flipped: [],
    matched: [],
    resolving: false,
    cursor: 4,
    moves: 0,
    status: "running",
  }
}

function fullDeck(): number[] {
  return Array.from({ length: PAIRS }, (_, i) => [i + 1, i + 1]).flat()
}

describe("shuffle", () => {
  test("deals exactly two of every value 1..8", () => {
    const deck = shuffle()
    expect(deck).toHaveLength(CARDS)
    for (let value = 1; value <= PAIRS; value++) {
      expect(deck.filter((v) => v === value)).toHaveLength(2)
    }
  })

  test("shuffled decks are permutations of the pair deck", () => {
    for (let run = 0; run < 5; run++) {
      const deck = shuffle()
      expect(deck.slice().sort((a, b) => a - b)).toEqual(fullDeck())
    }
  })
})

describe("lifecycle", () => {
  test("initial state is idle", () => {
    expect(initialState.status).toBe("idle")
    expect(initialState.moves).toBe(0)
    expect(initialState.cards).toHaveLength(CARDS)
  })

  test("toggle starts, pauses, resumes, and restarts", () => {
    const started = reducer(initialState, { type: "toggle" })
    expect(started.status).toBe("running")
    expect(reducer(started, { type: "toggle" }).status).toBe("paused")
    expect(
      reducer({ ...started, status: "paused" }, { type: "toggle" }).status
    ).toBe("running")

    const used: State = { ...started, moves: 5, flipped: [0, 1] }
    const fresh = reducer(used, { type: "newGame" })
    expect(fresh.status).toBe("running")
    expect(fresh.moves).toBe(0)
    expect(fresh.flipped).toEqual([])
    expect(fresh.matched).toEqual([])
  })

  test("winning restarts from scratch on toggle", () => {
    const won: State = { ...deckState(fullDeck()), status: "won" }
    const restarted = reducer(won, { type: "toggle" })
    expect(restarted.status).toBe("running")
    expect(restarted.moves).toBe(0)
  })
})

describe("flip rules", () => {
  test("flips are no-ops outside running", () => {
    expect(reducer(initialState, { type: "flip", index: 0 })).toBe(initialState)
    const paused: State = { ...initialState, status: "paused" }
    expect(reducer(paused, { type: "flip", index: 0 })).toBe(paused)
    const won: State = { ...initialState, status: "won" }
    expect(reducer(won, { type: "flip", index: 0 })).toBe(won)
    expect(reducer(won, { type: "moveCursor", dx: 1 })).toBe(won)
    expect(reducer(won, { type: "resolve" })).toBe(won)
  })

  test("the same card never flips twice", () => {
    const state = deckState(fullDeck())
    const once = reducer(state, { type: "flip", index: 0 })
    expect(once.flipped).toEqual([0])
    expect(once.moves).toBe(1)
    expect(reducer(once, { type: "flip", index: 0 })).toBe(once)
  })

  test("a matching pair locks both cards and clears flipped", () => {
    const state = deckState([1, 1, 2, 2])
    const first = reducer(state, { type: "flip", index: 0 })
    const matched = reducer(first, { type: "flip", index: 1 })
    expect(matched.matched).toEqual([1])
    expect(matched.flipped).toEqual([])
    expect(matched.resolving).toBe(false)
    expect(matched.moves).toBe(2)
  })

  test("matched cells refuse to open again", () => {
    const state = deckState([1, 1, 2, 2])
    const matched = reducer(reducer(state, { type: "flip", index: 0 }), {
      type: "flip",
      index: 1,
    })
    expect(reducer(matched, { type: "flip", index: 0 })).toBe(matched)
    expect(reducer(matched, { type: "flip", index: 1 })).toBe(matched)
  })

  test("a mismatch goes face-up in resolving mode", () => {
    const state = deckState([1, 1, 2, 2])
    const first = reducer(state, { type: "flip", index: 0 })
    const second = reducer(first, { type: "flip", index: 2 })
    expect(second.flipped).toEqual([0, 2])
    expect(second.moves).toBe(2)
    expect(second.resolving).toBe(true)
    // While resolving, every further flip is ignored.
    expect(reducer(second, { type: "flip", index: 1 })).toBe(second)
  })

  test("resolve flips a mismatch back, and only after resolving", () => {
    const state = deckState([1, 1, 2, 2])
    const running = reducer(state, { type: "flip", index: 0 })
    expect(reducer(running, { type: "resolve" })).toBe(running)

    const mismatched = reducer(running, { type: "flip", index: 2 })
    const resolved = reducer(mismatched, { type: "resolve" })
    expect(resolved.flipped).toEqual([])
    expect(resolved.resolving).toBe(false)
    expect(resolved.matched).toEqual([])
    expect(resolved.moves).toBe(2)
    // The pair is playable again.
    const rematch = reducer(resolved, { type: "flip", index: 0 })
    expect(rematch.flipped).toEqual([0])
  })

  test("matching every pair wins with moves = flips made", () => {
    let state = deckState(fullDeck())
    for (let pair = 0; pair < PAIRS; pair++) {
      const a = pair * 2
      const b = pair * 2 + 1
      state = reducer(state, { type: "flip", index: a })
      state = reducer(state, { type: "flip", index: b })
      expect(state.status).toBe(pair === PAIRS - 1 ? "won" : "running")
    }
    expect(state.matched.length).toBe(PAIRS)
    expect(state.moves).toBe(CARDS)
  })
})

describe("moveCursor", () => {
  test("cursor wraps at both edges", () => {
    const state = deckState(fullDeck())
    expect(
      reducer({ ...state, cursor: 0 }, { type: "moveCursor", dx: -1 }).cursor
    ).toBe(CARDS - 1)
    expect(
      reducer(
        { ...state, cursor: CARDS - 1 },
        { type: "moveCursor", dx: 1 }
      ).cursor
    ).toBe(0)
    expect(
      reducer({ ...state, cursor: 4 }, { type: "moveCursor", dx: 1 }).cursor
    ).toBe(5)
  })

  test("cursor does not move while idle", () => {
    expect(reducer(initialState, { type: "moveCursor", dx: 1 })).toBe(
      initialState
    )
  })
})

describe("full lifecycle", () => {
  test("with a stubbed random, deals two of each and clears the board", () => {
    let state = freshGame()
    expect(state.status).toBe("running")
    expect(state.cards).toHaveLength(CARDS)
    for (let value = 1; value <= PAIRS; value++) {
      expect(state.cards.filter((card) => card.value === value)).toHaveLength(2)
    }

    // Match each pair exactly as dealt.
    for (let value = 1; value <= PAIRS; value++) {
      const indices = state.cards
        .map((card, index) => (card.value === value ? index : -1))
        .filter((index) => index !== -1)
      state = reducer(state, { type: "flip", index: indices[0] })
      state = reducer(state, { type: "flip", index: indices[1] })
      expect(state.matched.length).toBe(value)
    }
    expect(state.status).toBe("won")
    expect(state.moves).toBe(CARDS)
  })
})