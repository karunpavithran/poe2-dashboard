import { PbfReader } from 'pbf'

// Typed readers for poe.ninja's PoE2 builds protobuf API.
// Field layout derived by probing — see memory/poeninja-poe2-builds-api.md.

type SkillEntry = { id: number; count: number }
type Dimension = { key: string; label: string; entries: SkillEntry[] }
type DictionaryRef = { label: string; hash: string }

export type SearchResult = {
  total: number
  dimensions: Dimension[]
  dictionaries: DictionaryRef[]
}

const readEntry = (tag: number, obj: SkillEntry, pbf: PbfReader) => {
  if (tag === 1) obj.id = pbf.readVarint()
  else if (tag === 2) obj.count = pbf.readVarint()
}

const readDimension = (tag: number, obj: Dimension, pbf: PbfReader) => {
  if (tag === 1) obj.key = pbf.readString()
  else if (tag === 2) obj.label = pbf.readString()
  else if (tag === 3) obj.entries.push(pbf.readMessage(readEntry, { id: 0, count: 0 }))
}

const readDictionaryRef = (tag: number, obj: DictionaryRef, pbf: PbfReader) => {
  if (tag === 1) obj.label = pbf.readString()
  else if (tag === 2) obj.hash = pbf.readString()
}

const readSearchResult = (tag: number, obj: SearchResult, pbf: PbfReader) => {
  if (tag === 1) obj.total = pbf.readVarint()
  else if (tag === 2)
    obj.dimensions.push(pbf.readMessage(readDimension, { key: '', label: '', entries: [] }))
  else if (tag === 6)
    obj.dictionaries.push(pbf.readMessage(readDictionaryRef, { label: '', hash: '' }))
}

/** Decodes the outer envelope (field 1) then the SearchResult inside it. */
export const decodeSearchResult = (buf: Uint8Array): SearchResult => {
  let inner: Uint8Array | null = null
  new PbfReader(buf).readFields((tag, _, pbf) => {
    if (tag === 1) inner = pbf.readBytes()
  }, null)
  if (!inner) throw new Error('poe.ninja search response missing result field')
  return new PbfReader(inner).readFields(readSearchResult, {
    total: 0,
    dimensions: [],
    dictionaries: [],
  })
}

/** Decodes a content-addressed dictionary; field 2 is the name list indexed by entry id. */
export const decodeDictionaryNames = (buf: Uint8Array): string[] =>
  new PbfReader(buf).readFields((tag, names, pbf) => {
    if (tag === 2) names.push(pbf.readString())
  }, [] as string[])
