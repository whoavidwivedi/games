// Pure Breakout rules: paddle, ball physics, brick clearing. No React, no DOM.

import { toggle, clamp, clampDt } from "./game-shared"

export const COLS = 8
export const ROWS = 5
/** Paddle width (% of board). */
export const PADDLE_W = 18
/** Paddle height (% of board). */
export const PADDLE_H = 3
/** Paddle travel speed, board widths per second. */
const PADDLE_SPEED = 62
/** Ball radius (%), so diameter is 2×BALL_R. */
export const BALL_R = 1.4
/** Ball launch speed, board widths per second. */
export const BALL_SPEED = 30
/** Ball never speeds past this, no matter how many paddle hits it takes. */
const BALL_SPEED_CAP = 44
/** Lives at the start of a game. */
export const LIVES = 3
/** Top of the brick grid (% from the top). */
export const BRICK_TOP = 5
/** Each brick's height (%), so 5 rows occupy the top ~42% of the board. */
export const BRICK_H = 7.5
/** Each brick's width (%). */
export const BRICK_W = 100 / COLS
/** Points per cleared brick. */
const BRICK_POINTS = 10

export type Status = "idle" | "running" | "paused" | "over" | "won"

export type Dir = -1 | 0 | 1

type Ball = {
  x: number
  y: number
  vx: number
  vy: number
}

export type State = {
  /** COLS×ROWS flat, 1 = alive, 0 = cleared. */
  bricks: number[]
  /** Paddle centre (%). */
  paddleX: number
  ball: Ball
  /** True until launched: the ball rides the paddle centre. */
  stuck: boolean
  lives: number
  score: number
  /** Commanded paddle direction (-1 left, 0 stop, 1 right). */
  cmd: Dir
  status: Status
}

type Action =
  | { type: "move"; dir: Dir }
  | { type: "launch" }
  | { type: "tick"; dt: number }
  | { type: "toggle" }
  | { type: "newGame" }

const PAD_MIN = PADDLE_W / 2
const PAD_MAX = 100 - PADDLE_W / 2

/** Clamp a paddle centre so it never leaves the board. */
export function clampPaddle(x: number): number {
  return clamp(x, PAD_MIN, PAD_MAX)
}

/** The ball's resting spot just above the paddle centre. */
function ballOnPaddle(paddleX: number): Ball {
  return { x: paddleX, y: 100 - PADDLE_H - BALL_R, vx: 0, vy: 0 }
}

/** The x span of a brick cell. */
function brickLeft(col: number): number {
  return col * BRICK_W
}

/** The y span of a brick cell. */
function brickTop(row: number): number {
  return BRICK_TOP + row * BRICK_H
}

/** A full wall of bricks. */
function fullBricks(): number[] {
  return Array<number>(COLS * ROWS).fill(1)
}

