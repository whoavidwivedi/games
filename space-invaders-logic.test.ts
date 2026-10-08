import { describe, expect, test } from "bun:test"

import { stubMathRandom, toggleLifecycle, zeroDtTickNoOp } from "@/test-helpers"

import {
  ALIEN_H,
  ALIEN_STEP,
  ALIEN_W,
  ALIEN_COLS,
  ALIEN_ROWS,
  FIRE_INTERVAL,
  PLAYER_Y,
  SHOT_INTERVAL,
  SHOT_SPEED,
  clampPlayer,
  freshGame,
  initialState,
  pointsFor,
  reducer,
  speedFor,
  type Alien,
  type State,
} from "@/lib/game-space-invaders"

stubMathRandom()

function alien(x: number, y: number, row = 0, alive = true): Alien {
  return { col: 0, row, x, y, alive }
}

describe("lifecycle", () => {
  test("initial is idle; toggle starts, pauses, resumes, and restarts", () => {
    toggleLifecycle(reducer, initialState)
  })

  test("freshGame has a full block of 18 aliens, centred", () => {
    const state = freshGame()
    expect(state.aliens).toHaveLength(ALIEN_COLS * ALIEN_ROWS)
    expect(state.aliens.every((alien) => alien.alive)).toBe(true)
    expect(state.dir).toBe(1)
    expect(state.playerX).toBe(50)
    expect(state.score).toBe(0)
    const xs = state.aliens.filter((alien) => alien.row === 0).map((alien) => alien.x)
    expect(Math.min(...xs)).toBeGreaterThan(0)
    expect(Math.max(...xs) + ALIEN_W).toBeLessThanOrEqual(100)
  })

  test("newGame resets score, shots, and the block", () => {
    const played: State = {
      ...freshGame(),
      score: 120,
      bullets: [{ x: 50, y: 10 }],
      shots: [{ x: 50, y: 50 }],
      aliens: freshGame().aliens.map((a) => ({ ...a, alive: false })),
    }
    const fresh = reducer(played, { type: "newGame" })
    expect(fresh.score).toBe(0)
    expect(fresh.bullets).toHaveLength(0)
    expect(fresh.shots).toHaveLength(0)
    expect(fresh.aliens.every((a) => a.alive)).toBe(true)
    expect(fresh.dir).toBe(1)
  })
})

describe("no-ops outside running", () => {
  test("move, setFire, shoot, and tick return the same reference while idle or over", () => {
    for (const status of ["idle", "paused", "over", "won"] as const) {
      const state = { ...freshGame(), status }
      expect(reducer(state, { type: "move", dir: 1 })).toBe(state)
      expect(reducer(state, { type: "setFire", on: true })).toBe(state)
      expect(reducer(state, { type: "shoot" })).toBe(state)
      expect(reducer(state, { type: "tick", dt: 0.05 })).toBe(state)
    }
  })

  test("a zero-dt tick is a no-op", () => {
    zeroDtTickNoOp(reducer, freshGame())
  })
})

describe("the player cannon", () => {
  test("move stores the direction and the tick steps and clamps the player", () => {
    const stored = reducer(freshGame(), { type: "move", dir: 1 })
    expect(stored.cmd).toBe(1)
    const next = reducer(stored, { type: "tick", dt: 0.05 })
    expect(next.playerX).toBeGreaterThan(50)
    const pinned = reducer({ ...stored, playerX: 99 }, { type: "tick", dt: 0.05 })
    expect(pinned.playerX).toBe(clampPlayer(100))
    expect(clampPlayer(100)).toBe(100 - 6)
  })

  test("shoot fires a bullet from the cannon and cools down", () => {
    const fired = reducer(freshGame(), { type: "shoot" })
    expect(fired.bullets).toHaveLength(1)
    expect(fired.bullets[0]).toEqual({ x: 50, y: PLAYER_Y })
    expect(fired.cooldown).toBe(FIRE_INTERVAL)
    // Cooling down: the next shot is a no-op (same reference).
    expect(reducer(fired, { type: "shoot" }).bullets).toHaveLength(1)
  })

  test("a held trigger auto-fires on the cooldown", () => {
    let state = reducer(freshGame(), { type: "setFire", on: true })
    state = reducer(state, { type: "tick", dt: 0.05 })
    expect(state.bullets).toHaveLength(1)
    // Let the ~0.3s cooldown elapse a couple of times over; the held trigger
    // should stack up a second shot (timing is float-friendly past the mark).
    for (let i = 0; i < 10; i++) state = reducer(state, { type: "tick", dt: 0.05 })
    expect(state.bullets).toHaveLength(2)
  })
})

