import { describe, expect, it } from 'vitest'

import {
  chanceToMatchOrBeat,
  combinedChanceToBeat,
  combinedChanceToMatchOrBeat,
  cumulativePercentile,
  invertRoll,
  parseItemText,
  rollPercentile,
} from '../src/itemRolls.js'

// Verbatim Ctrl+Alt+C output for a fractured rare helmet, including the quirks
// the parser has to survive: a hybrid mod with two rolls, a fractured crafted
// suffix, a rune line outside any mod block, and trailing whitespace.
const HELMET = `Item Class: Helmets
Rarity: Rare
Dread Veil
Kamasan Tiara
--------
Quality: +22% (augmented)
Energy Shield: 599 (augmented)
--------
Requires: Level 75, 103 (augmented) Int
--------
Sockets: S S
--------
Item Level: 82
--------
40% increased Armour, Evasion and Energy Shield (rune)
--------
{ Prefix Modifier "Unassailable" (Tier: 1) — Energy Shield }
98(92-100)% increased Energy Shield
{ Prefix Modifier "Angel's" (Tier: 1) — Mana, Energy Shield }
41(39-42)% increased Energy Shield
+33(33-39) to maximum Mana
{ Desecrated Prefix Modifier "Dazzling" (Tier: 1) — Energy Shield }
+73(61-73) to maximum Energy Shield
{ Fractured Crafted Suffix Modifier "of Archaeology" (Tier: 1) }
16(15-18)% increased Rarity of Items found
{ Suffix Modifier "of the Virtuoso" (Tier: 2) — Attribute }
+31(31-33) to Intelligence
{ Suffix Modifier "of Ephij" (Tier: 1) — Elemental, Lightning, Resistance }
+43(41-45)% to Lightning Resistance
--------
Fractured Item`

describe('parseItemText', () => {
  const item = parseItemText(HELMET)

  it('reads the naming section', () => {
    expect(item.itemClass).toBe('Helmets')
    expect(item.rarity).toBe('Rare')
    expect(item.name).toBe('Dread Veil')
    expect(item.baseType).toBe('Kamasan Tiara')
  })

  it('finds exactly the six explicit mods, ignoring rune and metadata lines', () => {
    expect(item.mods).toHaveLength(6)
    expect(item.mods.map(mod => mod.name)).toEqual([
      'Unassailable',
      "Angel's",
      'Dazzling',
      'of Archaeology',
      'of the Virtuoso',
      'of Ephij',
    ])
  })

  it('reads tiers and flags the fractured mod', () => {
    expect(item.mods[4].tier).toBe(2)
    expect(item.mods.map(mod => mod.fractured)).toEqual([false, false, false, true, false, false])
  })

  it('splits the hybrid mod into two lines, each with its own roll', () => {
    const angels = item.mods[1]
    expect(angels.lines).toEqual([
      { text: '41% increased Energy Shield', rolls: [{ value: 41, min: 39, max: 42 }] },
      { text: '+33 to maximum Mana', rolls: [{ value: 33, min: 33, max: 39 }] },
    ])
  })

  it('strips the range annotation from display text', () => {
    expect(item.mods[0].lines[0].text).toBe('98% increased Energy Shield')
  })

  it('captures multiple rolls on a single line', () => {
    const parsed = parseItemText(`Item Class: Wands
Rarity: Magic
Sparking Wand
--------
{ Prefix Modifier "Sparking" (Tier: 3) }
Adds 5(3-6) to 9(8-12) Lightning Damage`)
    expect(parsed.mods[0].lines[0]).toEqual({
      text: 'Adds 5 to 9 Lightning Damage',
      rolls: [
        { value: 5, min: 3, max: 6 },
        { value: 9, min: 8, max: 12 },
      ],
    })
    // A single header-free line means there was no given name, just the base.
    expect(parsed.name).toBeNull()
    expect(parsed.baseType).toBe('Sparking Wand')
  })

  it('handles unique-item ranges: signed bounds and high-to-low order', () => {
    const parsed = parseItemText(`Item Class: Body Armours
Rarity: Unique
Loreweave
Ornate Ringmail
--------
{ Unique Modifier — Attack }
+70(-200-+400) to Accuracy Rating
{ Unique Modifier — Mana }
+31(-10-+40) to maximum Mana
{ Unique Modifier }
9(20--20)% reduced Rarity of Items found`)
    expect(parsed.mods.map(mod => mod.lines[0])).toEqual([
      { text: '+70 to Accuracy Rating', rolls: [{ value: 70, min: -200, max: 400 }] },
      { text: '+31 to maximum Mana', rolls: [{ value: 31, min: -10, max: 40 }] },
      // "9% reduced" is a negative "increased" roll: value and bounds are
      // sign-flipped back onto the canonical axis and the wording follows.
      { text: '-9% increased Rarity of Items found', rolls: [{ value: -9, min: -20, max: 20 }] },
    ])
    // Headers without a quoted name or tier still parse.
    expect(parsed.mods[0].name).toBeNull()
    expect(parsed.mods[0].tier).toBeNull()
  })

  it('canonicalises wholly reduced/less mods onto the increased/more axis', () => {
    const parsed = parseItemText(`Item Class: Boots
Rarity: Rare
Test
Boots
--------
{ Suffix Modifier "of Testing" (Tier: 1) }
15(10-20)% reduced Mana Cost of Skills
{ Suffix Modifier "of Slowing" (Tier: 1) }
5(3-8)% less Projectile Speed
{ Suffix Modifier "of Stasis" (Tier: 1) }
Projectiles are reduced to a standstill`)
    expect(parsed.mods.map(mod => mod.lines[0])).toEqual([
      { text: '-15% increased Mana Cost of Skills', rolls: [{ value: -15, min: -20, max: -10 }] },
      { text: '-5% more Projectile Speed', rolls: [{ value: -5, min: -8, max: -3 }] },
      // No rolls on the line — the wording is left as printed.
      { text: 'Projectiles are reduced to a standstill', rolls: [] },
    ])
  })

  it('handles negative ranges with their doubled dashes', () => {
    const parsed = parseItemText(`Item Class: Rings
Rarity: Rare
Test
Ring
--------
{ Suffix Modifier "of Testing" (Tier: 1) }
-15(-20--11) to maximum Life`)
    expect(parsed.mods[0].lines[0].rolls).toEqual([{ value: -15, min: -20, max: -11 }])
  })
})

