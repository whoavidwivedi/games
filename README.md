# Arcade

A retro browser arcade: Snake and Tic-Tac-Toe, built with Next.js and React, playable instantly with a keyboard, mouse or touch. No accounts and no ads — your high scores and favourites stay in your browser.

## Games

| Game | What you do |
| --- | --- |
| [Snake](/games/snake) | Eat the dots, grow longer, and don't hit the walls or yourself. |
| [Tic-Tac-Toe](/games/tic-tac-toe) | Line up three against a friend locally, or a system opponent that never loses. |

## Features

- **Snake and Tic-Tac-Toe**, both fully playable in the browser.
- **Keyboard, mouse and touch** — arrow keys / WASD, on-screen controls, and swipe on mobile.
- **Playful retro look** — pixel-art pieces and per-game accents, with generative dithered covers.
- **Dark and light themes** that follow your system preference.
- Lightweight persistence: high scores and favourite games are stored locally.
- Fully static: every game is prerendered at build time.
- Strict TypeScript, ESLint and Prettier, with unit tests covering all game logic.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) and [React 19](https://react.dev)
- [TypeScript 5](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com) (base-nova style, Remix Icon)
- [next-themes](https://github.com/pacocoursey/next-themes) for light/dark mode
- [three.js](https://threejs.org) and [postprocessing](https://github.com/pmndrs/postprocessing) for the dithered card covers
- [Bun](https://bun.sh) for installs, scripts and tests (`bun:test`)

## Getting started

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev
```

Open <http://localhost:3000> and pick a game.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server. |
| `bun run build` | Create a production build. |
| `bun run start` | Serve the production build. |
| `bun run lint` | Run ESLint. |
| `bun run typecheck` | Type-check with the TypeScript compiler. |
| `bun test` | Run the unit tests. |
| `bun run format` | Format sources with Prettier. |

## Project structure

```
app/                  routes: home, favourites, and /games/[slug]
components/           shared UI and the app shell
components/games/     one component per game
lib/                  game logic (one lib/game-*.ts per game)
hooks/                reusable game hooks (keys, ticks, swipe)
*.test.ts             bun:test suites for the game logic
GAME-SPEC.md          the per-game build specification
```

## License

[MIT](./LICENSE)