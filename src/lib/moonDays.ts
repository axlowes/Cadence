import * as A from 'astronomy-engine'
import { fromKey, dateKey } from './dates'
import type { MoonWhen } from './db'

interface DayMoon {
  waxing: boolean
  newMoon: boolean
  fullMoon: boolean
}

const cache = new Map<string, DayMoon>()

/** The Moon's character for a local calendar day. */
export function moonOfDay(k: string): DayMoon {
  const hit = cache.get(k)
  if (hit) return hit
  const noon = fromKey(k)
  const start = new Date(noon)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const a0 = A.MoonPhase(start)
  const a1 = A.MoonPhase(end)
  const angle = A.MoonPhase(noon)
  const result = {
    waxing: angle < 180,
    newMoon: a1 < a0, // wrapped past 360 during the day
    fullMoon: a0 < 180 && a1 >= 180,
  }
  cache.set(k, result)
  return result
}

export function matchesMoon(k: string, when: MoonWhen[]) {
  const m = moonOfDay(k)
  return when.some((w) => (w === 'newmoon' ? m.newMoon : w === 'fullmoon' ? m.fullMoon : w === 'waxing' ? m.waxing : !m.waxing))
}

export function nextMoonDay(fromKeyStr: string, kind: 'newmoon' | 'fullmoon') {
  const start = fromKey(fromKeyStr)
  start.setHours(23, 59, 0, 0)
  const q = A.SearchMoonQuarter(start)
  let cur = q
  while (cur.quarter !== (kind === 'newmoon' ? 0 : 2)) cur = A.NextMoonQuarter(cur)
  return dateKey(cur.time.date)
}

export const MOON_WHEN_LABEL: Record<MoonWhen, string> = {
  newmoon: 'New Moon day',
  waxing: 'While waxing',
  fullmoon: 'Full Moon day',
  waning: 'While waning',
}
