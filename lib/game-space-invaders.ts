// Pure Space Invaders rules: the alien march, shooting, collisions. No React, no DOM.

import { toggle, clamp, clampDt } from "./game-shared"

export const ALIEN_COLS = 6
export const ALIEN_ROWS = 3
/** Alien sprite width (% of board). */
export const ALIEN_W = 8
export const ALIEN_H = 5
/** Horizontal pitch between aliens. */
const ALIEN_GAP = 2.5
/** How far the block drops when it reaches a wall (%). */
export const ALIEN_STEP = 7
/** Player bar geometry (%). */
export const PLAYER_Y = 88
export const PLAYER_W = 12
export const PLAYER_H = 5
const PLAYER_SPEED = 62
/** Player bullet speed, board widths per second. */
const BULLET_SPEED = 55
/** Invader shot speed, board widths per second. */
export const SHOT_SPEED = 40
/** Seconds between random invader shots. */
export const SHOT_INTERVAL = 0.9
/** Seconds between player shots while the trigger is held. */
export const FIRE_INTERVAL = 0.3
/** March speed with a full grid; picks up as the aliens thin out. */
const BASE_SPEED = 3
/** Extra march speed (board widths per second) per alien killed. */
const SPEED_PER_KILL = 0.35

export type Status = "idle" | "running" | "paused" | "over" | "won"

export type Dir = -1 | 0 | 1

export type Alien = {
  col: number
  row: number
  x: number
  y: number
  alive: boolean
}

type Bullet = {
  x: number
  y: number
}

export type State = {
  aliens: Alien[]
  /** Which way the block marches (1 right, -1 left). */
  dir: 1 | -1
  /** Player bullets, flying up. */
  bullets: Bullet[]
  /** Invader shots, falling down. */
  shots: Bullet[]
  /** Player bar centre (%). */
  playerX: number
  /** Commanded player direction. */
  cmd: Dir
  /** The trigger is held: the reducer auto-fires on the cooldown. */
  firing: boolean
  /** Seconds until the held trigger (or a tap) may fire again. */
  cooldown: number
  /** Seconds until the aliens get to shoot. */
  shotIn: number
  score: number
  status: Status
}

type Action =
  | { type: "move"; dir: Dir }
  | { type: "setFire"; on: boolean }
  | { type: "shoot" }
  | { type: "tick"; dt: number }
  | { type: "toggle" }
  | { type: "newGame" }

/** Points for killing an alien, by its row (0 = top). */
export function pointsFor(row: number): number {
  return [30, 20, 10][row] ?? 10
}

/** March speed, faster the fewer aliens are left. */
export function speedFor(alive: number): number {
  return BASE_SPEED + (ALIEN_COLS * ALIEN_ROWS - alive) * SPEED_PER_KILL
}

/** The x of a fresh alien block's left edge (centred on the board). */
function blockLeft(): number {
  return (100 - (ALIEN_COLS * (ALIEN_W + ALIEN_GAP) - ALIEN_GAP)) / 2
}

function freshAliens(): Alien[] {
  const left = blockLeft()
  const aliens: Alien[] = []
  for (let row = 0; row < ALIEN_ROWS; row++) {
    const y = 12 + row * (ALIEN_H + 3)
    for (let col = 0; col < ALIEN_COLS; col++) {
      aliens.push({ col, row, x: left + col * (ALIEN_W + ALIEN_GAP), y, alive: true })
    }
  }
  return aliens
}

export function freshGame(): State {
  return {
    aliens: freshAliens(),
    dir: 1,
    bullets: [],
    shots: [],
    playerX: 50,
    cmd: 0,
    firing: false,
    cooldown: 0,
    shotIn: SHOT_INTERVAL,
    score: 0,
    status: "running",
  }
}

export const initialState: State = { ...freshGame(), status: "idle" }

export function clampPlayer(x: number): number {
  return clamp(x, PLAYER_W / 2, 100 - PLAYER_W / 2)
}

/** Build a shot away from a random column that still has aliens, from its
 *  lowest surviving alien. */
