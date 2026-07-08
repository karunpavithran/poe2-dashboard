import { useSearchParams } from 'react-router'

import { CurrencyDetail } from './CurrencyDetail.js'
import { CurrencySelector } from './CurrencySelector.js'

type Mode = 'buy' | 'sell'

/**
 * The "Explorer" submodule of the Exchanges widget: a currency-centric
 * master–detail view. The left column ({@link CurrencySelector}) picks a currency;
 * the right pane ({@link CurrencyDetail}) shows its buy/sell rates across the anchor
 * hubs *and* every arbitrage cycle it's part of. The selection lives in the URL
 * (`?c=…&mode=…`) so a comparison is shareable. The Card shell, freshness badge,
 * and poll-error banner live one level up in ExchangesWidget (shared with the
 * Browse tab), so this renders only the body inside that shell's CardContent.
 */
export const ExplorerTab = () => {
  const [params, setParams] = useSearchParams()
  const selected = params.get('c') ?? ''
  const mode: Mode = params.get('mode') === 'sell' ? 'sell' : 'buy'

  const setSelected = (currency: string) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (currency) next.set('c', currency)
        else next.delete('c')
        return next
      },
      { replace: true },
    )

  const setMode = (next: Mode) =>
    setParams(
      prev => {
        const params = new URLSearchParams(prev)
        // Buy is the default, so omit it to keep shared links clean.
        if (next === 'sell') params.set('mode', 'sell')
        else params.delete('mode')
        return params
      },
      { replace: true },
    )

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex w-72 shrink-0 flex-col border-r border-border pr-4">
        <CurrencySelector selected={selected} onSelect={setSelected} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {selected ? (
          <CurrencyDetail selected={selected} mode={mode} onModeChange={setMode} />
        ) : (
          <p className="max-w-sm text-sm text-muted-foreground">
            Pick a currency to compare buying and selling it across Divine, Exalted, and Chaos — and
            see every arbitrage cycle it&rsquo;s part of.
          </p>
        )}
      </div>
    </div>
  )
}
