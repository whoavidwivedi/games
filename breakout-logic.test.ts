import { describe, expect, test } from "bun:test"

import { stubMathRandom, toggleLifecycle, zeroDtTickNoOp } from "@/test-helpers"

import {
  BALL_R,
  BALL_SPEED,
  COLS,
  LIVES,
  PADDLE_H,
  ROWS,
  clampPaddle,
  freshGame,
  initialState,
  reducer,
  type State,
} from "@/lib/game-breakout"

stubMathRandom()

/** A running game with the usual wall of bricks, easily overridden. */
function make(overrides: Partial<State> = {}): State {
  return { ...freshGame(), ...overrides }
}

function emptyBricks(): number[] {
  return Array<number>(COLS * ROWS).fill(0)
}

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    toggleLifecycle(reducer, initialState)
  })

  test("freshGame starts with a full wall and a stuck ball", () => {
    const state = freshGame()
    expect(state.status).toBe("running")
    expect(state.bricks.every((brick) => brick === 1)).toBe(true)
    expect(state.stuck).toBe(true)
    expect(state.lives).toBe(LIVES)
    expect(state.score).toBe(0)
    expect(state.ball.vx).toBe(0)
    expect(state.ball.vy).toBe(0)
  })

  test("newGame resets score, lives, and the wall", () => {
    const played = make({ score: 80, lives: 1, bricks: emptyBricks() })
    const fresh = reducer(played, { type: "newGame" })
    expect(fresh.status).toBe("running")
    expect(fresh.score).toBe(0)
    expect(fresh.lives).toBe(LIVES)
    expect(fresh.stuck).toBe(true)
    expect(fresh.bricks.every((brick) => brick === 1)).toBe(true)
  })
})

describe("no-ops outside running", () => {
  test("move, launch, and tick return the same reference while idle or over", () => {
    for (const status of ["idle", "paused", "over", "won"] as const) {
      const state = { ...freshGame(), status }
      expect(reducer(state, { type: "move", dir: 1 })).toBe(state)
      expect(reducer(state, { type: "launch" })).toBe(state)
      expect(reducer(state, { type: "tick", dt: 0.016 })).toBe(state)
    }
  })

  test("launch is a no-op once the ball is free", () => {
    const state = make({ stuck: false })
    expect(reducer(state, { type: "launch" })).toBe(state)
  })

  test("a zero-dt tick is a no-op", () => {
    zeroDtTickNoOp(reducer, freshGame())
  })
})

describe("paddle and launch", () => {
  test("move stores the commanded direction and is sticky", () => {
    const state = make({ cmd: 0 })
    expect(reducer(state, { type: "move", dir: -1 }).cmd).toBe(-1)
    expect(reducer(state, { type: "move", dir: 0 }).cmd).toBe(0)
    // Same command again is a no-op.
    expect(reducer(state, { type: "move", dir: 0 })).toBe(state)
  })

  test("clampPaddle keeps the paddle fully on screen", () => {
    expect(clampPaddle(-10)).toBe(9)
    expect(clampPaddle(110)).toBe(91)
    expect(clampPaddle(42)).toBe(42)
  })

  test("the stuck ball rides the paddle, and movement never escapes the board", () => {
    let state = make({ paddleX: 50, cmd: 1, ball: { x: 50, y: 96, vx: 0, vy: 0 } })
    for (let i = 0; i < 200; i++) state = reducer(state, { type: "tick", dt: 0.05 })
    expect(state.paddleX).toBe(91)
    expect(state.stuck).toBe(true)
    expect(state.ball.x).toBe(state.paddleX)
    expect(state.ball.vx).toBe(0)
    expect(state.ball.vy).toBe(0)
  })

  test("launch sends the ball straight up at launch speed", () => {
    const state = make({ stuck: true })
    const launched = reducer(state, { type: "launch" })
    expect(launched.stuck).toBe(false)
    expect(Math.hypot(launched.ball.vx, launched.ball.vy)).toBeCloseTo(BALL_SPEED, 5)
    expect(launched.ball.vy).toBeLessThan(0)
  })
})

