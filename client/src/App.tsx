import { Suspense } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { ErrorBoundary } from 'react-error-boundary'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'

// Redirect that carries the query string along, so old /arbitrage?minProfit=…
// deep links keep their filters when they land on /exchanges/arbitrage.
const RedirectPreservingQuery = ({ to }: { to: string }) => {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}

import { Sidebar } from './components/Sidebar.js'
import { Card, CardContent } from './components/ui/card.js'
import { ArbitrageTab } from './widgets/arbitrage/ArbitrageTab.js'
import { ArbitrageProvider } from './widgets/arbitrage/context.js'
import { AtlasWidget } from './widgets/atlas/AtlasWidget.js'
import { ExchangesWidget } from './widgets/exchanges/ExchangesWidget.js'
import { ExplorerTab } from './widgets/exchanges/ExplorerTab.js'
import { TrendsWidget } from './widgets/trends/TrendsWidget.js'

const WidgetSkeleton = () => (
  <Card className="h-full animate-pulse">
    <CardContent className="flex-1 flex items-center justify-center">
      <div className="w-32 h-4 bg-muted rounded" />
    </CardContent>
  </Card>
)

const WidgetError = ({ error }: FallbackProps) => (
  <Card className="h-full">
    <CardContent className="flex-1 flex items-center justify-center p-6">
      <p className="text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-sm text-center">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </CardContent>
  </Card>
)

// ArbitrageProvider lives above the Outlet so the arbitrage UI state it still
// owns — table sorting and the selected payoff cycle — survives navigating away
// from the widget and back. (The filters themselves now live in the URL query.)
const Layout = () => {
  const location = useLocation()

  return (
    <ArbitrageProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden p-6 flex flex-col">
          <div className="flex-1 min-h-0">
            {/* Keying by pathname resets the boundary so an error on one route
                doesn't linger after navigating to another. */}
            <ErrorBoundary key={location.pathname} FallbackComponent={WidgetError}>
              <Suspense fallback={<WidgetSkeleton />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </ArbitrageProvider>
  )
}

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Navigate to="/exchanges" replace />} />
      <Route path="exchanges" element={<ExchangesWidget />}>
        <Route index element={<ExplorerTab />} />
        <Route path="cycles" element={<ArbitrageTab />} />
        {/* Back-compat: the cycle table used to live at /exchanges/arbitrage. */}
        <Route path="arbitrage" element={<RedirectPreservingQuery to="/exchanges/cycles" />} />
      </Route>
      {/* Back-compat: the widget used to live at /arbitrage. */}
      <Route path="arbitrage" element={<RedirectPreservingQuery to="/exchanges/cycles" />} />
      <Route path="trends" element={<TrendsWidget />} />
      <Route path="atlas" element={<AtlasWidget />} />
      <Route path="*" element={<Navigate to="/exchanges" replace />} />
    </Route>
  </Routes>
)
