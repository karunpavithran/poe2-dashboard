import { EXCHANGE_CATEGORY_LABELS, EXCHANGE_TYPES } from '@poe2-dashboard/shared'

import { FilterChip } from '@/components/common/FilterChip'

import { useArbitrageContext } from './context.js'

export const CategoryFilter = () => {
  const { selectedCategories, toggleCategory } = useArbitrageContext()

  return (
    <div className="flex flex-wrap gap-1.5">
      {EXCHANGE_TYPES.map(category => (
        <FilterChip
          key={category}
          active={selectedCategories.has(category)}
          onClick={() => toggleCategory(category)}
        >
          {EXCHANGE_CATEGORY_LABELS[category]}
        </FilterChip>
      ))}
    </div>
  )
}
