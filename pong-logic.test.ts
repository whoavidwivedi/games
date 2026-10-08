import { describe, expect, test } from "bun:test"

import { stubMathRandom, toggleLifecycle } from "@/test-helpers"

import {
  BALL_R,
  BALL_SPEED,
  PAD_MAX,
  PAD_MIN,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  SERVE_IN,
  WIN_SCORE,
  freshGame,
  initialState,
  reducer,
  type State,
  type Status,
} from "@/lib/game-pong"

stubMathRandom()

/** A running state with the ball already in play. */
function inPlay(overrides: Partial<State>): State {
  return { ...freshGame(), serveIn: 0, ...overrides }
}

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    const started = toggleLifecycle(reducer, initialState)
    expect(started.serveIn).toBe(SERVE_IN)
  })

  test("newGame resets scores, paddles, and the serve", () => {
    const state: State = {
      ...freshGame(),
      padL: 10,
      padR: 90,
      scoreL: 3,
      scoreR: 4,
      cpu: false,
    }
    const fresh = reducer(state, { type: "newGame" })
    expect(fresh.status).toBe("running")
    expect(fresh.padL).toBe(50)
    expect(fresh.padR).toBe(50)
    expect(fresh.scoreL).toBe(0)
    expect(fresh.scoreR).toBe(0)
    expect(fresh.cpu).toBe(true)
    expect(fresh.serveIn).toBe(SERVE_IN)
    expect(fresh.ball.x).toBe(50)
    expect(fresh.ball.y).toBe(50)
  })

  test("tick and setMove are same-reference no-ops outside running", () => {
    const statuses: Status[] = ["idle", "paused", "over"]
    for (const status of statuses) {
      const state: State = { ...freshGame(), status }
      expect(reducer(state, { type: "tick", dt: 0.1 })).toBe(state)
      expect(reducer(state, { type: "setMove", side: "l", dir: -1 })).toBe(state)
      expect(reducer(state, { type: "setMove", side: "r", dir: 1 })).toBe(state)
    }
  })

  test("toggleCpu flips the mode in any state", () => {
    const state = freshGame()
    expect(state.cpu).toBe(true)
    const flipped = reducer(state, { type: "toggleCpu" })
    expect(flipped.cpu).toBe(false)
    expect(reducer(flipped, { type: "toggleCpu" }).cpu).toBe(true)
    expect(reducer({ ...state, status: "idle" as const }, { type: "toggleCpu" }).cpu).toBe(false)
  })
})

describe("serve freeze", () => {
  test("movement is frozen during serveIn but the countdown still runs", () => {
    const state: State = {
      ...freshGame(),
      serveIn: 0.5,
      cmdL: -1,
      ball: { x: 50, y: 50, vx: -BALL_SPEED, vy: 10 },
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.serveIn).toBeCloseTo(0.45)
    expect(next.padL).toBe(50)
    expect(next.padR).toBe(50)
    expect(next.ball).toEqual(state.ball)
  })

  test("when the serve expires the ball starts moving", () => {
    const state: State = { ...freshGame(), serveIn: 0.03 }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.serveIn).toBe(0)
    expect(next.ball.x).not.toBe(50)
  })
})

