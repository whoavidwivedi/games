"use client"

import { RiCloseLine, RiInformationLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * The "i" button. Hovering shows the steps in a shadcn tooltip; clicking
 * opens the overlay version, which is what touch devices get since they
 * cannot hover.
 */
export function HelpButton({
  open,
  onClick,
  steps,
}: {
  open: boolean
  onClick: () => void
  steps: string[]
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="How to play"
            aria-expanded={open}
            onClick={onClick}
          >
            <RiInformationLine />
          </Button>
        }
      />
      <TooltipContent
        side="bottom"
        align="end"
        className="flex-col items-start"
      >
        <span className="font-medium">How to play</span>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The same instructions laid over the board as an absolute layer, so the
 * board's size never changes. Clicking the backdrop or the X closes it.
 */
export function HelpOverlay({
  onClose,
  steps,
}: {
  onClose: () => void
  steps: string[]
}) {
  return (
    <div
      role="dialog"
      aria-label="How to play"
      className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-background p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-60 flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">How to play</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close instructions"
            onClick={onClose}
          >
            <RiCloseLine />
          </Button>
        </div>

        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}