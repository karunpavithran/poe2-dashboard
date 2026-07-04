import { ArrowLeftRight, Map, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// `section` is the first path segment — the stable identity of a tab across all
// the routes nested under it (e.g. both `/atlas` and a future `/atlas/:id` are
// the "atlas" section). `path` is where the tab points before it's been visited.
type NavItem = { section: string; path: string; label: string; Icon: React.ElementType }

const NAV_ITEMS: NavItem[] = [
  { section: 'arbitrage', path: '/arbitrage', label: 'Arbitrage', Icon: ArrowLeftRight },
  { section: 'trends', path: '/trends', label: 'Meta Trends', Icon: TrendingUp },
  { section: 'atlas', path: '/atlas', label: 'Atlas Strategies', Icon: Map },
]

/** First path segment, e.g. "/atlas/abc" -> "atlas". */
const sectionOf = (pathname: string): string => pathname.split('/')[1] ?? ''

/**
 * Sidebar nav that remembers where you were in each section. Each tab links back
 * to the exact location (path + query + hash) you last had there, so state that
 * lives in the URL — the arbitrage filters today, a future `/atlas/:id` detail
 * route tomorrow — survives hopping to another tab and back. Because we store the
 * whole location string, any URL-encoded state is preserved uniformly with no
 * per-feature handling.
 *
 * The Sidebar never unmounts (it lives in the Layout), so this map persists for
 * the whole session in component state — no store needed. It's in-memory only,
 * so a full page reload starts each tab fresh; swap `lastVisited` for
 * sessionStorage if reload-survival is ever wanted.
 */
export const Sidebar = () => {
  const location = useLocation()
  const current = sectionOf(location.pathname)
  const [lastVisited, setLastVisited] = useState<Record<string, string>>({})

  // Record the full location for whichever section we're currently in.
  useEffect(() => {
    setLastVisited(prev => ({
      ...prev,
      [current]: location.pathname + location.search + location.hash,
    }))
  }, [current, location.pathname, location.search, location.hash])

  return (
    <aside className="flex w-14 flex-col shrink-0 h-screen border-r border-sidebar-border bg-sidebar">
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(navItem => {
          const { section, path, label } = navItem
          // Bind to a PascalCase local (allowed for variables) so JSX renders it.
          const NavIcon = navItem.Icon
          // Active is decided by section, not an exact path match, so the tab
          // still highlights on nested routes and remembered deep links.
          const active = current === section
          const to = lastVisited[section] ?? path
          return (
            <Tooltip key={section}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-center py-2 rounded-md text-sm transition-colors w-full',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  )}
                >
                  <NavIcon size={16} className="shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}
