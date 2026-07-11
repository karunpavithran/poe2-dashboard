/**
 * Parses the advanced item text PoE2 puts on the clipboard (Ctrl+Alt+C) and
 * scores each modifier roll against its possible range.
 *
 * Only explicit modifier blocks — the `{ Prefix Modifier "Name" (Tier: 1) … }`
 * headers plus the stat lines under them — carry rolls a Divine Orb can
 * reroll, so those are all we extract. Rune/implicit/enchant lines and the
 * item metadata sections are ignored. Fractured mods are parsed (so the UI can
 * show them) but flagged: a Divine Orb cannot touch them.
 *
 * Divine rerolls pick each roll uniformly from the integers in its `(min-max)`
 * annotation, which makes the math exact counting: a roll's percentile is the
 * share of possible outcomes at or below the current value.
 */

/** One rerollable value on a stat line: `98(92-100)` → value 98 in [92, 100]. */
export type ItemRoll = {
  value: number
  min: number
  max: number
}

/** One stat line of a mod, e.g. `+33(33-39) to maximum Mana`. */
export type ItemModLine = {
  /** Display text with the `(min-max)` annotations stripped. */
  text: string
  /** Rolls in the order they appear in the line; empty for fixed lines. */
  rolls: ItemRoll[]
}

export type ItemMod = {
  /** Full header text between the braces. */
  header: string
  /** Quoted mod name (`Unassailable`), if the header carries one. */
  name: string | null
  tier: number | null
  /** Fractured mods cannot be rerolled by a Divine Orb. */
  fractured: boolean
  lines: ItemModLine[]
}

export type ParsedItem = {
  itemClass: string | null
  rarity: string | null
  name: string | null
  baseType: string | null
  mods: ItemMod[]
}

const SEPARATOR = /^-{4,}$/
const MOD_HEADER = /^\{\s*(.+?)\s*\}$/
// `98(92-100)` and `-15(-20--11)` both parse: `-?` on each bound absorbs the
// extra dash negative ranges print with.
const ROLL = /(-?\d+(?:\.\d+)?)\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g

const parseModLine = (text: string): ItemModLine => {
  const rolls: ItemRoll[] = []
  for (const match of text.matchAll(ROLL)) {
    rolls.push({ value: Number(match[1]), min: Number(match[2]), max: Number(match[3]) })
  }
  return { text: text.replace(ROLL, '$1'), rolls }
}

export const parseItemText = (text: string): ParsedItem => {
  const item: ParsedItem = {
    itemClass: null,
    rarity: null,
    name: null,
    baseType: null,
    mods: [],
  }

  // The first section names the item: metadata prefixes, then (for rare and
  // unique items) the given name followed by the base type.
  const headerFreeLines: string[] = []
  let inFirstSection = true
  let currentMod: ItemMod | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue

    if (SEPARATOR.test(line)) {
      inFirstSection = false
      currentMod = null
      continue
    }

    if (inFirstSection) {
      if (line.startsWith('Item Class:')) item.itemClass = line.slice('Item Class:'.length).trim()
      else if (line.startsWith('Rarity:')) item.rarity = line.slice('Rarity:'.length).trim()
      else headerFreeLines.push(line)
      continue
    }

    const headerMatch = MOD_HEADER.exec(line)
    if (headerMatch) {
      const header = headerMatch[1] ?? ''
      const tierMatch = /\(Tier:\s*(\d+)\)/.exec(header)
      currentMod = {
        header,
        name: /"([^"]+)"/.exec(header)?.[1] ?? null,
        tier: tierMatch ? Number(tierMatch[1]) : null,
        fractured: /\bFractured\b/.test(header),
        lines: [],
      }
      item.mods.push(currentMod)
      continue
    }

    // Stat lines belong to the mod header above them; anything else (quality,
    // sockets, rune lines, the trailing "Fractured Item" tag) is not a mod.
    if (currentMod) currentMod.lines.push(parseModLine(line))
  }

  // Single-line first sections (normal/magic items) only carry the base type.
  if (headerFreeLines.length >= 2) {
    item.name = headerFreeLines[0] ?? null
    item.baseType = headerFreeLines[1] ?? null
  } else {
    item.baseType = headerFreeLines[0] ?? null
  }

  return item
}

