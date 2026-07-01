import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useArbitrages } from './context.js'

type CurrencyIconProps = {
  name: string
  className?: string
}

export const CurrencyIcon = ({ name, className }: CurrencyIconProps) => {
  const { arbitrages } = useArbitrages()
  const icon = arbitrages.currencyIcons[name]
  return icon ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <img
          src={icon}
          alt={name}
          className={cn('inline-block w-9 h-9 object-contain shrink-0', className)}
        />
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  ) : null
}
