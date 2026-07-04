import { ArrowLeftRight, Map, TrendingUp } from 'lucide-react'
import { useRef } from 'react'
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
 * The browser doesn't expose past history entries to read back, so we keep the
 * map ourselves in a ref used purely as a render cache: we record the current
 * section's location as we render (no effect, no extra render), and the links
 * below read it in the same pass, so each tab always points at its freshest
 * remembered spot. The Sidebar never unmounts (it lives in the Layout), so the
 * ref persists for the whole session — no store needed. It's in-memory only, so
 * a full page reload starts each tab fresh; swap the ref for sessionStorage if
 * reload-survival is ever wanted.
 */
export const Sidebar = () => {
  const location = useLocation()
  const current = sectionOf(location.pathname)

  const lastVisited = useRef<Record<string, string>>({})
  lastVisited.current[current] = location.pathname + location.search + location.hash

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
          const to = lastVisited.current[section] ?? path
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
