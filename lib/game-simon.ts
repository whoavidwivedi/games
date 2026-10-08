// Pure Simon rules: no React, no DOM. The component only renders state.

import { toggle } from "./game-shared"

export const PADS = 4
export const WIN_LEN = 20

export type Status = "idle" | "running" | "paused" | "over" | "won"
export type Phase = "show" | "input"

export type State = {
  /** Pad ids 0..3 in the order they were shown. */
  seq: number[]
  phase: Phase
  /** Index into `seq` of the pad currently lit during "show". */
  showPos: number
  /** Next pad the player must press during "input". */
  inputIdx: number
  /** Longest sequence completed so far. */
  score: number
  status: Status
}

type Action =
  | { type: "begin" }
  | { type: "step" }
  | { type: "press"; pad: number }
  | { type: "toggle" }
  | { type: "newGame" }

function randomPad(): number {
  return Math.floor(Math.random() * PADS)
}

export function freshGame(): State {
  return {
    seq: [randomPad()],
    phase: "show",
    showPos: 0,
    inputIdx: 0,
    score: 0,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

/** The only place a sequence grows: append a new random pad after a round is
 *  completed. Used by `begin` (input-completed) and straight from `press`
 *  completion, so the component never races a follow-up dispatch. */
function appendRound(state: State): State {
  const seq = [...state.seq, randomPad()]
  const score = seq.length - 1
  if (seq.length === WIN_LEN) {
    return { ...state, seq, score, status: "won", phase: "show", showPos: 0, inputIdx: 0 }
  }
  return { ...state, seq, score, phase: "show", showPos: 0, inputIdx: 0 }
}

/** Start a fresh round (from idle/over/won) or continue after a completed
 *  round. The component only dispatches it for Start and rematches. */
function begin(state: State): State {
  if (state.status === "idle" || state.status === "over" || state.status === "won") {
    return freshGame()
  }
  if (state.status !== "running" || state.phase !== "input") return state
  if (state.inputIdx !== state.seq.length) return state
  return appendRound(state)
}

function press(state: State, pad: number): State {
  if (state.status !== "running" || state.phase !== "input") return state
  if (pad !== state.seq[state.inputIdx]) {
    return { ...state, status: "over", score: state.seq.length - 1 }
  }
  const inputIdx = state.inputIdx + 1
  if (inputIdx === state.seq.length) {
    // Completed the round: grow the sequence right here in the reducer so
    // tests (and the component) stay deterministic.
    return appendRound({ ...state, inputIdx })
  }
  return { ...state, inputIdx }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "begin":
      return begin(state)

    case "step": {
      if (state.status !== "running" || state.phase !== "show") return state
      const showPos = state.showPos + 1
      if (showPos === state.seq.length) {
        return { ...state, showPos, phase: "input", inputIdx: 0 }
      }
      return { ...state, showPos }
    }

    case "press":
      return press(state, action.pad)

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame":
      return freshGame()
  }
}