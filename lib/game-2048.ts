// Pure 2048 rules: no React, no DOM. The component only renders this state.

import { cn } from "@/lib/utils"
import type { Dir } from "./game-shared"

export const SIZE = 4

export type { Dir }
export type Grid = number[]

export type Tile = {
  /** Stable identity: the DOM node (and its slide) survives every move. */
  id: number
  value: number
  row: number
  col: number
  /** This number came from a merge, so its digits pop in. */
  merged?: boolean
  /** A merge input: it slides under its new number and is dropped next move. */
  mergingOut?: boolean
}

/** How far each value sits between the game's card colour (--accent, carried
 * in by the component) and --background: 2 is barely there, 1024 is full
 * card colour. The ink always picks the theme's far side (.tile-ink), so the
 * stronger low-number steps stay readable in both themes. */
const TILE_ALPHA: Record<number, number> = {
  2: 0.14,
  4: 0.22,
  8: 0.32,
  16: 0.42,
  32: 0.52,
  64: 0.62,
  128: 0.72,
  256: 0.82,
  512: 0.92,
  1024: 1,
}

export function tileBackground(value: number): string {
  const alpha = TILE_ALPHA[value] ?? 1
  return `color-mix(in oklch, var(--accent) ${Math.round(alpha * 100)}%, var(--background))`
}

export function tileText(value: number): string {
  const digits = String(value).length
  const size =
    digits <= 2
      ? "text-xl sm:text-2xl"
      : digits === 3
        ? "text-lg sm:text-xl"
        : digits === 4
          ? "text-base sm:text-lg"
          : "text-sm sm:text-base"
  // Dark theme tiles blend from near-black (low values) up to the bright
  // accent (high values): light ink reads on the dark end, and the top end
  // needs the theme's dark ink again.
  return cn(size, "tile-ink", value >= 32 && "tile-ink-hi")
}

// --- Rules -----------------------------------------------------------------

function emptyGrid(): Grid {
  return Array<number>(SIZE * SIZE).fill(0)
}

/** The board as a flat grid. Remnants are skipped: they sit under the
 * result tile that took their cell, so the result is what should count. */
export function gridFromTiles(tiles: Tile[]): Grid {
  const grid = emptyGrid()
  for (const tile of tiles) {
    if (!tile.mergingOut) grid[tile.row * SIZE + tile.col] = tile.value
  }
  return grid
}

export function canMove(grid: Grid): boolean {
  // An empty board has no tile to slide, so it's not "movable" even though it
  // contains no blockers. (The reducer never queries an empty board, but the
  // predicate is meant to answer "does some direction change the board".)
  const anyTile = grid.some((value) => value !== 0)
  if (!anyTile) return false
  if (grid.some((value) => value === 0)) return true

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r * SIZE + c]
      if (c + 1 < SIZE && grid[r * SIZE + c + 1] === value) return true
      if (r + 1 < SIZE && grid[(r + 1) * SIZE + c] === value) return true
    }
  }
  return false
}

/** The four cells of each row/column, ordered in the direction of travel. */
function lines(dir: Dir): number[][] {
  const lines: number[][] = []
  const forward = [0, 1, 2, 3]
  const backward = [3, 2, 1, 0]

  for (let i = 0; i < SIZE; i++) {
    if (dir === "left") lines.push(forward.map((c) => i * SIZE + c))
    if (dir === "right") lines.push(backward.map((c) => i * SIZE + c))
    if (dir === "up") lines.push(forward.map((r) => r * SIZE + i))
    if (dir === "down") lines.push(backward.map((r) => r * SIZE + i))
  }
  return lines
}

/**
 * Slide every tile as far as it can travel in `dir`, merging equal pairs.
 * A merged-away tile lingers as a `mergingOut` remnant so it can slide under
 * the new number; the next move drops it. Survivors keep their ids, so the
 * same DOM node is re-positioned and the browser tweens the slide.
 */
