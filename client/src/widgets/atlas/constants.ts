import type { AtlasStrategyInput } from '@poe2-dashboard/shared'

/**
 * Editor draft: the input fields plus the id when editing an existing strategy.
 * New drafts carry no id — the server generates one on create.
 */
export type StrategyDraft = AtlasStrategyInput & { id?: string }

/** Known atlas masters — used as datalist suggestions, free text still allowed. */
export const MASTER_NAMES = ['Dory', 'Jado'] as const

/** Common tablet families — datalist suggestions, free text still allowed. */
export const TABLET_TYPES = [
  'Deli',
  'Irradiating',
  'Abyss',
  'Breach',
  'Ritual',
  'Temple',
  'Expedition',
  'Increased Waystone %',
  'Mastered Domain (forest)',
  'Visions of Paradise',
] as const

export const createEmptyStrategy = (): StrategyDraft => ({
  name: '',
  master: { name: '', nodes: '' },
  tablets: [],
  tags: [],
})
