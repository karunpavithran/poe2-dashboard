import type { AtlasStrategy } from '@poe2-dashboard/shared'

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

export const createEmptyStrategy = (): AtlasStrategy => ({
  id: crypto.randomUUID(),
  name: '',
  master: { name: '', nodes: '' },
  tablets: [],
  tags: [],
})