describe("the alien march", () => {
  test("the block creeps sideways, faster as it thins out", () => {
    const state = freshGame()
    const speed = speedFor(ALIEN_COLS * ALIEN_ROWS)
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.aliens[0].x).toBeCloseTo(state.aliens[0].x + speed * 0.05, 10)
    expect(next.dir).toBe(1)
    expect(speedFor(1)).toBeGreaterThan(speed)
  })

  test("touching a wall flips direction and drops a line without advancing", () => {
    const edge = alien(100 - ALIEN_W - 0.01, 12)
    const state: State = { ...freshGame(), aliens: [edge], dir: 1 }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.dir).toBe(-1)
    expect(next.aliens[0].y).toBeCloseTo(12 + ALIEN_STEP, 10)
    expect(next.aliens[0].x).toBeCloseTo(edge.x, 10)
  })

  test("the left wall flips the march right", () => {
    const edge = alien(0.01, 12)
    const state: State = { ...freshGame(), aliens: [edge], dir: -1 }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.dir).toBe(1)
    expect(next.aliens[0].y).toBeCloseTo(12 + ALIEN_STEP, 10)
  })
})

describe("combat", () => {
  test("a player bullet kills the alien it hits and scores by row", () => {
    const state: State = {
      ...freshGame(),
      aliens: [alien(10, 10, 1, true), alien(30, 30, 0, true)],
      bullets: [{ x: 30.6, y: 32.75 }], // rises into the (marching) alien rect
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.score).toBe(pointsFor(0))
    expect(next.aliens[1].alive).toBe(false)
    expect(next.aliens.filter((a) => a.alive)).toHaveLength(1)
    expect(next.bullets).toHaveLength(0)
  })

  test("clearing the last alien wins the round", () => {
    const state: State = {
      ...freshGame(),
      aliens: [alien(30, 30, 0, true)],
      bullets: [{ x: 30.6, y: 32.75 }],
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.status).toBe("won")
    expect(next.score).toBe(30)
  })

  test("an invader shot hitting the player ends the game", () => {
    const state: State = {
      ...freshGame(),
      aliens: [alien(10, 10, 0, true)],
      shots: [{ x: 50, y: PLAYER_Y + 0.5 }],
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.status).toBe("over")
  })

  test("the block landing on the player row ends the game", () => {
    const state: State = {
      ...freshGame(),
      aliens: [alien(10, PLAYER_Y - ALIEN_H + 1, 0, true)],
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.status).toBe("over")
  })

  test("invader shots come from a random column's bottom alien on the countdown", () => {
    const state: State = {
      ...freshGame(),
      shotIn: 0.01,
    }
    const next = reducer(state, { type: "tick", dt: 0.05 })
    expect(next.shots).toHaveLength(1)
    expect(next.shotIn).toBeCloseTo(SHOT_INTERVAL, 6)
    const shot = next.shots[0]
    // The shot spawns at the bottom of its alien and immediately drifts down.
    const moved = next.aliens.filter((a) => a.alive)
    const originatesFromAlien = moved.some(
      (a) =>
        Math.abs(shot.x - (a.x + ALIEN_W / 2)) < 1e-9 &&
        Math.abs(shot.y - SHOT_SPEED * 0.05 - (a.y + ALIEN_H)) < 1e-9
    )
    expect(originatesFromAlien).toBe(true)
  })

  test("kills never mutate the input alien array", () => {
    const target = alien(30, 30, 0, true)
    const state: State = {
      ...freshGame(),
      aliens: [target, alien(10, 10, 1, true)],
      bullets: [{ x: 30.6, y: 32.75 }],
    }
    reducer(state, { type: "tick", dt: 0.05 })
    expect(state.aliens[0].alive).toBe(true)
    expect(state.aliens[1].alive).toBe(true)
  })
})