describe("ball physics", () => {
  test("ball bounces off the top wall", () => {
    const state = inPlay({ ball: { x: 50, y: BALL_R + 0.4, vx: 0, vy: -BALL_SPEED } })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.ball.y).toBeGreaterThanOrEqual(BALL_R)
    expect(next.ball.vy).toBeGreaterThan(0)
  })

  test("ball bounces off the bottom wall", () => {
    const state = inPlay({ ball: { x: 50, y: 100 - BALL_R - 0.4, vx: 0, vy: BALL_SPEED } })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.ball.y).toBeLessThanOrEqual(100 - BALL_R)
    expect(next.ball.vy).toBeLessThan(0)
  })

  test("left paddle hit reflects the ball to the right", () => {
    const state = inPlay({
      padL: 50,
      ball: { x: PADDLE_W + BALL_R + 0.4, y: 50, vx: -BALL_SPEED, vy: 0 },
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.ball.vx).toBeGreaterThan(0)
    expect(next.ball.x).toBeCloseTo(PADDLE_W + BALL_R)
  })

  test("right paddle hit reflects the ball to the left", () => {
    const state = inPlay({
      padR: 50,
      ball: { x: 100 - PADDLE_W - BALL_R - 0.4, y: 50, vx: BALL_SPEED, vy: 0 },
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.ball.vx).toBeLessThan(0)
    expect(next.ball.x).toBeCloseTo(100 - PADDLE_W - BALL_R)
  })

  test("paddles move toward their commanded direction", () => {
    const state = inPlay({
      cpu: false,
      cmdL: -1,
      cmdR: 1,
      ball: { x: 50, y: 5, vx: 0, vy: 0 },
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.padL).toBeCloseTo(50 - PADDLE_SPEED * 0.05)
    expect(next.padR).toBeCloseTo(50 + PADDLE_SPEED * 0.05)
  })

  test("dt is clamped so a huge frame only advances a small step", () => {
    const state = inPlay({
      cpu: false,
      cmdL: -1,
      cmdR: 1,
      ball: { x: 50, y: 5, vx: BALL_SPEED, vy: 0 },
    })
    const next = reducer(state, { type: "tick", dt: 10 })
    expect(next.padL).toBeCloseTo(50 - PADDLE_SPEED * 0.05)
    expect(next.padR).toBeCloseTo(50 + PADDLE_SPEED * 0.05)
    expect(next.ball.x).toBeCloseTo(50 + BALL_SPEED * 0.05)
  })
})

describe("scoring", () => {
  test("passing the left wall scores for the right side and re-serves", () => {
    const mid = reducer(
      inPlay({ padL: 20, ball: { x: 0.5, y: 50, vx: -BALL_SPEED, vy: 0 } }),
      { type: "tick", dt: 0.05 }
    )
    expect(mid.scoreR).toBe(0)
    const next = reducer(mid, { type: "tick", dt: 0.05 })
    expect(next.scoreR).toBe(1)
    expect(next.scoreL).toBe(0)
    expect(next.ball.x).toBe(50)
    expect(next.serveIn).toBe(SERVE_IN)
    // The loser (left) receives: the re-serve heads left.
    expect(next.ball.vx).toBeLessThan(0)
  })

  test("passing the right wall scores for the left side", () => {
    const next = reducer(
      inPlay({ padR: 80, ball: { x: 100.5, y: 50, vx: BALL_SPEED, vy: 0 } }),
      { type: "tick", dt: 0.05 }
    )
    expect(next.scoreL).toBe(1)
    expect(next.ball.vx).toBeGreaterThan(0)
  })

  test("reaching WIN_SCORE ends the game and freezes further ticks", () => {
    const state = inPlay({
      padL: 20,
      scoreR: WIN_SCORE - 1,
      ball: { x: 0.5, y: 50, vx: -BALL_SPEED, vy: 0 },
    })
    const first = reducer(state, { type: "tick", dt: 0.05 })
    const end = reducer(first, { type: "tick", dt: 0.05 })
    expect(end.status).toBe("over")
    expect(end.scoreR).toBe(WIN_SCORE)
    expect(reducer(end, { type: "tick", dt: 0.05 })).toBe(end)
  })
})

describe("CPU and full run with stubbed random", () => {
  test("the CPU paddle tracks the ball and stays inside the board", () => {
    let state = freshGame()
    let steps = 0
    while (state.status === "running" && steps < 10_000) {
      // The human paddle constantly dashes away to the bottom so the ball
      // always slips past it; the CPU returns everything coming its way.
      state = reducer(state, { type: "setMove", side: "l", dir: 1 })
      state = reducer(state, { type: "tick", dt: 0.05 })
      expect(state.padL).toBeGreaterThanOrEqual(PAD_MIN)
      expect(state.padL).toBeLessThanOrEqual(PAD_MAX)
      expect(state.padR).toBeGreaterThanOrEqual(PAD_MIN)
      expect(state.padR).toBeLessThanOrEqual(PAD_MAX)
      expect(state.ball.y).toBeGreaterThan(0)
      expect(state.ball.y).toBeLessThan(100)
      steps++
    }
    expect(steps).toBeLessThan(10_000)
    expect(state.status).toBe("over")
    // The runaway left paddle never blocks a ball, so the CPU wins 5–0.
    expect(state.scoreR).toBe(WIN_SCORE)
    expect(state.scoreL).toBe(0)
  })

  test("paddle span never exceeds the board", () => {
    expect(PAD_MIN).toBe(PADDLE_H / 2)
    expect(PAD_MAX).toBe(100 - PADDLE_H / 2)
  })
})