describe('roll math', () => {
  it('scores a roll as the share of outcomes at or below it', () => {
    // 98 in 92-100: nine outcomes, seven of them (92..98) at or below.
    expect(rollPercentile({ value: 98, min: 92, max: 100 })).toBeCloseTo(7 / 9)
    expect(rollPercentile({ value: 100, min: 92, max: 100 })).toBe(1)
    expect(rollPercentile({ value: 92, min: 92, max: 100 })).toBeCloseTo(1 / 9)
  })

  it('a range collapsed to one value is always the 100th percentile', () => {
    expect(rollPercentile({ value: 5, min: 5, max: 5 })).toBe(1)
    expect(chanceToMatchOrBeat({ value: 5, min: 5, max: 5 })).toBe(1)
  })

  it('chance to match or beat counts the outcomes at or above', () => {
    expect(chanceToMatchOrBeat({ value: 98, min: 92, max: 100 })).toBeCloseTo(3 / 9)
  })

  it('cumulative percentile of a single roll is its own percentile', () => {
    const roll = { value: 98, min: 92, max: 100 }
    expect(cumulativePercentile([roll])).toBeCloseTo(rollPercentile(roll))
  })

  it('cumulative percentile counts outcomes at or below the total position', () => {
    // Two coin-flip rolls (two outcomes each): sums 0, ½, ½, 1. One max + one
    // min lands on ½, and 3 of 4 outcomes are at or below that.
    const low = { value: 1, min: 1, max: 2 }
    const high = { value: 2, min: 1, max: 2 }
    expect(cumulativePercentile([low, high])).toBeCloseTo(3 / 4)
    expect(cumulativePercentile([high, high])).toBe(1)
    // Only the both-min outcome is at or below the both-min total.
    expect(cumulativePercentile([low, low])).toBeCloseTo(1 / 4)
  })

  it('cumulative percentile ignores collapsed ranges', () => {
    const fixed = { value: 5, min: 5, max: 5 }
    const roll = { value: 98, min: 92, max: 100 }
    expect(cumulativePercentile([fixed, roll])).toBeCloseTo(rollPercentile(roll))
    expect(cumulativePercentile([fixed])).toBe(1)
    expect(cumulativePercentile([])).toBe(1)
  })

  it('inverting a roll measures it toward the minimum', () => {
    const roll = { value: 98, min: 92, max: 100 }
    // 98 is 7th of 9 counting up, so 3rd of 9 counting down.
    expect(rollPercentile(invertRoll(roll))).toBeCloseTo(3 / 9)
    expect(chanceToMatchOrBeat(invertRoll(roll))).toBeCloseTo(7 / 9)
    expect(invertRoll(invertRoll(roll))).toEqual(roll)
  })

  it('chance to strictly beat excludes the exact-reproduction outcome', () => {
    // 98 in 92-100: match-or-beat is 3/9; only 99 and 100 strictly beat it.
    expect(combinedChanceToBeat([{ value: 98, min: 92, max: 100 }])).toBeCloseTo(2 / 9)
    // Two coin-flip rolls, one at max, one at min: beat = P(both ≥) − P(both
    // exact) = (1 × ½) − ¼.
    expect(
      combinedChanceToBeat([
        { value: 2, min: 1, max: 2 },
        { value: 1, min: 1, max: 2 },
      ]),
    ).toBeCloseTo(1 / 4)
    // All rolls at their max can never be beaten.
    expect(combinedChanceToBeat([{ value: 100, min: 92, max: 100 }])).toBeCloseTo(0)
    expect(combinedChanceToBeat([])).toBe(0)
  })

  it('combined chance multiplies independent rolls', () => {
    const rolls = [
      { value: 98, min: 92, max: 100 }, // 3/9
      { value: 41, min: 39, max: 42 }, // 2/4
    ]
    expect(combinedChanceToMatchOrBeat(rolls)).toBeCloseTo((3 / 9) * (2 / 4))
    expect(combinedChanceToMatchOrBeat([])).toBe(1)
  })
})
