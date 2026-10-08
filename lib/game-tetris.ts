// Pure Tetris rules: spawning, gravity, locking, row clears. No React, no DOM.

import { toggle, clampDt } from "./game-shared"

/** Square playfield, W columns × H rows (stored flat, row-major). */
export const W = 10
export const H = 10

/** Gravity (seconds between steps) at level 1. */
const GRAVITY_BASE = 0.85
/** Gravity floor, reached as the level climbs. */
const GRAVITY_MIN = 0.12

/** The 7 tetrominoes as 0/1 square matrices (I, J, L, O, S, T, Z). */
export const SHAPES: number[][][] = [
  // I
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // J
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // L
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // O
  [
    [1, 1],
    [1, 1],
  ],
  // S
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  // T
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // Z
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
]

export type Status = "idle" | "running" | "paused" | "over"

type Piece = {
  /** Index into SHAPES. Locked field cells reuse this id. */
  type: number
  /** Cell offsets relative to the piece's top-left matrix corner. */
  cells: { x: number; y: number }[]
}

export type State = {
  /** W*H cells; null is empty, a number is a locked piece id. */
  field: (number | null)[]
  piece: Piece | null
  /** Board position of the piece's matrix corner. */
  pieceX: number
  pieceY: number
  score: number
  /** Total lines cleared (row clears, not pieces). */
  lines: number
  /** Seconds until the next gravity step. */
  dropIn: number
  /** Current level, 1 + floor(lines / 5). */
  level: number
  status: Status
}

type Action =
  | { type: "tick"; dt: number }
  | { type: "move"; dx: -1 | 1 }
  | { type: "rotate" }
  | { type: "softDrop" }
  | { type: "hardDrop" }
  | { type: "toggle" }
  | { type: "newGame" }

/** Seconds between gravity steps at a level. */
export function gravityFor(level: number): number {
  return Math.max(GRAVITY_MIN, GRAVITY_BASE * Math.pow(0.92, level - 1))
}

/** Base score for clearing `lines` rows in one lock (before the level multiplier). */
export function gainedFor(lines: number): number {
  return [0, 100, 300, 500, 800][lines] ?? 0
}

/** Rotate an n×n matrix 90° clockwise (transpose, then flip each row). */
function rotate(shape: number[][]): number[][] {
  const n = shape.length
  const out: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[c][n - 1 - r] = shape[r][c]
    }
  }
  return out
}

/** Every occupied cell of a shape matrix, as x/y offsets. */
export function cellsOf(shape: number[][]): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) cells.push({ x: c, y: r })
    }
  }
  return cells
}

/** Rebuild the piece's square matrix from its cells (top-left anchored), so
 * rotations stay square even for the asymmetric looking I/O pieces. */
function matrixOfCells(cells: { x: number; y: number }[]): number[][] {
  const width = cells.reduce((max, cell) => Math.max(max, cell.x + 1), 0)
  const height = cells.reduce((max, cell) => Math.max(max, cell.y + 1), 0)
  const n = Math.max(width, height)
  const matrix: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0))
  for (const cell of cells) matrix[cell.y][cell.x] = 1
  return matrix
}

/** True when any piece cell at (x, y) leaves the board or hits a locked cell. */
export function collides(
  field: (number | null)[],
  cells: { x: number; y: number }[],
  x: number,
  y: number
): boolean {
  for (const cell of cells) {
    const cx = x + cell.x
    const cy = y + cell.y
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return true
    if (field[cy * W + cx] !== null) return true
  }
  return false
}

/** A new field with the piece's cells stamped in as `type`. */
function merge(
  field: (number | null)[],
  cells: { x: number; y: number }[],
  x: number,
  y: number,
  type: number
): (number | null)[] {
  const next = field.slice()
  for (const cell of cells) {
    next[(y + cell.y) * W + (x + cell.x)] = type
  }
  return next
}

function spawnPiece(type: number = Math.floor(Math.random() * SHAPES.length)) {
  return { type, cells: cellsOf(SHAPES[type]) }
}

/** Centre a piece of `width` cells over the field at row 0. */
function spawnPosition(width: number): { x: number; y: number } {
  return { x: Math.round((W - width) / 2), y: 0 }
}

