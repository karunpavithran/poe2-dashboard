import type { TabletSlot } from '@poe2-dashboard/shared'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Combobox } from '@/components/common/Combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { ChipInput } from './ChipInput.js'
import type { StrategyDraft } from './constants.js'
import { MASTER_NAMES, TABLET_TYPES } from './constants.js'

type StrategyEditorProps = {
  initial: StrategyDraft
  isExisting: boolean
  isSaving: boolean
  onSave: (draft: StrategyDraft) => void
  onCancel: () => void
}

const emptyTablet = (): TabletSlot => ({ type: '', quantity: 1, mods: [] })

export const StrategyEditor = ({
  initial,
  isExisting,
  isSaving,
  onSave,
  onCancel,
}: StrategyEditorProps) => {
  const [draft, setDraft] = useState<StrategyDraft>(initial)

  const updateTablet = (index: number, patch: Partial<TabletSlot>) =>
    setDraft(current => ({
      ...current,
      tablets: current.tablets.map((tablet, tabletIndex) =>
        tabletIndex === index ? { ...tablet, ...patch } : tablet,
      ),
    }))

  const addTablet = () =>
    setDraft(current => ({ ...current, tablets: [...current.tablets, emptyTablet()] }))

  const removeTablet = (index: number) =>
    setDraft(current => ({
      ...current,
      tablets: current.tablets.filter((_, tabletIndex) => tabletIndex !== index),
    }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSave({
      ...draft,
      name: draft.name.trim(),
      sourceUrl: draft.sourceUrl?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      warning: draft.warning?.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-4">
        <h2 className="font-heading text-xl font-medium">
          {isExisting ? 'Edit strategy' : 'New strategy'}
        </h2>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isSaving || !draft.name.trim()}
            className="border-green-400/50 text-green-400 hover:border-green-400 hover:text-green-400"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <Label>Tags</Label>
          <ChipInput values={draft.tags} onChange={tags => setDraft({ ...draft, tags })} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strat-name">Name</Label>
            <Input
              id="strat-name"
              value={draft.name}
              onChange={event => setDraft({ ...draft, name: event.target.value })}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strat-profit">Profit (d/hr)</Label>
            <Input
              id="strat-profit"
              type="number"
              value={draft.profitPerHour ?? ''}
              onChange={event =>
                setDraft({
                  ...draft,
                  profitPerHour: event.target.value === '' ? undefined : Number(event.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strat-source">Source URL</Label>
          <Input
            id="strat-source"
            value={draft.sourceUrl ?? ''}
            onChange={event => setDraft({ ...draft, sourceUrl: event.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strat-master">Master</Label>
            <Combobox
              id="strat-master"
              options={MASTER_NAMES}
              value={draft.master.name}
              onChange={name => setDraft({ ...draft, master: { ...draft.master, name } })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strat-nodes">Master nodes</Label>
            <Input
              id="strat-nodes"
              value={draft.master.nodes}
              onChange={event =>
                setDraft({ ...draft, master: { ...draft.master, nodes: event.target.value } })
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Tablets</Label>
            <Button type="button" size="xs" variant="outline" onClick={addTablet}>
              <Plus /> Add tablet
            </Button>
          </div>
          {draft.tablets.length === 0 && (
            <p className="text-sm text-muted-foreground">No tablets yet.</p>
          )}
          {draft.tablets.map((tablet, index) => (
            <div key={index} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Combobox
                    options={TABLET_TYPES}
                    value={tablet.type}
                    onChange={type => updateTablet(index, { type })}
                  />
                </div>
                <div className="flex w-20 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={tablet.quantity}
                    onChange={event =>
                      updateTablet(index, {
                        quantity: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeTablet(index)}
                  className="text-destructive hover:text-destructive"
                  title="Remove tablet"
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mods</Label>
                <ChipInput values={tablet.mods} onChange={mods => updateTablet(index, { mods })} />
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Trade URL</Label>
                <Input
                  value={tablet.tradeUrl ?? ''}
                  onChange={event =>
                    updateTablet(index, { tradeUrl: event.target.value || undefined })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strat-notes">Notes</Label>
          <Textarea
            id="strat-notes"
            value={draft.notes ?? ''}
            onChange={event => setDraft({ ...draft, notes: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strat-warning">Warning</Label>
          <Input
            id="strat-warning"
            value={draft.warning ?? ''}
            onChange={event => setDraft({ ...draft, warning: event.target.value })}
          />
        </div>
      </div>
    </form>
  )
}
