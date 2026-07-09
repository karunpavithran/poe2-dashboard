import { Loader2 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { useArbitragesQuery, useRefreshArbitrages } from '@/api.js'
import { DataAge } from '@/components/common/DataAge.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Segmented sub-tab link. Active state comes from the router, so the tab lives in
// the URL (shareable, and the Sidebar remembers which one you were on).
const tabClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'rounded-md px-3 py-1 text-sm font-medium transition-colors',
    isActive
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  )

/**
 * The Exchanges widget: a shell around two submodules that share one snapshot —
 * "Cycles" (the triangular-cycle table, the default tab) and "Explorer" (a
 * currency-centric master–detail: per-currency buy/sell rates across the anchor
 * hubs plus the cycles it's part of). The Card, freshness badge, and poll-error banner are
 * shared here; each submodule renders as the routed <Outlet/> below. Freshness
 * reads the economy query, since data age and poll errors are snapshot-level.
 */
export const ExchangesWidget = () => {
  const { arbitrages, isArbitragesFetching } = useArbitragesQuery()
  const { dataAgeMs, lastError, isRefreshing } = arbitrages
  const refresh = useRefreshArbitrages()

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-3">
        <CardTitle>Exchanges</CardTitle>
        <nav className="flex gap-0.5 rounded-lg bg-muted/50 p-0.5">
          <NavLink to="/exchanges" end className={tabClass}>
            Cycles
          </NavLink>
          <NavLink to="/exchanges/explorer" className={tabClass}>
            Explorer
          </NavLink>
        </nav>
        <div className="ml-auto">
          {dataAgeMs === null ? (
            // No snapshot yet — the error banner covers the failed-poll case, so
            // only show the loading hint while we're genuinely still waiting.
            !lastError && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching rates from poe.ninja…
              </span>
            )
          ) : (
            <DataAge
              fetchedAt={Date.now() - dataAgeMs}
              onRefetch={() => refresh.mutate()}
              isFetching={isRefreshing || refresh.isPending || isArbitragesFetching}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {lastError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-sm mb-3">
            Last poll failed: {lastError}
          </p>
        )}
        <Outlet />
      </CardContent>
    </Card>
  )
}
