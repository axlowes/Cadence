import { angles, houseOf, lonOf, meanNode, PLANETS, speedOf, type HouseSystem, type Planet } from './astro'

export interface BirthPlace {
  name: string
  lat: number
  lon: number
  tz: string
}

export interface Birth {
  date: string // YYYY-MM-DD
  time: string | null // HH:MM, null when unknown
  place: BirthPlace
}

export type PointName = Planet | 'North Node' | 'Ascendant' | 'Midheaven'

export interface NatalPoint {
  name: PointName
  lon: number
  retro?: boolean
  house?: number
}

export interface Natal {
  utc: Date
  timeKnown: boolean
  points: NatalPoint[]
  cusps: number[] | null
  system: HouseSystem
}

/** Offset in ms of a time zone at a given instant (local = utc + offset). */
function tzOffset(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - utcMs
}

/** Wall-clock time in an IANA zone to a real instant, using that zone's historical daylight saving. */
export function zonedToUtc(date: string, time: string, tz: string) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let utc = guess - tzOffset(guess, tz)
  utc = guess - tzOffset(utc, tz)
  return new Date(utc)
}

export function computeNatal(birth: Birth, system: HouseSystem): Natal {
  const timeKnown = !!birth.time
  const utc = zonedToUtc(birth.date, birth.time ?? '12:00', birth.place.tz)
  const points: NatalPoint[] = PLANETS.map((p) => ({
    name: p,
    lon: lonOf(p, utc),
    retro: p !== 'Sun' && p !== 'Moon' ? speedOf(p, utc) < 0 : undefined,
  }))
  points.push({ name: 'North Node', lon: meanNode(utc) })
  let cusps: number[] | null = null
  if (timeKnown) {
    const ang = angles(utc, birth.place.lat, birth.place.lon, system)
    cusps = ang.cusps
    points.push({ name: 'Ascendant', lon: ang.asc }, { name: 'Midheaven', lon: ang.mc })
    for (const p of points) if (p.name !== 'Ascendant' && p.name !== 'Midheaven') p.house = houseOf(p.lon, cusps)
  }
  return { utc, timeKnown, points, cusps, system }
}
