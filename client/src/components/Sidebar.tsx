import { ArrowLeftRight, Map, TrendingUp } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type View = 'arbitrage' | 'trends' | 'atlas'

type NavItem = { view: View; label: string; Icon: React.ElementType }

const NAV_ITEMS: NavItem[] = [
  { view: 'arbitrage', label: 'Arbitrage', Icon: ArrowLeftRight },
  { view: 'trends', label: 'Meta Trends', Icon: TrendingUp },
  { view: 'atlas', label: 'Atlas Strategies', Icon: Map },
]

type SidebarProps = {
  active: View
  onSelect: React.Dispatch<React.SetStateAction<View>>
}

export const Sidebar = ({ active, onSelect }: SidebarProps) => (
  <aside className="flex w-14 flex-col shrink-0 h-screen border-r border-sidebar-border bg-sidebar">
    <nav className="flex flex-col gap-0.5 p-2 flex-1">
      {NAV_ITEMS.map(navItem => {
        const { view, label } = navItem
        // Bind the component to a PascalCase local (allowed for variables) so JSX renders it.
        const NavIcon = navItem.Icon
        return (
          <Tooltip key={view}>
            <TooltipTrigger
              onClick={() => onSelect(view)}
              className={cn(
                'flex items-center justify-center py-2 rounded-md text-sm transition-colors w-full',
                active === view
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <NavIcon size={16} className="shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  </aside>
)
