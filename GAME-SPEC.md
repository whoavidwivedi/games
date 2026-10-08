# Game build spec — browser-games arcade

Every game on this site follows one shape. When you add a game called **X** with
slug `x`, you create exactly three files and one edit:

1. `lib/game-x.ts` — pure rules (reducer). No React, no DOM.
2. `components/games/x-game.tsx` — the client component ("use client").
3. `x-logic.test.ts` — bun:test suite for the pure logic.
4. Edit `lib/games.ts` — add `href: "/games/x"` to that game's entry.

The route needs no new file: `app/games/[game]/page.tsx` already renders any
game whose slug is in `lib/games.ts` (SSG via `generateStaticParams`).

The rest of these instructions is the canonical template. The chrome (header,
status overlay, footer, keyboard/tick hooks) lives once in
`components/game-chrome.tsx` and `hooks/use-game-*` — the game file only
composes it. Copy the skeleton below exactly.

---

## The shell (every game looks identical here)

The component skeleton below is the template. Differences between games are
only ever: the imports from `@/lib/game-<slug>`, the header badges, the board
markup, the `onKey` body in `useGameKeys`, the swipe wiring, the help steps,
the overlay texts, the footer hint/buttons, whether a high-score store is
used, and the tick hook. See [Chrome props](#chrome-props) for the escape
hatches when a game deviates.

### Shell skeleton (client component)

```tsx
"use client"

import { useEffect, useReducer, useState, useSyncExternalStore } from "react"

import { GameFooter, GameHeader, StatusOverlay } from "@/components/game-chrome"
import { GameScreen } from "@/components/game-screen"
import { HelpOverlay } from "@/components/game-help"
import { PixelScore } from "@/components/pixel-score"
import { useGameFrame, useGameTick } from "@/hooks/use-game-tick"
import { useGameKeys } from "@/hooks/use-game-keys"
import { useSwipe } from "@/hooks/use-swipe"
import { accentVars } from "@/lib/games"
import { createHighScore } from "@/lib/high-score"
import { initialState, reducer, type Status } from "@/lib/game-<slug>"
import { cn } from "@/lib/utils"

// Optional, only for games with a run-based best score:
const highScoreStore = createHighScore("<slug>_best")

const OVERLAY_TEXT: Record<Status, string> = {
  idle: "Press play to start",
  running: "",
  paused: "Paused",
  over: "Game over", // customize per game
}

const HELP_STEPS = [
  "…",
  "…",
  "…",
  "P pauses; R restarts.",
]

export function XGame() {
  const [state, send] = useReducer(reducer, initialState)
  const [helpOpen, setHelpOpen] = useState(false)

  // High score (only if the game persists one). save() no-ops when the score
  // is not a record, so call it directly — no guard needed:
  const storedBest = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.read,
    highScoreStore.readOnServer
  )
  const best = Math.max(storedBest, state.score)
  useEffect(() => {
    highScoreStore.save(state.score)
  }, [state.score])

  // Movement swipes (only for games with direction input):
  const swipe = useSwipe((dir) => send({ type: "move", dir }))

  // Tick cadence, ONE of:
  // useGameTick(state.status, TICK_MS, () => send({ type: "tick" }))      // fixed interval
  // useGameFrame(state.status, (dt) => send({ type: "tick", dt }))        // rAF, dt in seconds

  // Keyboard. The hook owns the repeat-guard, the help overlay (Esc/I closes
  // it), R = restart, P = toggle, and Space/Enter = toggle unless the press
  // landed on a control (those fire on keyup). Per-game keys go in `onKey`
  // and return true when consumed — put ANY key there whose handling differs
  // from those defaults (e.g. space = fire, or 2048 which has no pause).
  useGameKeys({
    helpOpen,
    closeHelp: () => setHelpOpen(false),
    toggle: () => send({ type: "toggle" }),
    restart: () => send({ type: "restart" }), // or { type: "newGame" } per game
    onKey: (key, event) => {
      // per-game keys; return true when handled
    },
  })

  return (
    <GameScreen
      style={accentVars("X Title")}    // exact title from lib/games.ts
      {...(helpOpen ? {} : swipe)}        // only when swipe is used
    >
      <GameHeader
        title="X"
        badges={<>…PixelScore / custom badges…</>}
        steps={HELP_STEPS}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((open) => !open)}
      />

      <div className="game-board relative mx-auto aspect-square shrink-0">
        {/* board markup; overlays sit absolutely inside */}
        <StatusOverlay
          status={state.status}
          label={OVERLAY_TEXT[state.status]}
          onToggle={() => send({ type: "toggle" })}
        >
          {/* extra under the label, e.g. the final score */}
        </StatusOverlay>
        {helpOpen && <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />}
      </div>

      <GameFooter
        status={state.status}
        hint="… P pauses; R restarts."
        onToggle={() => send({ type: "toggle" })}
      />
    </GameScreen>
  )
}
```

### Chrome props (escape hatches when a game deviates)

- `GameHeader`: `title`, `badges` (scores + any custom badge markup), `steps`,
  `helpOpen`, `onToggleHelp`.
- `StatusOverlay`: renders nothing while `status === "running"`. The primary
  button says Resume when paused, "Play again" when the round is *finished*
  (default `status === "over" || "won"`), else Play — override with
  `finished={...}` (which statuses count) or `actionLabel={...}` (the whole
  label), plus `actions` for extra buttons and `children` for an extra line
  under the label. Pointer-down on it is stopped so board taps don't fire
  through the overlay.
- `GameFooter`: `hint`, `onToggle` (the pause button, shown only while the
  round runs), `actions` (minesweeper's flag-mode button), `disabled` (flappy
  while help is open) and `hidePrimaryWhenRunning` (2048 has no pause). Play,
  resume and play-again live on the overlay — the bar never repeats them, and
  there is no restart button: `R` on the keyboard is the mid-round restart.
- Shared reducer helpers: `toggle(state, fresh)` and `clamp(dt)…` in
  `lib/game-shared.ts`; the seeded-random and lifecycle-test helpers live in
  `test-helpers.ts`.
```

### Reducer conventions (pure logic)

- `Status = "idle" | "running" | "paused" | "over"` plus game extras
  (`"won"`, `"draw"`-style state lives in fields).
- `initialState` is the idle state; `freshGame()` returns a running state.
- `toggle`: running→paused, paused→running, idle/over/won→`freshGame()`.
- `newGame`/`restart`: `freshGame()`.
- When a game is not in the right status its actions return `state` unchanged
  (immutable no-op). No-op ticks/moves must **not** create new objects where
  possible — returning the same reference is correct and is tested.
- Pure functions never call random APIs that make tests flaky without a stubbed
  `Math.random`; all randomness is plain `Math.random()` so tests can stub it.

### Lint hard rules (these fail CI)

- No `any`. No `as any`. Casts go through `unknown` (`pass as unknown as Shape`).
- Never read `.current` of a ref during render (JSX). Refs may be read in
  `useEffect`/event handlers/frame loops. If a render-time read is truly
  required, that's a design smell — restructure (imperative setup in effect).
- Never mutate a value returned by `useState`/`useMemo`/`useReducer` or a prop.
  Mutating `ref.current` properties in effects/frame loops is fine.
- Use `import { type X }` for type-only imports.
- `cn()` from `@/lib/utils` for conditional classes.
- No unused imports/variables. No `console.*`.
- Buttons inside the clickable board are real `<Button>`s (Base UI) with
  `onClick` dispatch; the board layer itself handles taps/keys via the game
  screen. Do not nest interactive elements inside interactive elements.

### Style rules

- Arcade square look: `rounded-none` on board cells and game Buttons; `border`
  framing; `bg-background` on empty cells.
- Whole shell identical on mobile and split-screen — never resize cells with
  game state (fixed grid / absolute percentages only).
- Accent is the game colour: use `var(--accent)`, `var(--accent-soft)`,
  `var(--accent-pipe)` from `accentVars(title)`.
- `.px-dither` is the dithered checkerboard fill (uses `--accent-pipe`) — use
  it for patterned board props (memory-card backs, moles, etc.).
- No emojis, no drop shadows, no hover movement. Small SVG icons are fine
  **in-game** (not on the home cards), drawn with `fill="var(--accent)"` or
  `"var(--foreground)"`.
- Score + Best in the header use `PixelScore label value [digits] [variant]`.
  `digits` defaults 4, `variant="outline"` for Best.
- Board overlay (idle/paused/over) text + one Play/Resume/Play-again button.
- Always end the footer hint with the pause/restart keys:
  `"… P pauses; R restarts."` (or “P pauses; R restarts.” alone).

---

## Per-game rules

### tic-tac-toe (slug `tic-tac-toe`, title "Tic-Tac-Toe")
- 3×3 board, local 2-player. First play is X. Alternate turns.
- `State`: `board: Cell[]` (9, `Cell = "x" | "o" | null`), `turn`, `status`,
  `winner: "x" | "o" | "draw" | null`, `xWins`, `oWins`.
- Actions: `place { index }`, `toggle`, `newGame`.
- `newGame`/rematch keeps the win tally; header shows `PixelScore "X" xWins`
  and `PixelScore "O" oWins`. No persisted best.
- Rows of `WIN_LINES` are the 8 lines; `winnerOf(board)` returns the winner or
  "draw" when full and no line.
- Overlay: idle "Press play to start"; over shows "X wins! // O wins! /
  It's a draw" + "Play again" button.
- Hint: "Tap a cell · P pauses; R restarts." Keyboard: keys 1-9 place,
  P pause, R rematch, Space/Enter start.
- Board: `grid grid-cols-3` buttons, 1fr×1fr cells. X = two crossing bars,
  O = ring, both inline SVG, `var(--accent)` / `var(--foreground)`.

### minesweeper (slug `minesweeper`)
- 9×9, 10 mines. `ROWS=COLS=9`, `MINES=10`. Flat arrays of length 81.
- `State`: `mines: boolean[]`, `revealed: boolean[]`, `flagged: boolean[]`,
  `counts: number[]` (mines adjacent, computed from mines), `status`
  (idle/running/paused/over/won), `cursor: number`, `time: number` (seconds).
- `relayout(mines)` recomputes counts. First reveal is always safe: clicking a
  mine with zero reveals moves that mine to the first empty non-mine cell
  (scan index 0 upward).
- Actions: `reveal { index }`, `flag { index }` (right click / F key), `moveCursor { dir }` where dir is "up"|"down"|"left"|"right", `tick` (+1s while running),
  `toggle`, `newGame`.
- Reveal flood-fills zeros (iterative, no recursion blow-up). Winning: every
  non-mine cell revealed → status "won".
- Overlay: idle "Press play to start"; over "Boom" + score(time);
  won "Board cleared" + time. Button "Play again".
- Header badges: `PixelScore "Time" state.time` and
  `PixelScore "Mines" MINES - flaggedCount`. No persisted best.
- Swipe: `moveCursor` (4 dirs). Keys: arrows cursor, Space reveal,
  F/Alt flag, P pause, R restart.
- Hint: "Arrows · Space reveal · F flag · P pause; R restarts."
- Cells: square fl-array grid `grid-cols-9`; revealed cells show the count
  (only 1-8, `text-[var(--accent)]`), mines show a dot/SVG, flags show a small
  triangle SVG or "!" text in `--accent`.

### tetris (slug `tetris`)
- Playfield `W=H=10` (square board, cells exactly square). 7 tetrominoes.
- `SHAPES` are matrices; rotations via `rotate(shape)` (n×n matrix transpose +
  horizontal flip). `cellsOf(shape)` → `{x,y}[]`.
- `State`: `field: (number|null)[]` (W*H, piece ids), `piece` (type index +
  rotation + cells with x,y), `pieceX`, `pieceY`, `score`, `dropIn` (seconds
  until the gravity step), `level` (1 + floor(lines/5)), `status`.
- Gravity: `gravityFor(level) = Math.max(0.12, 0.85 * Math.pow(0.92, level-1))`.
- Actions: `tick { dt }` (clamp dt to 0..0.05 like flappy; deduct from dropIn;
  when ≤0 drop and reset dropIn=gravity), `move { dx: -1|1 }`, `rotate`,
  `softDrop`, `hardDrop`, `toggle`, `newGame`.
- `collides(field, cells, x, y)`; `merge(field, piece)`. On lock: merge, clear
  full rows, score. Score: 1 row ×100, 2 ×300, 3 ×500, 4 ×800, multiplied by
  level; `gainedFor(lines)`.
- New piece spawns at y=-? Simplest: spawn at row 0 centred; if it collides
  immediately → status "over". Random next piece via `Math.random()`.
- Persist `tetris_best` (score).
- Overlay: "Game over" + Score. Header: Score / Best (+ Level badge `PixelScore`).
- Swap with swipe: left/right move, up rotate, down soft drop. Keys:
  arrows/WASD, Space hard drop, P pause, R restart.
- Hint: "←→ move · ↑ rotate · ↓ soft · Space hard drop · P pause; R restarts."
- Board: `grid-cols-10 grid-rows-10`; active piece cells fill `var(--accent)`,
  locked cells `var(--accent-soft)` (or a per-id alpha — keep simple: all
  locked same `--accent-soft`).

### pong (slug `pong`)
- Square board, percentage coordinates. Constants: `PADDLE_W=2`,
  `PADDLE_H=15`, `PADDLE_SPEED=55` (%/s), `BALL_R=1.6`, `BALL_SPEED=26`,
  `WIN_SCORE=5`, `SERVE_IN=1.2`.
- `State`: `padL`, `padR` (y centres), `ball {x,y,vx,vy}`, `scoreL`, `scoreR`,
  `cpu: boolean` (right paddle is CPU in 1P; footer toggles), `serveIn`,
  `status`.
- Actions: `setMove { side: "l"|"r", dir: -1|0|1 }` (stored command per side),
  `toggleCpu`, `tick { dt }`, `toggle`, `newGame`.
- tick: while `serveIn > 0`, count it down and keep the ball frozen at centre
  (or attached to the last scorer's side served toward the loser); paddles
  still move. Otherwise integrate ball position; bounce off top/bottom
  (y walls); paddle hit reflects and speeds up slightly (vx grows up to a cap),
  with angle from hit offset; scoring resets the ball to centre, increments
  score, sets `serveIn`, and at `WIN_SCORE` sets status "over".
- CPU paddle: follows ball y with `min(PADDLE_SPEED, needs)` per second.
- Persist `pong_best` = max(scoreL, scoreR) reached.
- Overlay: "Game over" + final "5 – 3" style score line. Header: P1 / P2
  scores; footer button toggles 1P↔2P ("1P: right = CPU" hint).
- Held keys: component keeps `Set<string>` of pressed keys in a ref, updates
  via keydown/keyup, and that feeds `setMove`/`tick`? — simplest: keydown
  dispatches `setMove` with the new dir per side; keyup dispatches `setMove dir
  0`. Left = W/S, right = ArrowUp/ArrowDown (or ArrowUp/Down + swipe up/down
  mapped to both players alternately in 1P? no — in 1P cpu controls right;
  swipe only drives left in 1P, and right in 2P via on-screen note).
- Hint: "W/S vs ↑/↓ · P pause; R restarts · 1P↔2P toggles CPU".

### breakout (slug `breakout`)
- Board percentage coords. `COLS=8`, `ROWS=5`, `PADDLE_W=18`, `PADDLE_H=3`,
  `PADDLE_SPEED=62`, `BALL_R=1.4`, `BALL_SPEED=30`, `LIVES=3`, brick cell
  `W=COLS`, `H=ROWS` from top margin `BRICK_TOP=5` (%). Each brick 12.5% wide
  × 19% tall? — simpler: rows occupy bands, see lib; points 10 per brick.
- `State`: `bricks: number[]` (0/1), `paddleX` (centre %), `ball {x,y,vx,vy}`
  and `stuck: boolean`, `lives`, `score`, `status` (idle/running/paused/
  over/won).
- Actions: `move { dir: -1|0|1 }`, `launch`, `tick { dt }`, `toggle`,
  `newGame`.
- tick: paddle moves toward the commanded dir; if `stuck`, ball rides the
  paddle centre; else bounce off left/right/top, paddle (reflect + slight speed
  up), brick grid (ball–brick axis collision: for each remaining brick, hit
  when ball centre within the brick rect; reverse the dominant axis, clear the
  brick, +10, speed cap); falling below the floor → life lost: `stuck=true`,
  lives—, status "over" at 0; all bricks cleared → "won".
- Persist `breakout_best`.
- Overlay: idle press-play; over "Game over" + score; won "All clear!" +
  "Play again". Header: Score / Best / Lives.
- Keys: ←→ or A/D move, Space launch, P, R. Swipe left/right moves (also
  launches on down? no — board tap launches). Tap on board → launch when
  stuck.
- Hint: "←→ move · Space launch · P pause; R restarts."

### memory-match (slug `memory-match`)
- 16 cards (8 pairs). `N=4`, `PAIRS=8`.
- `State`: `cards: {id:number, value:number}[]`, `flipped: number[]` (card
  indices, ≤2), `matched: Set<number>` (values), `moves`, `status`
  (idle/running/paused/won). During a pending mismatch (`resolving: boolean`)
  flips are ignored.
- Actions: `flip { index }`, `resolve` (component dispatches after ~750ms to
  flip the two mismatched cards back), `toggle`, `newGame`.
- `shuffle()` = Fisher–Yates on 2× each value 1..8 with seeded-able
  `Math.random`; `newDeck()` returns ids 1..16 and values.
- Win: matched.size === PAIRS → "won". Score = moves; persist `memory_best`
  as the **minimum** moves (see high-score `mode:"min"`).
- Keyboard: Arrows move cursor (index state in reducer), Space/Enter flip,
  P, R. Tap a card = flip.
- Hint: "Tap cards to flip · P pause; R restarts."
- Face-down cards: `.px-dither` fill with a small dot; face-up: value big,
  bg `--accent` at 0.25 step.

### simon (slug `simon`)
- 4 pads registered 0..3. `WIN_LEN=20`.
- `State`: `seq: number[]`, `phase: "show"|"think"|"input"`, `showPos`,
  `inputIdx`, `score` (current length reached), `status`
  (idle/running/paused/over/won).
- Actions: `begin` (from idle/over: score=0, seq=[random pad], phase "show",
  showPos 0; from input-completed: append a new random pad, score = seq.length,
  phase "show", showPos 0 — if length hits WIN_LEN → status "won"),
  `step` (phase "show": showPos+1; when showPos === seq.length → phase
  "input", inputIdx 0), `press { pad }` (phase "input" only: matches
  seq[inputIdx] → inputIdx+1, and when inputIdx === seq.length dispatch
  `begin` in the component after a short beat; mismatch → status "over"),
  `toggle`, `newGame`.
- The lit pad during "show" is `seq[showPos]`. Locking input while "show".
- Persist `simon_best` (score = longest sequence). Overlay over at
  "Got to N". Header: Score / Best.
- Component loop: while status running && phase === "show", every 650ms
  dispatch `step`. White flash on the lit pad during show (brighten bg to
  `--background` + `--accent` waveform).
- Keys: 1-4 or WASD/arrows press pads (arrow = neighbor pad mapping is
  arbitrary — use 1-4), Space starts/dispenses, P, R.
- Hint: "Watch, then tap the pads · 1–4 keys · P pause; R restarts."
- Pads: 2×2 quadrant grid; each pad an accent-tinted tone
  (`--accent`, `--accent-soft`, `--accent-pipe`, and a `--foreground`-tinted
  fourth using `color-mix`).

### connect-four (slug `connect-four`)
- `COLS=7`, `ROWS=6`, flat grid `(1|2|null)[]`. 2 local players, P1=1 (accent),
  P2=2 (foreground/bold).
- `State`: `grid`, `turn`, `cursor` (column 0..6), `status`
  (idle/running/paused/over), `winner: 1|2|null` (null + full = draw),
  `wins1`, `wins2`.
- Actions: `drop { col }` (find lowest empty row in col, else no-op),
  `moveCursor { dx }`, `select` (drop at cursor), `toggle`, `newGame`
  (rematch keeps tally).
- Win check: 4 same discs in any line (H/V/2 diag). Draw when no cell empty.
- Header: P1/P2 win badges. Keys 1-7 drop in that column, ←/→ move cursor,
  Space/↓ drop, P, R. Tap a column to drop. Swipe ←/→ cursor + down drop.
- Overlay over: "P1 wins! / P2 wins! / It's a draw". Hint:
  "Tap a column · 1–7 keys · P pause; R restarts."
- Board: `grid-cols-7 grid-rows-6` of empty cells + discs computed from grid
  (disc = rounded-full, `.px-dither` for P1? no — P1 solid `--accent`,
  P2 `--foreground` outline ring).

### whack-a-mole (slug `whack-a-mole`)
- 3×3 holes. Round `ROUND=30`s. `HOLES=9`.
- `State`: `active: {hole:number, hideIn:number}[]`, `spawnIn`,
  `timeLeft`, `score`, `status` (idle/running/paused/over).
- Actions: `tick { dt }` (decrement timeLeft/spawnIn/hideIn; spawn a mole in a
  random empty hole when spawnIn ≤ 0, reset spawnIn ~0.6–1.1s random; hide
  expired moles; timeLeft ≤ 0 → "over"), `whack { hole }` (hit removes that
  mole, +1), `toggle`, `newGame`.
- Persist `whack_best`. Header: Score / Best / Time (ceil).
- Tap a hole to whack (board onPointerDown passes hole index). Keys: Space
  starts, P, R. No movement keys.
- Hint: "Tap the moles · P pause; R restarts."
- Holes: 3×3 dark cells (`bg-muted`); mole = `.px-dither` rounded-full circle
  with two tiny eye dots (SVG/text spans), only rendered when active.

### space-invaders (slug `space-invaders`)
- Grid 6×3 aliens on a square board, continuous x in %. `ALIEN_W=8`,
  `ALIEN_H=5`, rows y headed down, `PLAYER_Y=88`, player w 12%, h 5%,
  bullet sizes small.
- `State`: `aliens: {x:number, y:number, col:number, row:number, alive:boolean}[]`
  (or two arrays), block `dir` (1/-1), `blockY`, `stepIn` (seconds between
  descents), speed scales with alive count, `bullets: {x,y,dy,owner}` —
  separate arrays for player (dy<0) and invader shots (dy>0), `playerX`,
  `cooldown`, `score`, `status` (idle/running/paused/over/won).
- Actions: `move { dir: -1|0|1 }` (player cmd), `shoot`, `tick { dt }`,
  `toggle`, `newGame`.
- tick: player moves; alien block marches: x+=dir*ALIEN_SPEED*dt; on wall
  contact flip dir and blockY+=step; stepIn countdown (spawner random shot from
  the lowest alive alien in a random column, at most one per ~0.9s); bullets
  move; collisions: player bullet ↔ alien (kill, score per row: 30/20/10
  top/mid/bottom), alien shot ↔ player → over; blockY reaches player row →
  over; all aliens dead → "won".
- Persist `space_invaders_best`. Header: Score / Best.
- Keys: ←/→ move, Space shoot (held = auto with cooldown), P, R. Swipe ←/→
  move. Tap board → shoot.
- Hint: "←→ move · Space fire · P pause; R restarts."
- Aliens: small SVG "invader" shape filled `--accent` (draw a 3px-wide sprite
  primitive); player = a short `--accent` bar with a cannon.

### frogger (slug `frogger`)
- 9×9 board: `LANES = 9`, 9 cells per lane. Row 0 = goal (5 slots at cols
  0,2,4,6,8), rows 1-3 = road (cars), row 4 = safe, rows 5-7 = river (logs),
  row 8 = start.
- `LaneDef = {row, kind:"car"|"log", speed, dir, spacing}`. Vehicle positions
  derived from `offset` (mod spacing) so one scalar per lane drives rendering:
  `carAt(spacing, offset, i)`.
- `State`: `frog {x,y}`, `offsets: number[]` (per lane, advanced by tick),
  `goals: boolean[]` (5 slots), `score`, `status` (idle/running/paused/over/
  won).
- Actions: `hop { dx, dy }` (only when running; bound to 0..8; goal-slot drop
  onto filled slot returns the frog to start without scoring... simpler: a full
  row-0 slot just counts as a land->push back to start), `tick { dt }`
  (advance offsets mod spacing; if frog on a log lane, ride nearest log
  (clamp/wrap: carried off either edge → over); collisions: on road lane and a
  car shares the cell → over; on river lane and no log → over), `toggle`,
  `newGame`.
- Goal capture: hop into an empty goal slot → +10 (or score by slot
  uniqueness), frog back to start; all 5 → "won".
- Persist `frogger_best`. Header: Score / Best / Goals (filled slots).
- Keys: Arrows/WASD hop, P, R. Swipe = hop direction.
- Hint: "Arrows / WASD or swipe to hop · P pause; R restarts."
- Cars render as `--accent` bars, logs as `--accent-soft` bars, frog = small
  SVG circle/eyes in `--accent`, goal slots = empty squares outline.

### hangman (slug `hangman`)
- `WORDS`: ~24 short common words (4-8 letters, lowercase, no repeats).
- `State`: `word`, `guessed: string[]`, `wrong`, `streak`, `status`
  (idle/running/paused/over/won).
- Actions: `guess { letter }` (only running; already-guessed letters no-op; in
  word → add; not → wrong+1; wrong === 6 → "over", streak resets to 0; all
  letters guessed → "won", streak = the solved words kept so far and the
  overlay says "Word solved — play again"), `newGame` (next word; streak+1 if
  previous was won), `toggle`.
- Persist `hangman_best` (streak). Header: Score (=streak) / Best / Wrong (n/6).
- Keyboard: a-z guess, P, R. On-screen A–Z button grid too (tap/click).
- Overlay over: "Hanged! The word was " + word. Won: "Solved!" + word.
- Guessed letters shown as slots; missed letters listed below; hangman drawn
  as a 6-part SVG gallows + body (head, body, 2 arms, 2 legs) revealed one per
  wrong guess.
- Hint: "Tap letters or type · P pause; R restarts."
- Words must avoid repeat letters that trip `Set` logic — use `new Set(word)`.

### sudoku (slug `sudoku`)
- 9×9. 3 hand-authored puzzles `{ given: number[], solution: number[] }`
  (81 flat; 0 = empty). Given never changes; all 81 cells check win.
- `State`: `cells: number[]` (current, starts = given clone), `selected: number |
  null`, `errors: number` (count of non-given cells typed ≠ solution),
  `puzzleIndex`, `time`, `status` (idle/running/paused/won).
- Actions: `select { index }` (skip given cells? allow selecting only empty),
  `set { value }` (0=erase; only when selected cell is not given and running),
  `nextPuzzle`, `toggle`, `newGame`.
- `checkWin(cells, solution)` → every cell equals solution → "won". Timer:
  component ticks +1s while running.
- Persist `sudoku_best` = **minimum** time (high-score `mode:"min"`). Header:
  Score? no — Time + Best (min) + Errors.
- Keys: ←/↑/→/↓ move selection, 1-9 place, Backspace/0 erase, Space starts,
  P, R (same puzzle), and on-screen 1-9 pad + erase in the footer.
- Hint: "Fill rows, cols & boxes · 1–9 or tap pad · P pause; R restarts."
- Board: 9×9 grid with thicker 3×3 box borders (border classes), given cells
  `font-semibold`, player cells regular, selected tinted with `--accent` ring.
- Give each embedded puzzle a `source` tag in comments; verify by hand that
  each puzzle is consistent with its solution.

---

## Tests (`<slug>-logic.test.ts`)

`import { describe, expect, test } from "bun:test"`. Import from
`@/lib/game-<slug>`. Cover at minimum:

- Initial state is idle; `toggle` starts; `toggle` pauses/resumes; `newGame`
  resets.
- Every action is a no-op (same reference) outside the status it applies to.
- Core rules: 8-12 focused tests (win detection, collisions, spawning,
  scoring, boundaries, immutability — no shared mutated arrays between
  reducer calls: two calls from the same state must not affect each other).
- Random flows: stub `Math.random` with a mulberry32 or sequence and assert
  determinism (e.g., spawn distribution is 90/10 in 2048, mole spawns land on
  empty holes, shuffle contains exactly two of each value, sequences grow).
- Grab the full lifecycle: run a whole game to a terminal status with a
  stubbed random, asserting invariants along the way.

Pattern for stubbing (copy):

```ts
import { afterEach, beforeEach } from "bun:test"

let seed = 0x2f6e2b1
function nextRandom(): number {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
let original: typeof Math.random
beforeEach(() => {
  original = Math.random
  Math.random = nextRandom
})
afterEach(() => {
  Math.random = original
})
```

Do not mutate `lib/games.ts` ordering; just add `href`.