export const ascendancyIconUrl = (name: string): string => {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  return `https://assets.poe.ninja/poe2/classes/${slug}.webp`
}