function invaderShot(aliens: Alien[]): Bullet | null {
  const living = aliens.filter((alien) => alien.alive)
  if (living.length === 0) return null
  const cols = Array.from(new Set(living.map((alien) => alien.col)))
  const col = cols[Math.floor(Math.random() * cols.length)]
  const shooter = living
    .filter((alien) => alien.col === col)
    .reduce((lowest, alien) => (alien.y > lowest.y ? alien : lowest))
  return { x: shooter.x + ALIEN_W / 2, y: shooter.y + ALIEN_H }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "move": {
      if (state.status !== "running") return state
      if (action.dir !== -1 && action.dir !== 0 && action.dir !== 1) return state
      if (state.cmd === action.dir) return state
      return { ...state, cmd: action.dir }
    }

    case "setFire": {
      if (state.status !== "running") return state
      return { ...state, firing: action.on }
    }

    case "shoot": {
      if (state.status !== "running") return state
      if (state.cooldown > 0) return state
      return {
        ...state,
        bullets: [...state.bullets, { x: state.playerX, y: PLAYER_Y }],
        cooldown: FIRE_INTERVAL,
      }
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

      // Player bar.
      const playerX = clampPlayer(state.playerX + state.cmd * PLAYER_SPEED * dt)
      let cooldown = Math.max(0, state.cooldown - dt)

      // Held trigger auto-fires on the cooldown.
      let bullets = state.bullets
      if (state.firing && cooldown <= 0) {
        bullets = [...bullets, { x: playerX, y: PLAYER_Y }]
        cooldown = FIRE_INTERVAL
      }

      // The block marches sideways; on wall contact it drops a line and
      // reverses without advancing that tick.
      const alive = state.aliens.filter((alien) => alien.alive)
      const speed = speedFor(alive.length)
      const stepX = state.dir * speed * dt
      const nextX = state.aliens.map((alien) => (alien.alive ? alien.x + stepX : alien.x))
      const aliveNext: number[] = []
      for (let i = 0; i < state.aliens.length; i++) {
        if (state.aliens[i].alive) aliveNext.push(nextX[i])
      }
      let dir = state.dir
      const maxX = Math.max(...aliveNext)
      const minX = Math.min(...aliveNext)
      let aliens: Alien[]
      if (state.dir === 1 && maxX + ALIEN_W >= 100) {
        dir = -1
        aliens = state.aliens.map((alien) => (alien.alive ? { ...alien, y: alien.y + ALIEN_STEP } : alien))
      } else if (state.dir === -1 && minX <= 0) {
        dir = 1
        aliens = state.aliens.map((alien) => (alien.alive ? { ...alien, y: alien.y + ALIEN_STEP } : alien))
      } else {
        aliens = state.aliens.map((alien, i) => (alien.alive ? { ...alien, x: nextX[i] } : alien))
      }

      // Random invader shot on the countdown.
      let shotIn = state.shotIn - dt
      let shots = state.shots
      if (shotIn <= 0) {
        const shot = invaderShot(aliens)
        if (shot) shots = [...shots, shot]
        shotIn = SHOT_INTERVAL
      }

      // Bullets fly; shots fall.
      bullets = bullets
        .map((bullet) => ({ ...bullet, y: bullet.y - BULLET_SPEED * dt }))
        .filter((bullet) => bullet.y > 0)
      shots = shots
        .map((shot) => ({ ...shot, y: shot.y + SHOT_SPEED * dt }))
        .filter((shot) => shot.y < 100)

      // Player bullets kill aliens.
      let score = state.score
      const remaining: Bullet[] = []
      for (const bullet of bullets) {
        const victim = aliens.find(
          (alien) =>
            alien.alive &&
            bullet.x >= alien.x &&
            bullet.x <= alien.x + ALIEN_W &&
            bullet.y >= alien.y &&
            bullet.y <= alien.y + ALIEN_H
        )
        if (!victim) {
          remaining.push(bullet)
          continue
        }
        aliens = aliens.map((alien) =>
          alien === victim ? { ...alien, alive: false } : alien
        )
        score += pointsFor(victim.row)
      }
      bullets = remaining

      // An invader shot hitting the player, or a landing, ends the game.
      const hitPlayer = shots.some(
        (shot) =>
          shot.x >= playerX - PLAYER_W / 2 &&
          shot.x <= playerX + PLAYER_W / 2 &&
          shot.y >= PLAYER_Y &&
          shot.y <= PLAYER_Y + PLAYER_H
      )
      const landed = aliens.some((alien) => alien.alive && alien.y + ALIEN_H >= PLAYER_Y)
      const cleared = aliens.every((alien) => !alien.alive)

      if (hitPlayer || landed || cleared) {
        return {
          ...state,
          aliens,
          dir,
          bullets,
          shots,
          playerX,
          cooldown,
          shotIn,
          score,
          status: cleared ? "won" : "over",
        }
      }

      return { ...state, aliens, dir, bullets, shots, playerX, cooldown, shotIn, score }
    }
  }
}