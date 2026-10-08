/**
 * Favourite game ids in localStorage, read through `useSyncExternalStore`
 * the same way as `lib/high-score`: `read` hands back a stable array
 * reference so subscribers re-render only when the list actually changes.
 */
import { createLocalStore } from "./local-store"

const KEY = "favourites"

// Shared empty snapshot: the server (and first client render) must return
// the same reference every call or useSyncExternalStore loops.
const EMPTY: string[] = []

let cached: string[] = EMPTY
let loaded = false

// Another tab wrote the list: drop the cache so the next read reparses.
const store = createLocalStore(KEY, () => {
  loaded = false
})

/** A stable id for a game, derived from its title ("Tic-Tac-Toe" -> "tic-tac-toe"). */
export function gameId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return EMPTY
    const ids = value.filter((item): item is string => typeof item === "string")
    return ids.length > 0 ? ids : EMPTY
  } catch {
    return EMPTY
  }
}

function read(): string[] {
  if (!loaded) {
    try {
      cached = parse(localStorage.getItem(KEY))
    } catch {
      cached = EMPTY
    }
    loaded = true
  }
  return cached
}

function readOnServer(): string[] {
  return EMPTY
}

function toggle(id: string): void {
  const current = read()
  cached = current.includes(id)
    ? current.filter((existing) => existing !== id)
    : [...current, id]
  store.write(JSON.stringify(cached))
}

export const favorites = {
  read,
  readOnServer,
  subscribe: store.subscribe,
  toggle,
}