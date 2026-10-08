// Pure Whack-a-Mole rules: spawning, hiding, and scoring. No React, no DOM.

import { toggle, clampDt } from "./game-shared"

export const HOLES = 9
/** Round length, seconds. */
export const ROUND = 30
/** Fastest/slowest gap between spawns, seconds. */
export const SPAWN_MIN = 0.6
export const SPAWN_MAX = 1.1
/** How long a mole stays up before ducking, seconds. */
export const HIDE_TIME = 0.9

export type Status = "idle" | "running" | "paused" | "over"

type Mole = {
  hole: number
  /** Seconds left before the mole ducks away. */
  hideIn: number
}

export type State = {
  active: Mole[]
  /** Seconds until the next mole appears. */
  spawnIn: number
  timeLeft: number
  score: number
  status: Status
}

type Action =
  | { type: "tick"; dt: number }
  | { type: "whack"; hole: number }
  | { type: "toggle" }
  | { type: "newGame" }

export function freshGame(): State {
  return {
    active: [],
    spawnIn: SPAWN_MIN,
    timeLeft: ROUND,
    score: 0,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "tick": {
      if (state.status !== "running") return state
      const dt = clampDt(action.dt)
      if (dt === 0) return state

      const timeLeft = state.timeLeft - dt
      if (timeLeft <= 0) return { ...state, timeLeft: 0, status: "over" }

      // Moles duck when their time is up; new ones pop while the timer runs.
      const active = state.active
        .map((mole) => ({ ...mole, hideIn: mole.hideIn - dt }))
        .filter((mole) => mole.hideIn > 0)

      let spawnIn = state.spawnIn - dt
      if (spawnIn <= 0) {
        const taken = new Set(active.map((mole) => mole.hole))
        const empty: number[] = []
        for (let hole = 0; hole < HOLES; hole++) {
          if (!taken.has(hole)) empty.push(hole)
        }
        if (empty.length > 0) {
          const pick = empty[Math.floor(Math.random() * empty.length)]
          active.push({ hole: pick, hideIn: HIDE_TIME })
        }
        spawnIn = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
      }

      return { ...state, active, spawnIn, timeLeft }
    }

    case "whack": {
      if (state.status !== "running") return state
      if (!Number.isInteger(action.hole) || action.hole < 0 || action.hole >= HOLES) return state
      if (!state.active.some((mole) => mole.hole === action.hole)) return state
      const active = state.active.filter((mole) => mole.hole !== action.hole)
      return { ...state, active, score: state.score + 1 }
    }

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame": {
      return freshGame()
    }
  }
}