import content from '../content/content.json'
import { diff, houseOf, lonOf } from './astro'
import { perfections, type AspectName } from './lunar'
import type { Natal, PointName } from './natal'

export interface Transit {
  aspect: AspectName
  to: PointName
  exact: Date
  orb: number // current distance from exact, degrees
  active: boolean // within 3 degrees now
  meaning: string
}

const ANGLE: Record<AspectName, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 }

export function meaningFor(aspect: AspectName, to: PointName) {
  const set = (content.transits as Record<string, Record<string, string>>)[to]
  const key = aspect === 'conjunction' ? 'conjunction' : aspect === 'square' || aspect === 'opposition' ? 'tension' : 'flow'
  return set?.[key] ?? ''
}

export function aspectLabel(aspect: AspectName, to: PointName) {
  const word = content.aspectWords[aspect]
  return aspect === 'conjunction' ? `Moon meets your ${to}` : `Moon ${word} your ${to}`
}

/** Transiting Moon aspects to natal points, exact during [start, end], with current orbs. */
export function moonTransits(natal: Natal, start: Date, end: Date, now: Date): Transit[] {
  const targets = natal.points.map((p) => ({ name: p.name, lon: () => p.lon }))
  // search a little wider so an aspect that is active now but exact just outside the day still shows
  const hits = perfections(start.getTime() - 6 * 3600_000, end.getTime() + 6 * 3600_000, targets, 3600_000)
  const moonNow = lonOf('Moon', now)
  return hits
    .map((h) => {
      const point = natal.points.find((p) => p.name === h.to)!
      const sep = Math.abs(diff(moonNow, point.lon))
      const orb = Math.abs(sep - ANGLE[h.aspect])
      return {
        aspect: h.aspect,
        to: h.to as PointName,
        exact: h.time,
        orb,
        active: orb <= 3,
        meaning: meaningFor(h.aspect, h.to as PointName),
      }
    })
    .filter((t) => t.active || (t.exact >= start && t.exact < end))
}

export function moonHouse(natal: Natal, at: Date) {
  if (!natal.cusps) return null
  const house = houseOf(lonOf('Moon', at), natal.cusps)
  return { house, text: `The Moon is moving through ${(content.houses as Record<string, string>)[String(house)]}` }
}

export const noTimeNote = content.noTime

export function dayBounds(at: Date) {
  const s = new Date(at)
  s.setHours(0, 0, 0, 0)
  const e = new Date(s)
  e.setDate(e.getDate() + 1)
  return { start: s, end: e }
}
