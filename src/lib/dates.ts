export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A date key as a local Date at noon (safe from daylight saving edges). */
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export const addDays = (k: string, n: number) => {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

export const addMonths = (k: string, n: number) => {
  const d = fromKey(k)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return dateKey(d)
}

export const weekday = (k: string) => fromKey(k).getDay()

/** Date key of the first day of k's week. */
export const weekStartOf = (k: string, weekStart: 0 | 1) => {
  const wd = weekday(k)
  return addDays(k, -((wd - weekStart + 7) % 7))
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const prettyDay = (k: string, today: string) => {
  if (k === today) return 'Today'
  if (k === addDays(today, 1)) return 'Tomorrow'
  if (k === addDays(today, -1)) return 'Yesterday'
  return fromKey(k).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
