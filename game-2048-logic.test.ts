import { describe, expect, test } from "bun:test"

import { stubMathRandom } from "@/test-helpers"

import {
  INITIAL_STATE,
  SIZE,
  canMove,
  gameReducer,
  gridFromTiles,
  moveTiles,
  spawnTile,
  startTiles,
  type Dir,
  type GameState,
  type Grid,
  type Tile,
} from "@/lib/game-2048"

const DIRS: Dir[] = ["up", "down", "left", "right"]

/** The result's row `rowIndex` as a readable array. */
function row(tiles: Tile[], rowIndex = 0): number[] {
  const grid = gridFromTiles(tiles)
  return grid.slice(rowIndex * SIZE, rowIndex * SIZE + SIZE)
}

/** The result's column `colIndex` as a readable column array. */
function col(tiles: Tile[], colIndex: number): number[] {
  const grid = gridFromTiles(tiles)
  return [0, 1, 2, 3].map((r) => grid[r * SIZE + colIndex])
}

function sum(grid: Grid): number {
  return grid.reduce((total, value) => total + value, 0)
}

function expectHealthy(state: GameState): void {
  const ids = state.tiles.map((tile) => tile.id)
  // Uniqueness: identities never collide across moves or spawns.
  expect(new Set(ids).size).toBe(ids.length)
  // Stable DOM order: ids always come back ascending.
  expect(ids).toEqual([...ids].sort((a, b) => a - b))
  if (ids.length > 0) expect(state.seq).toBeGreaterThan(ids[ids.length - 1])
  for (const tile of state.tiles) {
    expect(tile.value).toBeGreaterThan(0)
    expect(tile.value & (tile.value - 1)).toBe(0) // always a power of two
    expect(tile.row).toBeGreaterThanOrEqual(0)
    expect(tile.row).toBeLessThan(SIZE)
    expect(tile.col).toBeGreaterThanOrEqual(0)
    expect(tile.col).toBeLessThan(SIZE)
  }
  expect(state.score).toBeGreaterThanOrEqual(0)
  expect(["running", "won", "over"]).toContain(state.status)
  // The reached-2048 flag is a faithful mirror of the grid.
  const grid = gridFromTiles(state.tiles)
  const has2048 = grid.some((value) => value >= 2048)
  expect(state.reached2048).toBe(has2048)
}

const nextRandom = stubMathRandom(0x5eedaa55)

function tile(id: number, value: number, row: number, col: number): Tile {
  return { id, value, row, col }
}

const EMPTY = [0, 0, 0, 0]

/** Grid rows as a readable 4×4 matrix, remnant cells resolved. */
function board(tiles: Tile[]): number[][] {
  const grid = gridFromTiles(tiles)
  return [0, 1, 2, 3].map((row) => grid.slice(row * 4, row * 4 + 4))
}

