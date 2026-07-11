import type { ItemMod, ItemRoll } from '@poe2-dashboard/shared'
import {
  combinedChanceToBeat,
  cumulativePercentile,
  parseItemText,
  rollPercentile,
} from '@poe2-dashboard/shared'
import { Lock } from 'lucide-react'
import { useMemo, useState } from 'react'

import { SectionLabel } from '@/components/common/SectionLabel'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * Paste an item's advanced text (Ctrl+Alt+C in game) to see where each mod's
 * roll sits in its divine range, and the combined odds of a Divine Orb landing
 * this well or better across whichever rolls you care about. Every divinable
 * roll starts counted; click a roll to exclude it (e.g. the mana half of a
 * hybrid mod when only the energy shield half matters).
 */

/** Identifies one roll across parses: mod / line / roll position. */
const rollKey = (modIndex: number, lineIndex: number, rollIndex: number) =>
  `${modIndex}.${lineIndex}.${rollIndex}`

const formatPercent = (fraction: number): string => {
  const percent = fraction * 100
  if (percent >= 99.95) return '100%'
  return `${percent.toPrecision(percent < 1 ? 2 : 3)}%`
}

/** Colour a percentile like a heat scale: rough rolls muted, near-perfect indigo. */
const percentileTone = (percentile: number): string => {
  if (percentile >= 0.9) return 'text-indigo-400'
  if (percentile >= 0.6) return 'text-foreground'
  return 'text-muted-foreground'
}

type RollChipProps = {
  roll: ItemRoll
  /** null = fractured, not toggleable */
  counted: boolean | null
  onToggle: () => void
}

const RollChip = ({ roll, counted, onToggle }: RollChipProps) => {
  const percentile = rollPercentile(roll)
  const fixed = roll.min === roll.max
  const body = (
    <>
      <span className="tabular-nums">
        {roll.value}
        <span className="text-muted-foreground/70">
          {' '}
          ({roll.min}–{roll.max})
        </span>
      </span>
      <span className={cn('tabular-nums font-medium', percentileTone(percentile))}>
        {fixed ? 'fixed' : formatPercent(percentile)}
      </span>
    </>
  )
  if (counted === null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs text-muted-foreground">
        {body}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={counted}
      onClick={onToggle}
      title={counted ? 'Counted — click to exclude' : 'Excluded — click to count'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs select-none transition-colors',
        counted
          ? 'border-indigo-500 bg-indigo-950/60 shadow-[0_0_0_1px_theme(colors.indigo.500)]'
          : 'border-border bg-secondary opacity-50 hover:border-primary/50 hover:opacity-80',
      )}
    >
      {body}
    </button>
  )
}

type ModBlockProps = {
  mod: ItemMod
  modIndex: number
  isExcluded: (key: string) => boolean
  onToggle: (key: string) => void
}

const ModBlock = ({ mod, modIndex, isExcluded, onToggle }: ModBlockProps) => (
  <div className={cn('rounded-lg border border-border p-3', mod.fractured && 'opacity-70')}>
    <div className="flex flex-wrap items-center gap-2 pb-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{mod.name ?? mod.header}</span>
      {mod.tier !== null && <Badge variant="outline">Tier {mod.tier}</Badge>}
      {mod.fractured && (
        <Badge variant="secondary">
          <Lock /> fractured
        </Badge>
      )}
    </div>
    <div className="flex flex-col gap-1.5">
      {mod.lines.map((line, lineIndex) => (
        <div key={lineIndex} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{line.text}</span>
          <span className="flex flex-wrap gap-1.5">
            {line.rolls.map((roll, rollIndex) => {
              const key = rollKey(modIndex, lineIndex, rollIndex)
              return (
                <RollChip
                  key={rollIndex}
                  roll={roll}
                  counted={mod.fractured ? null : !isExcluded(key)}
                  onToggle={() => onToggle(key)}
                />
              )
            })}
          </span>
        </div>
      ))}
    </div>
  </div>
)

export const RollsWidget = () => {
  const [text, setText] = useState('')
  // Rolls are counted by default; we track the exclusions so a fresh paste
  // starts with everything on. Keys are positional, so they'd silently point
  // at the wrong rolls on a different item — handlePaste clears them.
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())

  const item = useMemo(() => (text.trim() ? parseItemText(text) : null), [text])

  const handlePaste = (next: string) => {
    setText(next)
    setExcluded(new Set())
  }

  const toggle = (key: string) =>
    setExcluded(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const divinableRolls = useMemo(() => {
    if (!item) return []
    return item.mods.flatMap((mod, modIndex) =>
      mod.fractured
        ? []
        : mod.lines.flatMap((line, lineIndex) =>
            line.rolls.map((roll, rollIndex) => ({
              key: rollKey(modIndex, lineIndex, rollIndex),
              roll,
            })),
          ),
    )
  }, [item])

  const countedRolls = divinableRolls
    .filter(entry => !excluded.has(entry.key))
    .map(entry => entry.roll)
  const percentile = cumulativePercentile(countedRolls)
  // Divines are geometric trials: on average 1/p orbs until one strictly beats.
  const beat = combinedChanceToBeat(countedRolls)
  const expectedToBeat = beat > 0 ? Math.round(1 / beat) : null

  return (
    <Card className="h-full">
      <CardContent className="flex h-full min-h-0 flex-col gap-4 pt-4">
        <div>
          <SectionLabel>Paste item (Ctrl+Alt+C in game for roll ranges)</SectionLabel>
          <Textarea
            value={text}
            onChange={event => handlePaste(event.target.value)}
            placeholder={'Item Class: Helmets\nRarity: Rare\n…'}
            spellCheck={false}
            className="mt-1 max-h-48 min-h-24 font-mono text-xs"
          />
        </div>

        {item && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="text-sm font-medium">
                {item.name ?? item.baseType ?? 'Unknown item'}
                {item.name && item.baseType && (
                  <span className="text-muted-foreground"> — {item.baseType}</span>
                )}
              </span>
              {countedRolls.length > 0 ? (
                <>
                  <span
                    className={cn(
                      'text-2xl font-semibold tabular-nums',
                      percentileTone(percentile),
                    )}
                    title="Share of all possible divine outcomes whose counted rolls total at or below this item's, each roll measured within its own range"
                  >
                    {formatPercent(percentile)}
                    <span className="pl-1.5 text-xs font-normal text-muted-foreground">
                      cumulative percentile
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {expectedToBeat !== null ? (
                      <span title="Average orbs until a strictly better outcome: at or above every counted roll, above at least one">
                        <span className="font-medium text-foreground tabular-nums">
                          {expectedToBeat.toLocaleString()}
                        </span>{' '}
                        divines to beat current roll
                      </span>
                    ) : (
                      <span>can&apos;t be beaten — every counted roll is at its max</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No rolls counted — click a roll chip to include it.
                </span>
              )}
            </div>

            {item.mods.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No modifier blocks found. Copy the item with Ctrl+Alt+C so the text includes the{' '}
                {'{ Prefix Modifier … }'} headers and roll ranges.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {item.mods.map((mod, modIndex) => (
                  <ModBlock
                    key={modIndex}
                    mod={mod}
                    modIndex={modIndex}
                    isExcluded={key => excluded.has(key)}
                    onToggle={toggle}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
