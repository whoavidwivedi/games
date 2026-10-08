import { toggle, type Dir } from "./game-shared"

export const SIZE = 20
export const TICK_MS = 140
export const MIN_TICK_MS = 70
export const SPEED_STEP_MS = 4
export const BONUS_EVERY = 5
export const BONUS_TTL = 24
export const BONUS_POINTS = 3

export type { Dir }
type Point = { x: number; y: number }
export type Status = "idle" | "running" | "paused" | "over"

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
}

const STEP: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const START: Point[] = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
]

/** Tick interval shrinks with the score, down to a floor. */
export function tickMsFor(score: number): number {
  return Math.max(MIN_TICK_MS, TICK_MS - score * SPEED_STEP_MS)
}

function randomFood(snake: Point[], avoid?: Point | null): Point {
  const free = (p: Point) =>
    !snake.some((s) => s.x === p.x && s.y === p.y) &&
    !(avoid != null && avoid.x === p.x && avoid.y === p.y)

  // Rejection sampling first (expected O(1)); the scan is a full-board fallback
  // so a maxed-out snake can never hang the loop.
  for (let i = 0; i < 8; i++) {
    const p = {
      x: Math.floor(Math.random() * SIZE),
      y: Math.floor(Math.random() * SIZE),
    }
    if (free(p)) return p
  }
  for (let i = 0; i < SIZE * SIZE; i++) {
    const p = { x: i % SIZE, y: Math.floor(i / SIZE) }
    if (free(p)) return p
  }
  return { x: 0, y: 0 } // unreachable: board full
}

export type State = {
  snake: Point[]
  food: Point
  /** Timed bonus fruit, or null when none is on the board. */
  bonus: Point | null
  /** Ticks left before the bonus disappears. */
  bonusTtl: number
  dir: Dir
  pendingDir: Dir
  score: number
  status: Status
}

type Action =
  | { type: "toggle" }
  | { type: "restart" }
  | { type: "turn"; dir: Dir }
  | { type: "tick" }

function freshGame(): State {
  const snake = [...START]
  return {
    snake,
    food: randomFood(snake),
    bonus: null,
    bonusTtl: 0,
    dir: "right",
    pendingDir: "right",
    score: 0,
    status: "running",
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggle":
      return toggle(state, () => freshGame())
    case "restart":
      return freshGame()
    case "turn": {
      if (state.status !== "running") return state
      if (action.dir === state.pendingDir) return state
      if (
        action.dir === OPPOSITE[state.dir] ||
        action.dir === OPPOSITE[state.pendingDir]
      ) {
        return state
      }
      return { ...state, pendingDir: action.dir }
    }
    case "tick": {
      if (state.status !== "running") return state

      const dir = state.pendingDir
      const head = state.snake[0]
      const next = { x: head.x + STEP[dir].x, y: head.y + STEP[dir].y }

      const outside =
        next.x < 0 || next.x >= SIZE || next.y < 0 || next.y >= SIZE
      const ate = next.x === state.food.x && next.y === state.food.y
      const ateBonus =
        state.bonus != null &&
        next.x === state.bonus.x &&
        next.y === state.bonus.y
      const body = ate ? state.snake : state.snake.slice(0, -1)
      const bitItself = body.some((s) => s.x === next.x && s.y === next.y)

      if (outside || bitItself) return { ...state, dir, status: "over" }

      const snake = [next, ...body]

      if (ate) {
        const score = state.score + 1
        // Every Nth fruit puts a timed bonus on the board.
        let bonus = state.bonus
        let bonusTtl = state.bonus ? state.bonusTtl - 1 : 0
        if (score % BONUS_EVERY === 0) {
          bonus = randomFood(snake)
          bonusTtl = BONUS_TTL
        } else if (bonusTtl <= 0) {
          bonus = null
        }
        return {
          ...state,
          snake,
          dir,
          score,
          bonus,
          bonusTtl: bonus ? bonusTtl : 0,
          food: randomFood(snake, bonus),
        }
      }

      if (ateBonus) {
        return {
          ...state,
          snake,
          dir,
          score: state.score + BONUS_POINTS,
          bonus: null,
          bonusTtl: 0,
        }
      }

      const bonusTtl = state.bonus ? state.bonusTtl - 1 : 0
      return {
        ...state,
        snake,
        dir,
        bonus: bonusTtl > 0 ? state.bonus : null,
        bonusTtl: bonusTtl > 0 ? bonusTtl : 0,
      }
    }
  }
}

export const initialState: State = {
  snake: START,
  food: { x: 14, y: 10 },
  bonus: null,
  bonusTtl: 0,
  dir: "right",
  pendingDir: "right",
  score: 0,
  status: "idle",
}

export const KEY_DIRS: Record<string, Dir> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
}