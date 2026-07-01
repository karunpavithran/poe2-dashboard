// One-off probe: inspect pair coverage and rate asymmetry on the details endpoint.
const league = 'Runes of Aldur'

async function get(id: string) {
  const url = `https://poe.ninja/poe2/api/economy/exchange/current/details?league=${encodeURIComponent(league)}&type=Currency&id=${id}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'poe2-dashboard/0.1 (personal arbitrage tool)',
    },
  })
  if (!res.ok) throw new Error(`${id} -> HTTP ${res.status}`)
  return res.json() as Promise<{
    item: { id: string; name: string }
    pairs: { id: string; rate: number; volumePrimaryValue: number }[]
  }>
}

const ids = ['exalted-orb', 'chaos-orb', 'orb-of-alchemy']
for (const id of ids) {
  const d = await get(id)
  console.log(`=== ${d.item.name} (${d.pairs.length} pairs) ===`)
  for (const p of d.pairs) {
    console.log(`  vs ${p.id}: rate=${p.rate} vol=${p.volumePrimaryValue}`)
  }
}
