// Pure Frogger rules: hopping, cars, logs, goal slots. No React, no DOM.

import { toggle, clampDt } from "./game-shared"

export const BOARD = 9
/** The five goal slots sit in the even columns of row 0. */
export const GOAL_COLS = [0, 2, 4, 6, 8] as const

export type Status = "idle" | "running" | "paused" | "over" | "won"

type LaneKind = "car" | "log"

type Lane = {
  kind: LaneKind
  /** Movement, cells per second (negative goes left). */
  speed: number
  /** Cells between vehicle starts. */
  spacing: number
  /** Vehicle length in cells. */
  len: number
}

/** One lane definition per moving row, ordered road rows 1-3 then river rows
 *  5-7 (rows 0 goal, 4 safe, 8 start never move). */
export const MOVING_LANES: Lane[] = [
  { kind: "car", speed: 2.2, spacing: 3, len: 1.4 }, // road, row 1
  { kind: "car", speed: -1.8, spacing: 3.5, len: 1.3 }, // road, row 2
  { kind: "car", speed: 1.2, spacing: 2.5, len: 1.4 }, // road, row 3
  { kind: "log", speed: 1.6, spacing: 2.5, len: 2 }, // river, row 5
  { kind: "log", speed: -1.9, spacing: 3, len: 2.2 }, // river, row 6
  { kind: "log", speed: 1.1, spacing: 3.2, len: 2 }, // river, row 7
]

/** Offset index for a moving row (1-3 road, 5-7 river). */
export function offsetIndexForRow(row: number): number {
  if (row >= 1 && row <= 3) return row - 1
  if (row >= 5 && row <= 7) return row - 2
  return -1
}

/** A vehicle range from an offset, [start, start + len). */
export function vehicleRanges(lane: Lane, offset: number): [number, number][] {
  const count = Math.ceil(BOARD / lane.spacing)
  const ranges: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const start = (((offset + i * lane.spacing) % BOARD) + BOARD) % BOARD
    ranges.push([start, start + lane.len])
  }
  return ranges
}

/** True when a vehicle range covers the frog's cell (a half-cell halo). */
function covers(ranges: [number, number][], x: number): boolean {
  return ranges.some(([start, end]) => start < x + 0.5 && end > x - 0.5)
}

type Frog = { x: number; y: number }

export type State = {
  frog: Frog
  /** One scalar per moving lane, advanced by tick. */
  offsets: number[]
  /** Five goal slots, filled or not. */
  goals: boolean[]
  score: number
  status: Status
}

type Action =
  | { type: "hop"; dx: number; dy: number }
  | { type: "tick"; dt: number }
  | { type: "toggle" }
  | { type: "newGame" }

export const START: Frog = { x: 4, y: 8 }

export function freshGame(): State {
  return {
    frog: { ...START },
    offsets: Array<number>(MOVING_LANES.length).fill(0),
    goals: Array<boolean>(GOAL_COLS.length).fill(false),
    score: 0,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hop": {
      if (state.status !== "running") return state
      const dx = action.dx
      const dy = action.dy
      if (dx !== -1 && dx !== 0 && dx !== 1) return state
      if (dy !== -1 && dy !== 0 && dy !== 1) return state
      if (dx === 0 && dy === 0) return state
      const x = Math.min(BOARD - 1, Math.max(0, state.frog.x + dx))
      const y = Math.min(BOARD - 1, Math.max(0, state.frog.y + dy))
      if (x === state.frog.x && y === state.frog.y) return state

      // The top row is the goal bank: an even column is a slot, anything else
      // (or a filled slot) bounces the frog back to the start without points.
      if (y === 0) {
        const slot = GOAL_COLS.indexOf(x as (typeof GOAL_COLS)[number])
        if (slot === -1 || state.goals[slot]) {
          return { ...state, frog: { ...START } }
        }
        const goals = state.goals.slice()
        goals[slot] = true
        const score = state.score + 10
        if (goals.every(Boolean)) {
          return { ...state, frog: { ...START }, goals, score, status: "won" }
        }
        return { ...state, frog: { ...START }, goals, score }
      }

      return { ...state, frog: { x, y } }
    }

    case "tick": {
      if (state.status !== "running") return state
      const dt = clampDt(action.dt)
      if (dt === 0) return state

      // Advance every lane's offset. A frog on a log rides it: since the
      // offset and the frog move by the same delta, the frog stays aligned
      // with its log (and drifts off the edge if the stream carries it).
      let frog = state.frog
      const logIndex = frog.y >= 5 && frog.y <= 7 ? offsetIndexForRow(frog.y) : -1
      if (logIndex !== -1) {
        const lane = MOVING_LANES[logIndex]
        if (covers(vehicleRanges(lane, state.offsets[logIndex]), frog.x)) {
          frog = { ...frog, x: frog.x + lane.speed * dt }
        }
      }
      const offsets = state.offsets.map((offset, index) => {
        const lane = MOVING_LANES[index]
        return (((offset + lane.speed * dt) % BOARD) + BOARD) % BOARD
      })

      // Road lanes: a car sharing the frog's cell kills it.
      for (let row = 1; row <= 3; row++) {
        if (frog.y !== row) continue
        const lane = MOVING_LANES[offsetIndexForRow(row)]
        if (covers(vehicleRanges(lane, offsets[offsetIndexForRow(row)]), frog.x)) {
          return { ...state, offsets, frog, status: "over" }
        }
      }

      // River lanes: off a log (or carried off the board) is wet death.
      for (let row = 5; row <= 7; row++) {
        if (frog.y !== row) continue
        const index = offsetIndexForRow(row)
        const lane = MOVING_LANES[index]
        if (!covers(vehicleRanges(lane, offsets[index]), frog.x)) {
          return { ...state, offsets, frog, status: "over" }
        }
        if (frog.x < -0.5 || frog.x > BOARD - 0.5) {
          return { ...state, offsets, frog, status: "over" }
        }
      }

      return { ...state, offsets, frog }
    }

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame": {
      return freshGame()
    }
  }
}