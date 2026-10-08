/**
 * A localStorage-backed high score, read through `useSyncExternalStore` so it
 * hydrates without a setState-in-effect and stays in sync across tabs.
 *
 * `mode` picks what "better" means: "max" (higher is better, the default) or
 * "min" (lower is better, e.g. fewest moves or fastest time).
 */
import { createLocalStore } from "./local-store"

export function createHighScore(key: string, mode: "max" | "min" = "max") {
  const better =
    mode === "min" ? (a: number, b: number) => a < b : (a: number, b: number) => a > b
  const store = createLocalStore(key)

  function read(): number {
    try {
      const value = Number.parseInt(localStorage.getItem(key) ?? "", 10)
      return Number.isNaN(value) ? 0 : value
    } catch {
      return 0
    }
  }

  function readOnServer(): number {
    return 0
  }

  /** True when `candidate` improves on the stored value. */
  function isBetter(candidate: number): boolean {
    return candidate > 0 && better(candidate, read())
  }

  function save(value: number): void {
    if (!isBetter(value)) return
    store.write(value.toString())
  }

  return { read, readOnServer, subscribe: store.subscribe, save, isBetter }
}