describe("moveTiles", () => {
  test("slides a lone tile to the wall", () => {
    const result = moveTiles([tile(1, 2, 0, 1)], "left")
    expect(result.moved).toBe(true)
    expect(result.gained).toBe(0)
    expect(board(result.tiles)).toEqual([[2, 0, 0, 0], EMPTY, EMPTY, EMPTY])
  })

  test("reports no move when nothing can travel", () => {
    const wall = [
      tile(1, 2, 0, 0),
      tile(2, 4, 0, 1),
      tile(3, 2, 0, 2),
      tile(4, 4, 0, 3),
    ]
    expect(moveTiles(wall, "left").moved).toBe(false)
    expect(moveTiles(wall, "right").moved).toBe(false)
  })

  test("merges an equal pair toward the direction of travel", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 1)], "left")
    expect(result.moved).toBe(true)
    expect(result.gained).toBe(4)
    expect(board(result.tiles)).toEqual([[4, 0, 0, 0], EMPTY, EMPTY, EMPTY])
  })

  test("keeps the merged-away tile as a remnant under the result", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 1)], "left")
    const remnants = result.tiles.filter((t) => t.mergingOut)
    expect(remnants).toHaveLength(1)
    expect(remnants[0].id).toBe(2)
    expect(remnants[0].row).toBe(0)
    expect(remnants[0].col).toBe(0)
    // Remnants never survive a second move.
    const next = moveTiles(result.tiles, "right")
    expect(next.tiles.some((t) => t.mergingOut)).toBe(false)
  })

  test("a tile only merges once per move ([4,4,8] → [8,8])", () => {
    const tiles = [tile(1, 4, 0, 0), tile(2, 4, 0, 1), tile(3, 8, 0, 2)]
    const result = moveTiles(tiles, "left")
    expect(result.gained).toBe(8)
    expect(board(result.tiles)).toEqual([[8, 8, 0, 0], EMPTY, EMPTY, EMPTY])
  })

  test("two pairs in one line both merge ([2,2,2,2] → [4,4])", () => {
    const tiles = [
      tile(1, 2, 0, 0),
      tile(2, 2, 0, 1),
      tile(3, 2, 0, 2),
      tile(4, 2, 0, 3),
    ]
    const result = moveTiles(tiles, "left")
    expect(result.gained).toBe(8)
    expect(board(result.tiles)).toEqual([[4, 4, 0, 0], EMPTY, EMPTY, EMPTY])
  })

  test("merges work vertically", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 2, 1, 0)], "up")
    expect(result.gained).toBe(4)
    expect(board(result.tiles)).toEqual([[4, 0, 0, 0], EMPTY, EMPTY, EMPTY])
  })

  test("tiles queue up at the far edge when moving right", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 4, 0, 2)], "right")
    expect(board(result.tiles)).toEqual([[0, 0, 2, 4], EMPTY, EMPTY, EMPTY])
  })

  test("merging marks the result as popping in", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 1)], "left")
    const merged = result.tiles.filter((t) => t.merged && !t.mergingOut)
    expect(merged).toHaveLength(1)
    expect(merged[0].value).toBe(4)
    expect(merged[0].id).toBe(1) // the front tile becomes the new number
  })

  test("tiles always come back sorted by id (stable DOM order)", () => {
    const result = moveTiles([tile(5, 2, 0, 2), tile(2, 2, 0, 3)], "left")
    const ids = result.tiles.map((t) => t.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })
})

describe("spawnTile", () => {
  test("only ever lands on a free cell", () => {
    const tiles: Tile[] = []
    let next = 1
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (row === 3 && col === 3) continue
        tiles.push(tile(next++, 2, row, col))
      }
    }
    const spawned = spawnTile(tiles, next)
    expect(spawned.tiles).toHaveLength(16)
    expect(spawned.tiles[15].row).toBe(3)
    expect(spawned.tiles[15].col).toBe(3)
    expect(spawned.seq).toBe(next + 1)
  })

  test("startTiles places two tiles with fresh ids", () => {
    const started = startTiles()
    expect(started.tiles).toHaveLength(2)
    expect(started.seq).toBe(3)
    expect(new Set(started.tiles.map((t) => t.id)).size).toBe(2)
  })
})

describe("canMove", () => {
  test("a full board with no equal neighbours is stuck", () => {
    const grid = [
      2,
      4,
      2,
      4, //
      4,
      2,
      4,
      2, //
      2,
      4,
      2,
      4, //
      4,
      2,
      4,
      2,
    ]
    expect(canMove(grid)).toBe(false)
  })

  test("equal neighbours anywhere mean the game continues", () => {
    const grid = [
      2,
      4,
      2,
      4, //
      4,
      2,
      4,
      2, //
      2,
      4,
      2,
      4, //
      4,
      2,
      4,
      4,
    ]
    expect(canMove(grid)).toBe(true)
  })
})

// --- Merge matrix -----------------------------------------------------------

describe("merge matrix (left)", () => {
  const mergeCases: Array<{ in: number[]; out: number[]; gained: number }> = [
    { in: [2, 2, 0, 0], out: [4, 0, 0, 0], gained: 4 },
    { in: [2, 2, 2, 0], out: [4, 2, 0, 0], gained: 4 },
    { in: [2, 2, 2, 4], out: [4, 2, 4, 0], gained: 4 },
    { in: [4, 2, 2, 4], out: [4, 4, 4, 0], gained: 4 },
    { in: [2, 4, 4, 8], out: [2, 8, 8, 0], gained: 8 },
    { in: [4, 4, 8, 8], out: [8, 16, 0, 0], gained: 24 },
    { in: [8, 8, 16, 16], out: [16, 32, 0, 0], gained: 48 },
    { in: [2, 4, 4, 4], out: [2, 8, 4, 0], gained: 8 },
  ]
  test.each(mergeCases)("$in slides to $out", ({ in: input, out: expected, gained }) => {
    const tiles = input
      .map((value, index) => (value === 0 ? null : tile(index + 1, value, 0, index)))
      .filter((tile): tile is Tile => tile !== null)
    const result = moveTiles(tiles, "left")
    expect(result.moved).toBe(true)
    expect(result.gained).toBe(gained)
    expect(row(result.tiles)).toEqual(expected)
  })

  test("a tile never merges twice in one move ([2,4,4] stays apart from the pair)", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 4, 0, 1), tile(3, 4, 0, 2)], "left")
    expect(row(result.tiles)).toEqual([2, 8, 0, 0])
    expect(result.gained).toBe(8)
  })
})