export function moveTiles(
  tiles: Tile[],
  dir: Dir
): { tiles: Tile[]; gained: number; moved: boolean } {
  // Remnants only exist to finish their slide; they never play again.
  const live = tiles.filter((tile) => !tile.mergingOut)
  const byCell = new Map<number, Tile>()
  for (const tile of live) byCell.set(tile.row * SIZE + tile.col, tile)

  const remnants: Tile[] = []
  const survivors: Tile[] = []
  const results: Tile[] = []
  let gained = 0
  let moved = false

  for (const line of lines(dir)) {
    // The line's tiles, ordered from the edge they travel toward.
    const stack = line
      .map((index) => byCell.get(index))
      .filter((tile): tile is Tile => tile !== undefined)

    for (let from = 0, to = 0; from < stack.length; from++, to++) {
      const tile = stack[from]
      const next = stack[from + 1]
      const dest = line[to]
      const row = Math.floor(dest / SIZE)
      const col = dest % SIZE

      if (next && next.value === tile.value) {
        const value = tile.value * 2
        // The front tile becomes the merged number and keeps its id; the
        // back tile lingers underneath so both visibly slide into the merge.
        results.push({ id: tile.id, value, row, col, merged: true })
        remnants.push({ ...next, row, col, mergingOut: true })
        gained += value
        moved = true
        from++ // the pair is spent
      } else {
        if (tile.row !== row || tile.col !== col) moved = true
        survivors.push({ ...tile, row, col })
      }
    }
  }

  // Sorted by id so existing tiles never change DOM order. React moving a
  // node mid-flight would cancel the transition that is sliding it.
  const next = [...remnants, ...survivors, ...results].sort(
    (a, b) => a.id - b.id
  )
  return { tiles: next, gained, moved }
}

export function spawnTile(
  tiles: Tile[],
  seq: number
): { tiles: Tile[]; seq: number } {
  const taken = new Set(tiles.map((tile) => tile.row * SIZE + tile.col))
  const free: number[] = []
  for (let index = 0; index < SIZE * SIZE; index++) {
    if (!taken.has(index)) free.push(index)
  }
  if (free.length === 0) return { tiles, seq }

  const index = free[Math.floor(Math.random() * free.length)]
  const tile: Tile = {
    id: seq,
    value: Math.random() < 0.9 ? 2 : 4,
    row: Math.floor(index / SIZE),
    col: index % SIZE,
  }
  // Appended: `seq` is always the largest id, so id order stays sorted.
  return { tiles: [...tiles, tile], seq: seq + 1 }
}

export function startTiles(): { tiles: Tile[]; seq: number } {
  const first = spawnTile([], 1)
  return spawnTile(first.tiles, first.seq)
}

// --- Reducer (game flow) -----------------------------------------------------
// Same rules as the component, kept pure so the whole lifecycle is testable
// end to end: idle → running → (won/keepPlaying) → over.

export type Status = "idle" | "running" | "won" | "over"

export type GameState = {
  tiles: Tile[]
  /** Next tile id; keeps identities unique across moves. */
  seq: number
  score: number
  status: Status
  reached2048: boolean
}

type GameAction =
  | { type: "newGame" }
  | { type: "keepPlaying" }
  | { type: "move"; dir: Dir }

export const INITIAL_STATE: GameState = {
  tiles: [],
  seq: 1,
  score: 0,
  status: "idle",
  reached2048: false,
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "newGame": {
      const started = startTiles()
      return {
        tiles: started.tiles,
        seq: started.seq,
        score: 0,
        status: "running",
        reached2048: false,
      }
    }
    case "keepPlaying":
      if (state.status !== "won") return state
      return {
        ...state,
        status: canMove(gridFromTiles(state.tiles)) ? "running" : "over",
      }
    case "move": {
      // A board that isn't playing ignores input entirely.
      if (state.status !== "running") return state

      const moved = moveTiles(state.tiles, action.dir)
      // No-op slides don't spawn a tile or touch the score.
      if (!moved.moved) return state

      const spawned = spawnTile(moved.tiles, state.seq)
      const grid = gridFromTiles(spawned.tiles)
      const score = state.score + moved.gained
      const reached2048 = state.reached2048 || grid.some((value) => value >= 2048)

      return {
        tiles: spawned.tiles,
        seq: spawned.seq,
        score,
        reached2048,
        status:
          reached2048 && !state.reached2048
            ? "won"
            : canMove(grid)
              ? "running"
              : "over",
      }
    }
  }
}
