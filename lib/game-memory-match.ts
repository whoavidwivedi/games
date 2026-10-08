// Pure Memory Match rules: no React, no DOM. The component only renders state.

import { toggle } from "./game-shared"

export const PAIRS = 8
export const CARDS = PAIRS * 2

export type Status = "idle" | "running" | "paused" | "won"

type Card = {
  id: number
  value: number
}

export type State = {
  /** Cards in a fixed deal order; values come from a shuffled deck. */
  cards: Card[]
  /** Card indices face-up and not yet resolved, at most 2. */
  flipped: number[]
  /** Values already paired off. */
  matched: number[]
  /** A mismatch is on screen; extra flips are ignored until `resolve`. */
  resolving: boolean
  /** Keyboard/touch cursor (arrows + Space). */
  cursor: number
  /** Number of cards flipped. */
  moves: number
  status: Status
}

type Action =
  | { type: "flip"; index: number }
  | { type: "resolve" }
  | { type: "moveCursor"; dx: -1 | 1 }
  | { type: "toggle" }
  | { type: "newGame" }

/** Fisher–Yates shuffle of a deck holding two of each value 1..8. */
export function shuffle(): number[] {
  const deck: number[] = []
  for (let value = 1; value <= PAIRS; value++) deck.push(value, value)
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    const tmp = deck[index]
    deck[index] = deck[swap]
    deck[swap] = tmp
  }
  return deck
}

export function freshGame(): State {
  const values = shuffle()
  return {
    cards: values.map((value, index) => ({ id: index + 1, value })),
    flipped: [],
    matched: [],
    resolving: false,
    cursor: 4,
    moves: 0,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "flip":
      return flipAt(state, action.index)

    case "resolve": {
      if (state.status !== "running" || !state.resolving) return state
      return { ...state, flipped: [], resolving: false }
    }

    case "moveCursor": {
      if (state.status !== "running") return state
      return { ...state, cursor: (state.cursor + action.dx + CARDS) % CARDS }
    }

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame":
      return freshGame()
  }
}

function flipAt(state: State, index: number): State {
  if (state.status !== "running") return state
  if (state.resolving) return state
  if (state.flipped.includes(index)) return state
  const value = state.cards[index].value
  if (state.matched.includes(value)) return state

  const flipped = [...state.flipped, index]
  const moves = state.moves + 1
  if (flipped.length < 2) return { ...state, flipped, moves }

  const [first, second] = flipped
  if (state.cards[first].value === state.cards[second].value) {
    const matched = [...state.matched, value]
    const won = matched.length === PAIRS
    return {
      ...state,
      flipped: [],
      matched,
      resolving: false,
      moves,
      status: won ? "won" : "running",
    }
  }

  // Non-matching pair stays face-up until the component dispatches `resolve`
  // after a short beat.
  return { ...state, flipped, resolving: true, moves }
}