describe("merge matrix (right, up, down mirrors)", () => {
  const mirrorCases: Array<{ in: number[]; out: number[] }> = [
    { in: [2, 2, 2, 4], out: [0, 2, 4, 4] },
    { in: [4, 2, 2, 4], out: [0, 4, 4, 4] },
    { in: [2, 4, 4, 8], out: [0, 2, 8, 8] },
    { in: [4, 4, 8, 8], out: [0, 0, 8, 16] },
  ]
  test.each(mirrorCases)("right: $in slides to $out", ({ in: input, out: expected }) => {
    const tiles = input
      .map((value, index) => (value === 0 ? null : tile(index + 1, value, 0, index)))
      .filter((tile): tile is Tile => tile !== null)
    const result = moveTiles(tiles, "right")
    expect(result.moved).toBe(true)
    expect(row(result.tiles)).toEqual(expected)
  })

  test("up pushes a column to its top wall", () => {
    const tiles = [4, 2, 2, 4].map((value, r) => tile(r + 1, value, r, 0))
    const result = moveTiles(tiles, "up")
    expect(result.gained).toBe(4)
    expect(col(result.tiles, 0)).toEqual([4, 4, 4, 0])
  })

  test("down pushes a column to its bottom wall", () => {
    const tiles = [4, 2, 2, 4].map((value, r) => tile(r + 1, value, r, 0))
    const result = moveTiles(tiles, "down")
    expect(result.gained).toBe(4)
    expect(col(result.tiles, 0)).toEqual([0, 4, 4, 4])
  })
})

describe("gap merges", () => {
  test("equal tiles jump gaps toward the wall ([2,0,2] left)", () => {
    const result = moveTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 2)], "left")
    expect(result.gained).toBe(4)
    expect(row(result.tiles)).toEqual([4, 0, 0, 0])
  })

  test("[2,0,0,2] merges in either direction", () => {
    const tiles = [tile(1, 2, 0, 0), tile(2, 2, 0, 3)]
    expect(row(moveTiles(tiles, "left").tiles)).toEqual([4, 0, 0, 0])
    expect(row(moveTiles(tiles, "right").tiles)).toEqual([0, 0, 0, 4])
  })

  test("a merge across a gap reports the gap closed, not a slide", () => {
    const result = moveTiles([tile(1, 8, 0, 0), tile(2, 8, 0, 2)], "left")
    expect(result.moved).toBe(true)
    expect(row(result.tiles)).toEqual([16, 0, 0, 0])
    expect(result.gained).toBe(16)
  })
})

