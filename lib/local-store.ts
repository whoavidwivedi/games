/**
 * The shared localStorage scaffolding behind lib/favorites and lib/high-score:
 * a listeners set, a window "storage" listener scoped to one key, and a
 * guarded write that notifies every listener. Read/parse semantics stay in
 * the caller (`onExternalChange` lets a caller drop its cache on a cross-tab
 * write).
 */
export function createLocalStore(key: string, onExternalChange?: () => void) {
  const listeners = new Set<() => void>()

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) {
        onExternalChange?.()
        listener()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener("storage", onStorage)
    }
  }

  /** Guarded write: localStorage can throw (private mode, quota). */
  function write(value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
    listeners.forEach((listener) => listener())
  }

  return { subscribe, write }
}