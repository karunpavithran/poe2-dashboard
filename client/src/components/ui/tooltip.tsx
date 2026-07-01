import { Tooltip as TooltipPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

type TooltipProviderProps = React.ComponentProps<typeof TooltipPrimitive.Provider>

const TooltipProvider = ({ delayDuration = 0, ...props }: TooltipProviderProps) => (
  <TooltipPrimitive.Provider
    data-slot="tooltip-provider"
    delayDuration={delayDuration}
    {...props}
  />
)

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Root>

const Tooltip = ({ ...props }: TooltipProps) => (
  <TooltipProvider>
    <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  </TooltipProvider>
)

type TooltipTriggerProps = React.ComponentProps<typeof TooltipPrimitive.Trigger>

const TooltipTrigger = (props: TooltipTriggerProps) => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
)

// Surface and arrow colors are paired per variant so the Radix arrow (a separate
// element with its own fill) always matches the bubble background — otherwise an
// overridden bubble color leaves a mismatched caret.
const tooltipVariants = {
  default: {
    surface: 'bg-popover text-popover-foreground border border-border',
    arrow: 'bg-popover fill-popover',
  },
  destructive: { surface: 'bg-destructive text-white', arrow: 'bg-destructive fill-destructive' },
} as const

type TooltipContentProps = React.ComponentProps<typeof TooltipPrimitive.Content> & {
  variant?: keyof typeof tooltipVariants
}

const TooltipContent = ({
  className,
  sideOffset = 4,
  variant = 'default',
  children,
  ...props
}: TooltipContentProps) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(
        tooltipVariants[variant].surface,
        'z-50 w-fit rounded-md px-2.5 py-1 text-xs text-balance',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        className={cn(
          tooltipVariants[variant].arrow,
          'z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]',
        )}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
)

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
