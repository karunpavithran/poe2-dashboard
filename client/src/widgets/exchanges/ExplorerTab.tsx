import { useOutletContext } from 'react-router'

import { CurrencyDetail } from './CurrencyDetail.js'
import { CurrencySelector } from './CurrencySelector.js'
import type { ExplorerSelection } from './ExchangesWidget.js'

/**
 * The "Explorer" submodule of the Exchanges widget: a currency-centric
 * master–detail view. The left column ({@link CurrencySelector}) picks a currency;
 * the right pane ({@link CurrencyDetail}) shows its buy/sell rates across the anchor
 * hubs *and* every arbitrage cycle it's part of. The selection is owned by
 * ExchangesWidget (via the router outlet context) so it survives switching tabs —
 * this component unmounts on every tab switch. The Card shell, freshness badge,
 * and poll-error banner also live one level up (shared with the Cycles tab), so
 * this renders only the body inside that shell's CardContent.
 */
export const ExplorerTab = () => {
  const { selected, mode, setSelected, setMode } = useOutletContext<ExplorerSelection>()

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
