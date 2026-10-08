// Pure Pong rules: paddles, ball physics, CPU, scoring. No React, no DOM.

import { toggle, clamp, clampDt } from "./game-shared"

/** Paddle thickness (% of board width). */
export const PADDLE_W = 2
/** Paddle height (% of board height). */
export const PADDLE_H = 15
/** Paddle travel speed, board heights per second. */
export const PADDLE_SPEED = 55
/** Ball radius (%), so diameter is 2×BALL_R. */
export const BALL_R = 1.6
/** Ball launch speed, board widths per second. */
export const BALL_SPEED = 26
/** Ball never speeds past this, no matter how many paddle hits it takes. */
const BALL_SPEED_CAP = 46
/** Maximum vertical component after a paddle hit. */
const BALL_ANGLE = 30
/** A side wins when its score reaches this. */
export const WIN_SCORE = 5
/** Seconds the ball stays frozen at centre after a point. */
export const SERVE_IN = 1.2

export type Status = "idle" | "running" | "paused" | "over"

export type Side = "l" | "r"
export type Dir = -1 | 0 | 1

type Ball = {
  /** Centre position, % from the left/top of the square board. */
  x: number
  y: number
  /** Velocity, board widths/heights per second. */
  vx: number
  vy: number
}

export type State = {
  /** Paddle centres (% y). */
  padL: number
  padR: number
  ball: Ball
  scoreL: number
  scoreR: number
  /** Right paddle is CPU-driven in 1P mode. */
  cpu: boolean
  /** Commanded direction per side (-1 up, 0 stop, 1 down). */
  cmdL: Dir
  cmdR: Dir
  /** Seconds the serve stays frozen (ball at centre); movement is frozen too. */
  serveIn: number
  status: Status
}

type Action =
  | { type: "setMove"; side: Side; dir: Dir }
  | { type: "toggleCpu" }
  | { type: "tick"; dt: number }
  | { type: "toggle" }
  | { type: "newGame" }

export const PAD_MIN = PADDLE_H / 2
export const PAD_MAX = 100 - PADDLE_H / 2

/** A serve: ball at the centre with `vx` aimed toward the requested side. */
function serveBall(towardLeft: boolean): Ball {
  return {
    x: 50,
    y: 50,
    vx: towardLeft ? -BALL_SPEED : BALL_SPEED,
    vy: (Math.random() * 2 - 1) * (BALL_ANGLE - 16),
  }
}

/** Manoeuvre a CPU paddle toward the ball, capped at PADDLE_SPEED per second. */
function cpuMove(pad: number, ballY: number, dt: number): number {
  const diff = ballY - pad
  const step = Math.min(Math.abs(diff), PADDLE_SPEED * dt)
  return clamp(diff > 0 ? pad + step : pad - step, PAD_MIN, PAD_MAX)
}

/** Reflect the ball off a paddle centred at `padY`; the hit offset sets the
 * outgoing angle and the hit adds a little speed (toward the cap). */
function reflect(padY: number, ballY: number, speed: number, sign: number): { vx: number; vy: number } {
  const offset = Math.min(1, Math.max(-1, (ballY - padY) / (PADDLE_H / 2)))
  const vy = offset * BALL_ANGLE
  const vx = Math.sqrt(Math.max(speed * speed - vy * vy, 1)) * sign
  return { vx, vy }
}

export function freshGame(): State {
  return {
    padL: 50,
    padR: 50,
    ball: serveBall(Math.random() < 0.5),
    scoreL: 0,
    scoreR: 0,
    cpu: true,
    cmdL: 0,
    cmdR: 0,
    serveIn: SERVE_IN,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setMove": {
      if (state.status !== "running") return state
      if (action.dir !== -1 && action.dir !== 0 && action.dir !== 1) return state
      return action.side === "l"
        ? { ...state, cmdL: action.dir }
        : { ...state, cmdR: action.dir }
    }

    case "toggleCpu": {
      return { ...state, cpu: !state.cpu }
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

      // The serve is a freeze frame: paddles and ball stay put while the
      // countdown runs, so the serve cannot be steered or sniped.
      const serveIn = state.serveIn - dt
      if (serveIn > 0) return { ...state, serveIn }

      // Paddles move toward their commanded directions (or track, on the CPU
      // side). Commands are consumed every tick, so holding requires the
      // component to keep re-dispatching them.
      const padL = clamp(state.padL + state.cmdL * PADDLE_SPEED * dt, PAD_MIN, PAD_MAX)
      const padR = state.cpu
        ? cpuMove(state.padR, state.ball.y, dt)
        : clamp(state.padR + state.cmdR * PADDLE_SPEED * dt, PAD_MIN, PAD_MAX)

      let bx = state.ball.x + state.ball.vx * dt
      let by = state.ball.y + state.ball.vy * dt
      let vx = state.ball.vx
      let vy = state.ball.vy

      // Top/bottom walls.
      if (by - BALL_R <= 0) {
        by = BALL_R
        vy = -vy
      } else if (by + BALL_R >= 100) {
        by = 100 - BALL_R
        vy = -vy
      }

      // Left paddle (its right face is at x = PADDLE_W).
      const hitsLeft =
        vx < 0 &&
        bx + BALL_R >= 0 &&
        bx - BALL_R <= PADDLE_W &&
        by >= padL - PADDLE_H / 2 - BALL_R &&
        by <= padL + PADDLE_H / 2 + BALL_R
      // Right paddle (its left face is at x = 100 - PADDLE_W).
      const hitsRight =
        vx > 0 &&
        bx - BALL_R <= 100 &&
        bx + BALL_R >= 100 - PADDLE_W &&
        by >= padR - PADDLE_H / 2 - BALL_R &&
        by <= padR + PADDLE_H / 2 + BALL_R

      if (hitsLeft) {
        bx = PADDLE_W + BALL_R
        const next = reflect(padL, by, Math.min(Math.hypot(vx, vy) * 1.05, BALL_SPEED_CAP), 1)
        vx = next.vx
        vy = next.vy
      } else if (hitsRight) {
        bx = 100 - PADDLE_W - BALL_R
        const next = reflect(padR, by, Math.min(Math.hypot(vx, vy) * 1.05, BALL_SPEED_CAP), -1)
        vx = next.vx
        vy = next.vy
      }

      // Scoring: the other side scores once the ball fully passes a wall.
      if (bx + BALL_R < 0) {
        const scoreR = state.scoreR + 1
        if (scoreR >= WIN_SCORE) {
          return { ...state, padL, padR, ball: { x: bx, y: by, vx, vy }, scoreR, status: "over" }
        }
        return {
          ...state,
          padL,
          padR,
          ball: serveBall(true),
          scoreR,
          serveIn: SERVE_IN,
        }
      }
      if (bx - BALL_R > 100) {
        const scoreL = state.scoreL + 1
        if (scoreL >= WIN_SCORE) {
          return { ...state, padL, padR, ball: { x: bx, y: by, vx, vy }, scoreL, status: "over" }
        }
        return {
          ...state,
          padL,
          padR,
          ball: serveBall(false),
          scoreL,
          serveIn: SERVE_IN,
        }
      }

      return { ...state, padL, padR, ball: { x: bx, y: by, vx, vy }, serveIn: 0 }
    }
  }
}