describe("identity retention", () => {
  test("survivors keep their exact ids while sliding", () => {
    const result = moveTiles([tile(9, 2, 0, 1), tile(4, 4, 0, 2)], "left")
    expect(row(result.tiles)).toEqual([2, 4, 0, 0])
    expect(result.tiles.map((t) => t.id)).toEqual([4, 9])
  })

  test("the merged number keeps the front tile's id", () => {
    const result = moveTiles([tile(7, 2, 0, 0), tile(11, 2, 0, 1)], "left")
    const merged = result.tiles.find((t) => t.merged)
    expect(merged).toBeDefined()
    expect(merged?.id).toBe(7)
    expect(merged?.value).toBe(4)
  })

  test("remnant ids never collide with the result, and remnants drop on the next move", () => {
    const first = moveTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 1)], "left")
    expect(new Set(first.tiles.map((t) => t.id)).size).toBe(first.tiles.length)
    const second = moveTiles(first.tiles, "right")
    expect(second.tiles.every((t) => !t.mergingOut)).toBe(true)
    expect(row(second.tiles)).toEqual([0, 0, 0, 4])
  })

  test("ids stay unique across a long run of slides and merges", () => {
    let tiles: Tile[] = [tile(1, 2, 0, 1), tile(2, 2, 2, 1), tile(3, 8, 3, 3)]
    let seq = 4
    for (let i = 0; i < 50; i++) {
      const moved = moveTiles(tiles, DIRS[i % DIRS.length])
      const spawned = spawnTile(moved.tiles, seq)
      tiles = spawned.tiles
      seq = spawned.seq
      const ids = tiles.map((t) => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe("spawn distribution", () => {
  test("a zero roll lands on the first free cell with a 2", () => {
    Math.random = () => 0
    const spawned = spawnTile([tile(1, 16, 0, 0)], 2)
    expect(spawned.tiles).toHaveLength(2)
    const fresh = spawned.tiles[1]
    expect(fresh.id).toBe(2)
    expect(fresh.row).toBe(0)
    expect(fresh.col).toBe(1)
    expect(fresh.value).toBe(2)
  })

  test("a high roll forces the rare 4", () => {
    Math.random = () => 0.95
    const spawned = spawnTile([], 1)
    expect(spawned.tiles[0].value).toBe(4)
    expect(spawned.seq).toBe(2)
  })

  test("low rolls usually produce 2", () => {
    Math.random = () => 0.1
    const spawned = spawnTile([], 1)
    expect(spawned.tiles[0].value).toBe(2)
  })

  test("across 200 spawns the 4-rate stays near its 10%", () => {
    let fours = 0
    for (let i = 0; i < 200; i++) {
      const spawned = spawnTile([], i + 1)
      expect(spawned.tiles).toHaveLength(1)
      if (spawned.tiles[0].value === 4) fours++
    }
    expect(fours).toBeGreaterThan(5)
    expect(fours).toBeLessThan(50)
  })
})

// --- canMove ≡ brute-force move simulation ------------------------------------

function bruteCanMove(grid: Grid): boolean {
  const tiles: Tile[] = []
  grid.forEach((value, index) => {
    if (value !== 0) {
      tiles.push(tile(index + 1, value, Math.floor(index / SIZE), index % SIZE))
    }
  })
  return DIRS.some((dir) => moveTiles(tiles, dir).moved)
}

function sampledGrids(): Grid[] {
  const samples: Grid[] = []
  // Named edge cases, then seeded mixes so the equivalence check is not just
  // the implementation agreeing with itself on trivia.
  samples.push([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])
  samples.push([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 4])
  samples.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  samples.push([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  samples.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4])
  const withZeros = [0, 0, 0, 2, 2, 4, 4, 8, 16, 32]
  for (let n = 0; n < 400; n++) {
    const grid: Grid = []
    for (let i = 0; i < SIZE * SIZE; i++) {
      grid.push(withZeros[Math.floor(nextRandom() * withZeros.length)])
    }
    samples.push(grid)
  }
  // A full-board pass to stress merge-only situations.
  for (let n = 0; n < 100; n++) {
    const grid: Grid = []
    for (let i = 0; i < SIZE * SIZE; i++) {
      grid.push(withZeros[1 + Math.floor(nextRandom() * (withZeros.length - 1))])
    }
    samples.push(grid)
  }
  return samples
}

describe("canMove equivalence", () => {
  test("canMove matches brute-force move simulation on every sampled grid", () => {
    for (const grid of sampledGrids()) {
      expect(canMove(grid)).toBe(bruteCanMove(grid))
    }
  })
})

// --- Reducer (game flow) -----------------------------------------------------

describe("reducer game flow", () => {
  test("newGame boots into a fresh running board", () => {
    const state = gameReducer(INITIAL_STATE, { type: "newGame" })
    expect(state.status).toBe("running")
    expect(state.tiles).toHaveLength(2)
    expect(state.score).toBe(0)
    expect(state.reached2048).toBe(false)
    expectHealthy(state)
  })

  test("a second newGame replaces the old board entirely", () => {
    const first = gameReducer(INITIAL_STATE, { type: "newGame" })
    const second = gameReducer(
      { ...first, status: "over", score: 999, reached2048: true },
      { type: "newGame" }
    )
    expect(second.score).toBe(0)
    expect(second.status).toBe("running")
    expect(second.reached2048).toBe(false)
    expect(second.tiles).toHaveLength(2)
  })

  test("moves are ignored while idle (same state object)", () => {
    expect(gameReducer(INITIAL_STATE, { type: "move", dir: "left" })).toBe(
      INITIAL_STATE
    )
  })

  test("a slide that changes nothing returns the same state object", () => {
    const state: GameState = {
      tiles: [2, 4, 2, 4].map((value, c) => tile(c + 1, value, 0, c)),
      seq: 5,
      score: 12,
      status: "running",
      reached2048: false,
    }
    expect(gameReducer(state, { type: "move", dir: "left" })).toBe(state)
  })

  test("a successful move spawns exactly one tile and adds its value to the sum", () => {
    const state: GameState = {
      tiles: [tile(1, 2, 0, 0), tile(2, 2, 0, 1)],
      seq: 3,
      score: 0,
      status: "running",
      reached2048: false,
    }
    const next = gameReducer(state, { type: "move", dir: "left" })
    const delta = sum(gridFromTiles(next.tiles)) - sum(gridFromTiles(state.tiles))
    expect(delta === 2 || delta === 4).toBe(true)
    expect(next.score).toBe(4)
    expect(next.tiles.length).toBe(state.tiles.length + 1)
  })

  test("merging two 1024s to 2048 flips the game to won", () => {
    const state: GameState = {
      tiles: [tile(1, 1024, 0, 0), tile(2, 1024, 0, 1)],
      seq: 3,
      score: 0,
      status: "running",
      reached2048: false,
    }
    const next = gameReducer(state, { type: "move", dir: "left" })
    expect(next.status).toBe("won")
    expect(next.score).toBe(2048)
    expect(next.reached2048).toBe(true)
    expect(next.seq).toBe(4)
    expect(next.tiles.some((t) => t.value >= 2048)).toBe(true)
    expectHealthy(next)
  })

  test("keepPlaying resumes a won board that still has moves", () => {
    const won: GameState = {
      tiles: [tile(1, 2048, 0, 0), tile(2, 2, 3, 3)],
      seq: 3,
      score: 2048,
      status: "won",
      reached2048: true,
    }
    const resumed = gameReducer(won, { type: "keepPlaying" })
    expect(resumed.status).toBe("running")
    expect(resumed.tiles.some((t) => t.value === 2048)).toBe(true)
  })

  test("keepPlaying on a won board with no moves left goes straight to over", () => {
    const stuck: GameState = {
      tiles: [
        [2048, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]
        .flat()
        .map((value, index) => tile(index + 1, value, Math.floor(index / 4), index % 4)),
      seq: 17,
      score: 4096,
      status: "won",
      reached2048: true,
    }
    expect(canMove(gridFromTiles(stuck.tiles))).toBe(false)
    const over = gameReducer(stuck, { type: "keepPlaying" })
    expect(over.status).toBe("over")
  })

  test("an over board ignores further moves", () => {
    const over: GameState = {
      tiles: [
        [2048, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]
        .flat()
        .map((value, index) => tile(index + 1, value, Math.floor(index / 4), index % 4)),
      seq: 17,
      score: 4096,
      status: "over",
      reached2048: true,
    }
    expect(gameReducer(over, { type: "move", dir: "down" })).toBe(over)
  })

  test("keepPlaying outside the won state is a no-op", () => {
    const running = gameReducer(INITIAL_STATE, { type: "newGame" })
    expect(gameReducer(running, { type: "keepPlaying" })).toBe(running)
  })
})

describe("seeded full playthrough", () => {
  test("every move preserves identities, sums, and game-flow rules", () => {
    let state = gameReducer(INITIAL_STATE, { type: "newGame" })
    expectHealthy(state)

    for (let step = 0; step < 4000 && state.status === "running"; step++) {
      const prev = state
      const prevSum = sum(gridFromTiles(prev.tiles))
      const dir = DIRS[step % DIRS.length]
      state = gameReducer(state, { type: "move", dir })

      if (state === prev) {
        // A no-op slide: nothing moves, spawns, or scores.
        expect(sum(gridFromTiles(state.tiles))).toBe(prevSum)
      } else {
        // A live move conserves value during merges, then spawns a 2 or 4.
        const delta = sum(gridFromTiles(state.tiles)) - prevSum
        expect(delta === 2 || delta === 4).toBe(true)
        expect(state.score).toBeGreaterThanOrEqual(prev.score)
      }

      if (state.status === "won") {
        state = gameReducer(state, { type: "keepPlaying" })
        expect(["running", "over"]).toContain(state.status)
      }
      if (state.status === "over") {
        const again = gameReducer(state, { type: "move", dir: "left" })
        expect(again).toBe(state)
      }
      expectHealthy(state)
    }
  })
})