describe("walls and paddle bounces", () => {
  test("the ball bounces off the side walls", () => {
    const state = make({
      stuck: false,
      bricks: emptyBricks(),
      paddleX: 50,
      ball: { x: 1.6, y: 50, vx: -10, vy: 0 },
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.ball.x).toBe(BALL_R)
    expect(next.ball.vx).toBeGreaterThan(0)
  })

  test("the ball bounces off the ceiling", () => {
    const state = make({
      stuck: false,
      bricks: emptyBricks(),
      ball: { x: 50, y: 1.6, vx: 0, vy: -10 },
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.ball.y).toBe(BALL_R)
    expect(next.ball.vy).toBeGreaterThan(0)
  })

  test("the paddle reflects the ball upward and points it by the hit offset", () => {
    // A ball riding down dead-centre leaves straight up.
    const centre = make({
      stuck: false,
      bricks: emptyBricks(),
      paddleX: 50,
      ball: { x: 50, y: 96, vx: 0, vy: 10 },
    })
    const next = reducer(centre, { type: "tick", dt: 0.05 })
    expect(next.ball.vy).toBeLessThan(0)
    expect(next.ball.y).toBeLessThan(100 - PADDLE_H)
    // A ball hitting off-centre comes off at an angle.
    const angled = make({
      stuck: false,
      bricks: emptyBricks(),
      paddleX: 50,
      ball: { x: 57, y: 96, vx: 0, vy: 10 },
    })
    const nextAngled = reducer(angled, { type: "tick", dt: 0.05 })
    expect(nextAngled.ball.vx).toBeGreaterThan(0)

    expect(centre.ball.vx).toBe(0) // original state untouched
  })
})

describe("bricks and scoring", () => {
  test("clearing a brick scores and breaks only that brick, without mutating input", () => {
    const brickIndex = 3 // row 0, col 3
    const bricks = Array<number>(COLS * ROWS).fill(0)
    bricks[brickIndex] = 1
    const state = make({
      stuck: false,
      bricks,
      ball: { x: 44, y: 6, vx: 0, vy: 10 }, // overlapping row 0, col 3
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.score).toBe(10)
    expect(next.bricks[brickIndex]).toBe(0)
    expect(state.bricks[brickIndex]).toBe(1) // untouched
  })

  test("a ball already past the wall re-bounces and keeps scoring when replayed", () => {
    const brickIndex = 0 // row 0, col 0, spans x[0,12.5] y[5,12.5]
    const bricks = Array<number>(COLS * ROWS).fill(0)
    bricks[brickIndex] = 1
    const state = make({
      stuck: false,
      bricks,
      ball: { x: 6, y: 8, vx: 0, vy: -10 },
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.bricks.every((brick) => brick === 0)).toBe(true)
    expect(next.status).toBe("won")
  })

  test("breaking the final brick flips the game to won", () => {
    const bricks = emptyBricks()
    bricks[0] = 1 // row 0, col 0: spans x[0,12.5] y[5,12.5]
    const state = make({
      stuck: false,
      bricks,
      ball: { x: 6, y: 8, vx: 0, vy: -10 }, // already inside the brick, rising
    })
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.bricks.every((brick) => brick === 0)).toBe(true)
    expect(next.score).toBe(10)
    expect(next.status).toBe("won")
  })

  test("a ball dropping past the floor costs a life; the last one ends the game", () => {
    const fallFrom = (y: number) => ({
      stuck: false,
      bricks: emptyBricks(),
      ball: { x: 50, y, vx: 0, vy: 0 },
    })
    const lost = reducer(make({ ...fallFrom(102), lives: 2 }), { type: "tick", dt: 0.05 })
    expect(lost.lives).toBe(1)
    expect(lost.stuck).toBe(true)
    expect(lost.status).toBe("running")

    const gameOver = reducer(make({ ...fallFrom(102), lives: 1 }), { type: "tick", dt: 0.05 })
    expect(gameOver.lives).toBe(0)
    expect(gameOver.status).toBe("over")
  })

  test("the ball below the floor comes back onto the paddle to resurface", () => {
    const lost = reducer(
      make({
        stuck: false,
        bricks: emptyBricks(),
        ball: { x: 50, y: 102, vx: 0, vy: 0 },
        lives: 2,
      }),
      { type: "tick", dt: 0.05 }
    )
    expect(lost.ball.y).toBe(100 - PADDLE_H - BALL_R)
    expect(lost.ball.x).toBe(lost.paddleX)
  })
})