export function freshGame(): State {
  return {
    bricks: fullBricks(),
    paddleX: 50,
    ball: ballOnPaddle(50),
    stuck: true,
    lives: LIVES,
    score: 0,
    cmd: 0,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

/** The brick index (row-major) hit by the ball this tick, if any, plus the
 *  face that should reflect it (see reflectOff). */
function brickHit(
  bricks: number[],
  bx: number,
  by: number
): { index: number; col: number; row: number; face: "l" | "r" | "t" | "b" } | null {
  let best: { col: number; row: number; face: "l" | "r" | "t" | "b" } | null = null
  let bestDepth = Infinity
  for (let i = 0; i < bricks.length; i++) {
    if (!bricks[i]) continue
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const bl = brickLeft(col)
    const br = bl + BRICK_W
    const bt = brickTop(row)
    const bb = bt + BRICK_H
    if (bx < bl - BALL_R || bx > br + BALL_R) continue
    if (by < bt - BALL_R || by > bb + BALL_R) continue
    const depthLeft = bx - (bl - BALL_R)
    const depthRight = br + BALL_R - bx
    const depthTop = by - (bt - BALL_R)
    const depthBottom = bb + BALL_R - by
    const depth = Math.min(depthLeft, depthRight, depthTop, depthBottom)
    if (depth < bestDepth) {
      bestDepth = depth
      best = {
        col,
        row,
        face:
          depth === depthLeft
            ? "l"
            : depth === depthRight
              ? "r"
              : depth === depthTop
                ? "t"
                : "b",
      }
    }
  }
  if (!best) return null
  return { index: best.row * COLS + best.col, col: best.col, row: best.row, face: best.face }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "move": {
      if (state.status !== "running") return state
      if (action.dir !== -1 && action.dir !== 0 && action.dir !== 1) return state
      if (state.cmd === action.dir) return state
      return { ...state, cmd: action.dir }
    }

    case "launch": {
      if (state.status !== "running") return state
      if (!state.stuck) return state
      const vx = (Math.random() * 2 - 1) * 8
      const vy = -Math.sqrt(Math.max(BALL_SPEED * BALL_SPEED - vx * vx, 1))
      return { ...state, stuck: false, ball: { ...state.ball, vx, vy } }
    }

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame": {
      return freshGame()
    }

    case "tick": {
      if (state.status !== "running") return state
      const dt = clampDt(action.dt)
      if (dt === 0) return state

      const paddleX = clampPaddle(state.paddleX + state.cmd * PADDLE_SPEED * dt)
      if (state.stuck) {
        return { ...state, paddleX, ball: { ...state.ball, x: paddleX } }
      }

      let bx = state.ball.x + state.ball.vx * dt
      let by = state.ball.y + state.ball.vy * dt
      let vx = state.ball.vx
      let vy = state.ball.vy

      // Side and ceiling walls bounce the ball elastically.
      if (bx - BALL_R <= 0) {
        bx = BALL_R
        vx = -vx
      } else if (bx + BALL_R >= 100) {
        bx = 100 - BALL_R
        vx = -vx
      }
      if (by - BALL_R <= 0) {
        by = BALL_R
        vy = -vy
      }

      // Paddle: the hit angle comes from where the ball meets it; the ball
      // leaves a touch faster, up to the cap.
      const paddleTop = 100 - PADDLE_H
      if (
        vy > 0 &&
        by + BALL_R >= paddleTop &&
        by - BALL_R <= 100 &&
        bx >= paddleX - PADDLE_W / 2 - BALL_R &&
        bx <= paddleX + PADDLE_W / 2 + BALL_R
      ) {
        by = paddleTop - BALL_R
        const speed = Math.min(Math.hypot(vx, vy) * 1.04, BALL_SPEED_CAP)
        const offset = Math.min(1, Math.max(-1, (bx - paddleX) / (PADDLE_W / 2)))
        const rad = (offset * 55 * Math.PI) / 180
        vx = Math.sin(rad) * speed
        vy = -Math.cos(rad) * speed
      }

      // Bricks: clear everything the ball overlaps, then reflect off the
      // face it penetrated most shallowly.
      let score = state.score
      let bricks = state.bricks
      const hit = brickHit(bricks, bx, by)
      if (hit) {
        const bl = brickLeft(hit.col)
        const br = bl + BRICK_W
        const bt = brickTop(hit.row)
        const bb = bt + BRICK_H
        bricks = bricks.slice()
        bricks[hit.index] = 0
        score += BRICK_POINTS

        if (hit.face === "l") {
          bx = bl - BALL_R
          vx = -Math.abs(vx)
        } else if (hit.face === "r") {
          bx = br + BALL_R
          vx = Math.abs(vx)
        } else if (hit.face === "t") {
          by = bt - BALL_R
          vy = -Math.abs(vy)
        } else {
          by = bb + BALL_R
          vy = Math.abs(vy)
        }
      }

      const next = { ...state, paddleX, bricks, score, ball: { x: bx, y: by, vx, vy } }

      if (by - BALL_R > 100) {
        const lives = state.lives - 1
        if (lives <= 0) {
          return { ...next, lives, stuck: true, ball: ballOnPaddle(paddleX), status: "over" }
        }
        return { ...next, lives, stuck: true, ball: ballOnPaddle(paddleX) }
      }
      if (bricks.every((alive) => alive === 0)) {
        return { ...next, status: "won" }
      }
      return next
    }
  }
}