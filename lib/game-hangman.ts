// Pure Hangman rules: no React, no DOM. The component only renders state.

export const MAX_WRONG = 6

/** Short common words, lowercase, no repeats, no repeated letters (so a word
 *  is solved as soon as every unique letter in it has been guessed). */
export const WORDS: string[] = [
  "blitz",
  "crypt",
  "dwarf",
  "fable",
  "ghost",
  "hiker",
  "ivory",
  "jumpy",
  "lynx",
  "mirth",
  "north",
  "opera",
  "plumb",
  "quilt",
  "ridge",
  "slimy",
  "trunk",
  "vital",
  "wheat",
  "zebra",
]

export type Status = "idle" | "running" | "paused" | "over" | "won"

export type State = {
  word: string
  /** Letters tried so far, in the order they were guessed. */
  guessed: string[]
  wrong: number
  /** Consecutive words solved back-to-back; a loss resets it to 0. */
  streak: number
  status: Status
}

type Action =
  | { type: "guess"; letter: string }
  | { type: "toggle" }
  | { type: "newGame" }

export function pickWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}

/** True once every unique letter of `word` has been guessed. */
function isSolved(word: string, guessed: string[]): boolean {
  return [...new Set(word)].every((letter) => guessed.includes(letter))
}

export function freshGame(): State {
  return {
    word: pickWord(),
    guessed: [],
    wrong: 0,
    streak: 0,
    status: "running",
  }
}

// The initial board must match between server HTML and client hydration, so
// the idle word is deterministic; fresh words are random once play starts.
export const initialState: State = {
  word: WORDS[0],
  guessed: [],
  wrong: 0,
  streak: 0,
  status: "idle",
}

/** Deal the next word. A solved word counts toward the streak; anything else
 *  keeps its value (losses already reset it to 0 in the reducer). */
function nextWord(state: State, streak: number): State {
  return { word: pickWord(), guessed: [], wrong: 0, streak, status: "running" }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "guess": {
      if (state.status !== "running") return state
      const letter = action.letter
      if (state.guessed.includes(letter)) return state
      const guessed = [...state.guessed, letter]

      if (state.word.includes(letter)) {
        const solved = isSolved(state.word, guessed)
        // The streak counts up on the NEXT newGame, so a fast "Play again"
        // click still earns it.
        return solved ? { ...state, guessed, status: "won" } : { ...state, guessed }
      }

      const wrong = state.wrong + 1
      if (wrong >= MAX_WRONG) {
        return { ...state, guessed, wrong, status: "over", streak: 0 }
      }
      return { ...state, guessed, wrong }
    }

    case "toggle": {
      if (state.status === "running") return { ...state, status: "paused" }
      if (state.status === "paused") return { ...state, status: "running" }
      if (state.status === "won") return nextWord(state, state.streak + 1)
      return freshGame()
    }

    case "newGame":
      return nextWord(state, state.status === "won" ? state.streak + 1 : state.streak)
  }
}