export function freshGame(pieceType?: number): State {
  const piece = spawnPiece(pieceType)
  const position = spawnPosition(SHAPES[piece.type].length)
  return {
    field: Array<number | null>(W * H).fill(null),
    piece,
    pieceX: position.x,
    pieceY: position.y,
    score: 0,
    lines: 0,
    dropIn: gravityFor(1),
    level: 1,
    status: "running",
  }
}

// The idle board must match between server HTML and client hydration, so the
// opening piece is deterministic; random pieces start once play begins.
export const initialState: State = { ...freshGame(0), status: "idle" }

/** Clear every full row; returns the new field and the number cleared. */
function clearRows(field: (number | null)[]): { field: (number | null)[]; cleared: number } {
  const kept: (number | null)[] = []
  let cleared = 0
  for (let row = 0; row < H; row++) {
    const start = row * W
    const full = field.slice(start, start + W).every((cell) => cell !== null)
    if (full) cleared++
    else kept.push(...field.slice(start, start + W))
  }
  for (let i = 0; i < cleared; i++) {
    kept.unshift(...Array<number | null>(W).fill(null))
  }
  return { field: kept, cleared }
}

/** Drop the piece until it rests, then merge, clear rows, score, and spawn. */
function lock(state: State): State {
  const piece = state.piece
  if (!piece) return state

  const merged = merge(state.field, piece.cells, state.pieceX, state.pieceY, piece.type)
  const clearedRows = clearRows(merged)
  const lines = state.lines + clearedRows.cleared
  const level = 1 + Math.floor(lines / 5)
  const score = state.score + gainedFor(clearedRows.cleared) * state.level

  const nextPiece = spawnPiece()
  const position = spawnPosition(SHAPES[nextPiece.type].length)
  if (collides(clearedRows.field, nextPiece.cells, position.x, position.y)) {
    return {
      ...state,
      field: clearedRows.field,
      piece: nextPiece,
      pieceX: position.x,
      pieceY: position.y,
      score,
      lines,
      level,
      dropIn: gravityFor(level),
      status: "over",
    }
  }
  return {
    ...state,
    field: clearedRows.field,
    piece: nextPiece,
    pieceX: position.x,
    pieceY: position.y,
    score,
    lines,
    level,
    dropIn: gravityFor(level),
    status: "running",
  }
}

/** One gravity step: try to move the piece down; failing that, lock it. */
function drop(state: State): State {
  const piece = state.piece
  if (!piece) return state
  if (!collides(state.field, piece.cells, state.pieceX, state.pieceY + 1)) {
    return { ...state, pieceY: state.pieceY + 1, dropIn: gravityFor(state.level) }
  }
  return lock(state)
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "tick": {
      if (state.status !== "running") return state
      const dt = clampDt(action.dt)
      if (dt === 0) return state
      const dropIn = state.dropIn - dt
      if (dropIn > 0) return { ...state, dropIn }
      return drop(state)
    }

    case "move": {
      if (state.status !== "running") return state
      if (action.dx !== -1 && action.dx !== 1) return state
      if (!state.piece) return state
      if (collides(state.field, state.piece.cells, state.pieceX + action.dx, state.pieceY)) {
        return state
      }
      return { ...state, pieceX: state.pieceX + action.dx }
    }

    case "rotate": {
      if (state.status !== "running") return state
      if (!state.piece) return state
      const cells = cellsOf(rotate(matrixOfCells(state.piece.cells)))
      if (collides(state.field, cells, state.pieceX, state.pieceY)) return state
      return { ...state, piece: { type: state.piece.type, cells } }
    }

    case "softDrop": {
      if (state.status !== "running") return state
      return drop(state)
    }

    case "hardDrop": {
      if (state.status !== "running") return state
      if (!state.piece) return state
      let y = state.pieceY
      while (!collides(state.field, state.piece.cells, state.pieceX, y + 1)) y++
      return lock({ ...state, pieceY: y })
    }

    case "toggle":
      return toggle(state, () => freshGame())

    case "newGame": {
      return freshGame()
    }
  }
}