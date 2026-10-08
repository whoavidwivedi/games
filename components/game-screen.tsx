import type { CSSProperties, ReactNode, TouchEvent } from "react"

interface GameScreenProps {
  children?: ReactNode
  /**
   * Inline styles, used to carry a game's card colour into its screen as CSS
   * custom properties (see lib/games.ts accentVars).
   */
  style?: CSSProperties
  onTouchStart?: (event: TouchEvent<HTMLElement>) => void
  onTouchMove?: (event: TouchEvent<HTMLElement>) => void
  onTouchEnd?: (event: TouchEvent<HTMLElement>) => void
}

/**
 * The page shell: fixed to the dynamic viewport (tracks mobile browser chrome
 * as it shows/hides; nothing scrolls, no pull-to-refresh, no bounce). The
 * column on top is the size container the boards measure against.
 */
export function GameScreen({
  children,
  style,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: GameScreenProps) {
  return (
    <main
      style={style}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="game-screen-in w-full fixed inset-0 h-dvh touch-none overflow-hidden overscroll-none select-none [-webkit-tap-highlight-color:transparent]"
    >
      <div className="relative mx-auto flex h-full w-full max-w-md flex-col justify-center gap-3 p-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)] [container-type:size]">
        {children}
      </div>
    </main>
  )
}