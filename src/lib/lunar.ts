import * as A from 'astronomy-engine'
import { bisect, diff, lonOf, norm, signOf, type Planet, type Sign, MODERN_VOC, TRADITIONAL_VOC } from './astro'

const HOUR = 3600_000
const DAY = 24 * HOUR
const moon = (t: number) => lonOf('Moon', new Date(t))

export const ASPECTS = [
  { name: 'conjunction', angle: 0, glyph: '☌' },
  { name: 'sextile', angle: 60, glyph: '⚹' },
  { name: 'square', angle: 90, glyph: '□' },
  { name: 'trine', angle: 120, glyph: '△' },
  { name: 'opposition', angle: 180, glyph: '☍' },
] as const
export type AspectName = (typeof ASPECTS)[number]['name']

/** Every separation the Moon can perfect an aspect at (sextile, square and trine on both sides). */
const TARGETS: { aspect: AspectName; sep: number }[] = ASPECTS.flatMap((a): { aspect: AspectName; sep: number }[] =>
  a.angle === 0 || a.angle === 180
    ? [{ aspect: a.name, sep: a.angle }]
    : [{ aspect: a.name, sep: a.angle }, { aspect: a.name, sep: -a.angle }],
)

export interface Ingress {
  time: Date
  sign: Sign
}

/** Next time the Moon changes sign after t. */
export function nextIngress(from: Date): Ingress {
  const t0 = from.getTime()
  const startSign = Math.floor(moon(t0) / 30)
  let a = t0
  for (let b = t0 + HOUR; b < t0 + 4 * DAY; b += HOUR) {
    if (Math.floor(moon(b) / 30) !== startSign) {
      const boundary = ((startSign + 1) % 12) * 30
      const time = bisect((t) => diff(moon(t), boundary), a, b)
      return { time, sign: signOf(boundary + 1) }
    }
    a = b
  }
  throw new Error('no ingress found')
}

/** Most recent time the Moon entered its current sign. */
export function prevIngress(from: Date): Ingress {
  const t0 = from.getTime()
  const startSign = Math.floor(moon(t0) / 30)
  let b = t0
  for (let a = t0 - HOUR; a > t0 - 4 * DAY; a -= HOUR) {
    if (Math.floor(moon(a) / 30) !== startSign) {
      const boundary = startSign * 30
      const time = bisect((t) => diff(moon(t), boundary), a, b)
      return { time, sign: signOf(boundary + 1) }
    }
    b = a
  }
  throw new Error('no ingress found')
}

export interface Perfection {
  time: Date
  aspect: AspectName
  to: string
}

/** Times in [t0, t1] when the Moon perfects an aspect to a moving body or a fixed longitude. */
export function perfections(
  t0: number,
  t1: number,
  targets: { name: string; lon: (t: number) => number }[],
  step = HOUR,
): Perfection[] {
  const out: Perfection[] = []
  const sample = (t: number) => {
    const m = moon(t)
    return targets.map((p) => diff(m, p.lon(t)))
  }
  let prevT = t0
  let prev = sample(t0)
  for (let t = Math.min(t0 + step, t1); ; t = Math.min(t + step, t1)) {
    const cur = sample(t)
    targets.forEach((p, i) => {
      for (const target of TARGETS) {
        const g0 = diff(prev[i], target.sep)
        const g1 = diff(cur[i], target.sep)
        if (g0 < 0 && g1 >= 0 && g1 - g0 < 30) {
          const time = bisect((x) => diff(diff(moon(x), p.lon(x)), target.sep), prevT, t)
          out.push({ time, aspect: target.aspect, to: p.name })
        }
      }
    })
    if (t >= t1) break
    prevT = t
    prev = cur
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime())
}

export type VocMode = 'modern' | 'traditional'

export interface VoidWindow {
  start: Date
  end: Date
  lastAspect: Perfection | null
  nextSign: Sign
}

const vocCache = new Map<string, VoidWindow>()

/** The void-of-course window that ends at the ingress closing the sign the Moon is in at `at`. */
export function voidForSignAt(at: Date, mode: VocMode = 'modern'): VoidWindow {
  const enter = prevIngress(at)
  const leave = nextIngress(at)
  const key = `${mode}:${leave.time.getTime()}`
  const cached = vocCache.get(key)
  if (cached) return cached
  const bodies = (mode === 'modern' ? MODERN_VOC : TRADITIONAL_VOC).map((p: Planet) => ({
    name: p,
    lon: (t: number) => lonOf(p, new Date(t)),
  }))
  const hits = perfections(enter.time.getTime(), leave.time.getTime(), bodies, 2 * HOUR)
  const last = hits.length ? hits[hits.length - 1] : null
  const result = { start: last ? last.time : enter.time, end: leave.time, lastAspect: last, nextSign: leave.sign }
  vocCache.set(key, result)
  return result
}

export function voidStatus(at: Date, mode: VocMode = 'modern') {
  const w = voidForSignAt(at, mode)
  return { ...w, isVoid: at >= w.start && at < w.end }
}

export interface Lunation {
  kind: 'New Moon' | 'First Quarter' | 'Full Moon' | 'Last Quarter'
  time: Date
  lon: number
  sign: Sign
  eclipse?: string
  supermoon?: boolean
}

const QUARTER_NAMES = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'] as const

export function upcomingLunations(from: Date, count = 4): Lunation[] {
  const out: Lunation[] = []
  let q = A.SearchMoonQuarter(from)
  for (let i = 0; i < count; i++) {
    const time = q.time.date
    const lon = lonOf('Moon', time)
    const kind = QUARTER_NAMES[q.quarter]
    const l: Lunation = { kind, time, lon, sign: signOf(lon) }
    if (kind === 'New Moon' || kind === 'Full Moon') {
      const km = A.GeoMoon(time).Length() * A.KM_PER_AU
      l.supermoon = km < 361_000
      if (kind === 'Full Moon') {
        const e = A.SearchLunarEclipse(new Date(time.getTime() - 2 * DAY))
        if (Math.abs(e.peak.date.getTime() - time.getTime()) < DAY) l.eclipse = `${cap(e.kind)} lunar eclipse`
      } else {
        const e = A.SearchGlobalSolarEclipse(new Date(time.getTime() - 2 * DAY))
        if (Math.abs(e.peak.date.getTime() - time.getTime()) < DAY) l.eclipse = `${cap(e.kind)} solar eclipse`
      }
    }
    out.push(l)
    q = A.NextMoonQuarter(q)
  }
  return out
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Next time the transiting Moon returns to a natal Moon longitude. */
export function nextLunarReturn(from: Date, natalMoon: number): Date {
  const t0 = from.getTime()
  let a = t0
  let ga = diff(moon(a), natalMoon)
  for (let b = t0 + 6 * HOUR; b < t0 + 30 * DAY; b += 6 * HOUR) {
    const gb = diff(moon(b), natalMoon)
    if (ga < 0 && gb >= 0 && gb - ga < 30) return bisect((t) => diff(moon(t), natalMoon), a, b)
    a = b
    ga = gb
  }
  throw new Error('no return found')
}

export { norm }
