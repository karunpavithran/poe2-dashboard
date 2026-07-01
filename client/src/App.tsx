import { Suspense, useState } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { ErrorBoundary } from 'react-error-boundary'

import type { View } from './components/Sidebar.js'
import { Sidebar } from './components/Sidebar.js'
import { Card, CardContent } from './components/ui/card.js'
import { ArbitrageWidget } from './widgets/arbitrage/ArbitrageWidget.js'
import { ArbitrageProvider } from './widgets/arbitrage/context.js'
import { AtlasWidget } from './widgets/atlas/AtlasWidget.js'
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

export const App = () => {
  const [view, setView] = useState<View>('arbitrage')

  return (
    // ArbitrageProvider lives above the view switch so its filter state survives
    // navigating away from the arbitrage widget and back.
    <ArbitrageProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar active={view} onSelect={setView} />
        <main className="flex-1 overflow-hidden p-6 flex flex-col">
          <div className="flex-1 min-h-0">
            <ErrorBoundary FallbackComponent={WidgetError}>
              <Suspense fallback={<WidgetSkeleton />}>
                {view === 'arbitrage' && <ArbitrageWidget />}
                {view === 'trends' && <TrendsWidget />}
                {view === 'atlas' && <AtlasWidget />}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </ArbitrageProvider>
  )
}
