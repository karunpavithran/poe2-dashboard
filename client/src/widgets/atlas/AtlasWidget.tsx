import type { AtlasStrategy } from '@poe2-dashboard/shared'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAtlas, useSaveAtlas } from '@/api.js'
import { FilterChip } from '@/components/common/FilterChip'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { createEmptyStrategy } from './constants.js'
import { StrategyCard } from './StrategyCard.js'
import { StrategyEditor } from './StrategyEditor.js'

export const AtlasWidget = () => {
  const { atlas } = useAtlas()
  const { mutate: saveAtlas, isPending: isSaving } = useSaveAtlas()
  const [editing, setEditing] = useState<AtlasStrategy | null>(null)
  const [search, setSearch] = useState('')
  // Multi-select tag filter: a strategy must carry *every* selected tag (AND).
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())

  const toggleTag = (tag: string) =>
    setActiveTags(current => {
      const next = new Set(current)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })

  const allTags = useMemo(
    () => [...new Set(atlas.flatMap(strategy => strategy.tags))].sort(),
    [atlas],
  )

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matchesTerm = (strategy: AtlasStrategy) =>
      !term ||
      strategy.name.toLowerCase().includes(term) ||
      strategy.tablets.some(
        tablet =>
          tablet.type.toLowerCase().includes(term) ||
          tablet.mods.some(mod => mod.toLowerCase().includes(term)),
      )
    return atlas
      .filter(strategy => [...activeTags].every(tag => strategy.tags.includes(tag)))
      .filter(matchesTerm)
  }, [atlas, search, activeTags])

  const isExisting = editing !== null && atlas.some(strategy => strategy.id === editing.id)

  const handleSave = (strategy: AtlasStrategy) => {
    const next = atlas.some(existing => existing.id === strategy.id)
      ? atlas.map(existing => (existing.id === strategy.id ? strategy : existing))
      : [...atlas, strategy]
    saveAtlas(next, { onSuccess: () => setEditing(null) })
  }

  const handleDuplicate = (strategy: AtlasStrategy) =>
    setEditing({
      ...structuredClone(strategy),
      id: crypto.randomUUID(),
      name: `${strategy.name} (copy)`,
    })

  const handleDelete = (strategy: AtlasStrategy) => {
    if (!window.confirm(`Delete "${strategy.name}"?`)) return
    saveAtlas(atlas.filter(existing => existing.id !== strategy.id))
  }

  return (
    <Card className="h-full">
      <CardContent className="flex h-full min-h-0 flex-col pt-4">
        {editing ? (
          <StrategyEditor
            key={editing.id}
            initial={editing}
            isExisting={isExisting}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 pb-4">
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search strategies, tablets, mods…"
                className="h-8 w-56"
              />
              <div className="ml-auto">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(createEmptyStrategy())}
                >
                  <Plus /> New
                </Button>
              </div>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-4">
                <FilterChip active={activeTags.size === 0} onClick={() => setActiveTags(new Set())}>
                  All
                </FilterChip>
                {allTags.map(tag => (
                  <FilterChip key={tag} active={activeTags.has(tag)} onClick={() => toggleTag(tag)}>
                    {tag}
                  </FilterChip>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto">
              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No strategies match.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {visible.map(strategy => (
                    <StrategyCard
                      key={strategy.id}
                      strategy={strategy}
                      onEdit={() => setEditing(strategy)}
                      onDuplicate={() => handleDuplicate(strategy)}
                      onDelete={() => handleDelete(strategy)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