/** Number of integer values a Divine Orb can land on for this roll. */
export const rollOutcomes = (roll: ItemRoll): number => roll.max - roll.min + 1

/**
 * Share of possible divine outcomes at or below the current value, in [0, 1].
 * A max roll is 1; the worst roll of a 9-value range is 1/9, not 0 — a fresh
 * divine has that same 1/9 chance of landing there.
 */
export const rollPercentile = (roll: ItemRoll): number =>
  (roll.value - roll.min + 1) / rollOutcomes(roll)

/** Chance a single divine rerolls this one value at or above its current roll. */
export const chanceToMatchOrBeat = (roll: ItemRoll): number =>
  (roll.max - roll.value + 1) / rollOutcomes(roll)

/**
 * Chance one Divine Orb reproduces or beats every given roll at once — the
 * "how lucky is this item" number. Rolls reroll independently, so it's the
 * product of the per-roll chances.
 */
export const combinedChanceToMatchOrBeat = (rolls: ItemRoll[]): number =>
  rolls.reduce((product, roll) => product * chanceToMatchOrBeat(roll), 1)

/**
 * Chance one Divine Orb strictly beats the given rolls: at or above the
 * current value on every roll, and above it on at least one. That's the
 * match-or-beat chance minus the single outcome that reproduces every roll
 * exactly. Zero when every roll is already at its maximum.
 *
 * Divine rerolls are independent trials, so the expected number of orbs to
 * see a strictly better outcome is 1 over this chance (geometric mean).
 */
export const combinedChanceToBeat = (rolls: ItemRoll[]): number =>
  combinedChanceToMatchOrBeat(rolls) -
  rolls.reduce((product, roll) => product / rollOutcomes(roll), 1)

// Resolution for a roll's position within its range in cumulativePercentile.
// Positions are quantised to thousandths of the range so the convolution runs
// over small integer sums; the binning error is far below display precision.
const POSITION_SCALE = 1000

/**
 * Percentile of the item's total roll quality among every outcome a Divine
 * Orb could produce: the share of outcomes whose rolls, each measured as a
 * position within its own range (so a wide range counts no more than a narrow
 * one), sum to at or below this item's total. Computed exactly by convolving
 * the per-roll uniform distributions — not the product of per-roll
 * percentiles, which would answer the much stricter "worse on every roll".
 *
 * With one roll this reduces to `rollPercentile`. Collapsed ranges (min ===
 * max) have no position and drop out; with no effective rolls it's 1.
 */
export const cumulativePercentile = (rolls: ItemRoll[]): number => {
  const variable = rolls.filter(roll => roll.max > roll.min)
  if (variable.length === 0) return 1

  const position = (roll: ItemRoll, value: number) =>
    Math.round(((value - roll.min) * POSITION_SCALE) / (roll.max - roll.min))

  // dist[s] = probability the rolls so far sum to position s.
  let dist = [1]
  for (const roll of variable) {
    const outcomes = rollOutcomes(roll)
    const next = new Array<number>(dist.length + POSITION_SCALE).fill(0)
    for (let s = 0; s < dist.length; s++) {
      const p = dist[s] ?? 0
      if (p === 0) continue
      for (let value = roll.min; value <= roll.max; value++) {
        const index = s + position(roll, value)
        next[index] = (next[index] ?? 0) + p / outcomes
      }
    }
    dist = next
  }

  const total = variable.reduce((sum, roll) => sum + position(roll, roll.value), 0)
  return dist.slice(0, total + 1).reduce((sum, p) => sum + p, 0)
}
