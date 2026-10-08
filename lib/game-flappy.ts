// Pure Flappy rules: physics, spawning, and scoring. No React, no DOM.

import { toggle, clampDt } from "./game-shared"

/** Bird centre, horizontal, as a percentage of the square board. */
export const BIRD_X = 22
/** Bird diameter in board percentages (the board is square). */
export const BIRD_SIZE = 6
/** Collision radius, slightly forgiving next to the visual size. */
const BIRD_R = 2.4
export const PIPE_W = 7
export const GAP = 30
export const GROUND = 6
/** Where the ground surface sits, measured from the top. */
export const GROUND_Y = 100 - GROUND
/** World scroll speed, board widths per second. */
const SPEED = 25
const GRAVITY = 130
/** Upward velocity applied by a flap (negative is up). */
export const FLAP_V = -48
const MAX_FALL = 90
/** Horizontal spacing between consecutive pipes. */
export const SPAWN_GAP = 32
/** Keep the gap this far from the ceiling and the ground. */
const GAP_MARGIN = 6

export type Status = "idle" | "running" | "paused" | "over"

export type Pipe = {
  id: number
  /** Left edge, in board percentages. */
  x: number
  /** Top of the gap, in board percentages from the top. */
  gapTop: number
  passed: boolean
}

export type State = {
  status: Status
  /** Bird centre, percentage from the top of the board. */
  y: number
  /** Vertical velocity in board heights per second (negative is up). */
  v: number
  pipes: Pipe[]
  score: number
  /** Travel remaining until the next pipe spawns. */
  spawnIn: number
  /** Next pipe id. */
  seq: number
}

type Action =
  | { type: "flap" }
  | { type: "toggle" }
  | { type: "restart" }
  | { type: "tick"; dt: number }

function randomGapTop(): number {
  return GAP_MARGIN + Math.random() * (GROUND_Y - GAP - GAP_MARGIN * 2)
}

export function freshGame(): State {
  return {
    status: "running",
    y: 45,
    v: 0,
    pipes: [{ id: 1, x: 100, gapTop: randomGapTop(), passed: false }],
    score: 0,
    spawnIn: SPAWN_GAP,
    seq: 2,
  }
}

export const initialState: State = {
  // Pipe #1 must match between server HTML and client hydration, so its gap
  // is deterministic (centred on the idle bird); later spawns are random.
  ...freshGame(),
  pipes: [{ id: 1, x: 100, gapTop: 45 - GAP / 2, passed: false }],
  status: "idle",
}

function hitsPipe(pipe: Pipe, y: number): boolean {
  const pastLeft = BIRD_X + BIRD_R > pipe.x
  const beforeRight = BIRD_X - BIRD_R < pipe.x + PIPE_W
  if (!pastLeft || !beforeRight) return false
  const gapBottom = pipe.gapTop + GAP
  return y - BIRD_R < pipe.gapTop || y + BIRD_R > gapBottom
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "flap": {
      if (state.status === "idle") return { ...freshGame(), v: FLAP_V }
      if (state.status !== "running") return state
      return { ...state, v: FLAP_V }
    }
    case "toggle":
      return toggle(state, () => freshGame())
    case "restart": {
      return freshGame()
    }
    case "tick": {
      if (state.status !== "running") return state
      // Clamp the frame so a backgrounded tab cannot teleport the bird.
      const dt = clampDt(action.dt)
      if (dt === 0) return state

      // Semi-implicit Euler: velocity first, then position. The ceiling
      // only clamps (the bird may brush it); the ground is fatal.
      let v = Math.min(state.v + GRAVITY * dt, MAX_FALL)
      let y = state.y + v * dt
      if (y < BIRD_SIZE / 2) {
        y = BIRD_SIZE / 2
        v = Math.max(v, 0)
      }
      if (y + BIRD_SIZE / 2 >= GROUND_Y) {
        return { ...state, y: GROUND_Y - BIRD_SIZE / 2, status: "over" }
      }

      // Pipes travel leftward; passing the bird scores exactly once.
      const travel = SPEED * dt
      let gained = 0
      const moved = state.pipes
        .map((pipe) => {
          const next = { ...pipe, x: pipe.x - travel }
          if (!next.passed && next.x + PIPE_W < BIRD_X) {
            gained += 1
            return { ...next, passed: true }
          }
          return next
        })
        .filter((pipe) => pipe.x + PIPE_W > 0)

      let spawnIn = state.spawnIn - travel
      let seq = state.seq
      let pipes = moved
      if (spawnIn <= 0) {
        pipes = [
          ...moved,
          { id: seq, x: 100, gapTop: randomGapTop(), passed: false },
        ]
        spawnIn += SPAWN_GAP
        seq += 1
      }

      const score = state.score + gained
      if (pipes.some((pipe) => hitsPipe(pipe, y))) {
        return { ...state, y, v, pipes, score, spawnIn, seq, status: "over" }
      }
      return { ...state, y, v, pipes, score, spawnIn, seq }
    }
  }
}
