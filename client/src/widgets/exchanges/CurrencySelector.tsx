import type { ExchangeType } from '@poe2-dashboard/shared'
import { EXCHANGE_CATEGORY_LABELS, EXCHANGE_TYPES } from '@poe2-dashboard/shared'
import { useMemo, useState } from 'react'

import { useArbitragesQuery } from '@/api.js'
import { FilterChip } from '@/components/common/FilterChip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { CurrencyIcon } from '../arbitrage/CurrencyIcon.js'

type CurrencySelectorProps = {
  selected: string
  onSelect: (currency: string) => void
}

/**
 * The Explorer's left column: pick any priced currency to inspect. Category chips
 * narrow the list to the pages a currency is *listed* on (client-derived
 * `currencyCategories`); a search box narrows by name. The three anchor hubs have
 * no home category, so they're always shown regardless of the chips. Chip state is
 * a transient browsing aid — deliberately local, not in the URL, so it never
 * collides with the Browse tab's `categories` param.
 */
export const CurrencySelector = ({ selected, onSelect }: CurrencySelectorProps) => {
  const { arbitrages } = useArbitragesQuery()
  const { bestBuy, currencyCategories, hubs } = arbitrages

  const hubNames = useMemo(() => new Set(Object.values(hubs)), [hubs])
  const [categories, setCategories] = useState<Set<ExchangeType>>(() => new Set(EXCHANGE_TYPES))
  const [query, setQuery] = useState('')

  const toggleCategory = (category: ExchangeType) =>
    setCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })

  const allSelected = categories.size === EXCHANGE_TYPES.length
  const currencies = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return Object.keys(bestBuy)
      .filter(name => {
        if (needle && !name.toLowerCase().includes(needle)) return false
        // Hubs anchor every page — always available whatever the category filter.
        if (hubNames.has(name)) return true
        if (allSelected) return true
        return (currencyCategories[name] ?? []).some(category => categories.has(category))
      })
      .sort((a, b) => a.localeCompare(b))
  }, [bestBuy, currencyCategories, hubNames, categories, allSelected, query])

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {EXCHANGE_TYPES.map(category => (
          <FilterChip
            key={category}
            active={categories.has(category)}
            onClick={() => toggleCategory(category)}
          >
            {EXCHANGE_CATEGORY_LABELS[category]}
          </FilterChip>
        ))}
      </div>

      <Input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search currency…"
        className="h-8"
      />

      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto">
        {currencies.map(name => (
          <li key={name}>
            <button
              type="button"
              onClick={() => onSelect(name)}
              aria-current={name === selected ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                name === selected
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50',
              )}
            >
              <CurrencyIcon name={name} className="h-5 w-5 shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          </li>
        ))}
        {currencies.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</li>
        )}
      </ul>
    </div>
  )
}
