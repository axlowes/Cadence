import * as A from 'astronomy-engine'

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const
export type Sign = (typeof SIGNS)[number]
export const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']
export const ELEMENT: Record<Sign, 'Fire' | 'Earth' | 'Air' | 'Water'> = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
}

export type Planet =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'
export const PLANETS: Planet[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
export const MODERN_VOC: Planet[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
export const TRADITIONAL_VOC: Planet[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']

export const norm = (x: number) => ((x % 360) + 360) % 360
/** Signed smallest difference a - b in (-180, 180]. */
export const diff = (a: number, b: number) => {
  const d = norm(a - b)
  return d > 180 ? d - 360 : d
}
export const signOf = (lon: number) => SIGNS[Math.floor(norm(lon) / 30)]
export const degIn = (lon: number) => norm(lon) % 30

export function formatDeg(lon: number) {
  const d = degIn(lon)
  let deg = Math.floor(d)
  let min = Math.round((d - deg) * 60)
  if (min === 60) {
    deg += 1
    min = 0
  }
  return `${deg}°${String(min).padStart(2, '0')}′`
}

/** Geocentric apparent ecliptic longitude, tropical, of date. */
export function lonOf(body: Planet, date: Date): number {
  if (body === 'Moon') return norm(A.EclipticGeoMoon(date).lon)
  if (body === 'Sun') return norm(A.SunPosition(date).elon)
  const vec = A.GeoVector(A.Body[body], date, true)
  return norm(A.Ecliptic(vec).elon)
}

export function speedOf(body: Planet, date: Date) {
  const h = 3600_000
  return diff(lonOf(body, new Date(date.getTime() + h)), lonOf(body, new Date(date.getTime() - h))) * 12 // deg/day
}

/** Mean lunar node (the one most charts show as "mean node"). */
export function meanNode(date: Date) {
  const T = (A.MakeTime(date).tt) / 36525
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T * T * T * T) / 60616000)
}

export function obliquity(date: Date) {
  const tilt = A.e_tilt(A.MakeTime(date))
  return tilt.tobl
}

/** Find the moment in [t0, t1] where f crosses zero (f must change sign). */
export function bisect(f: (t: number) => number, t0: number, t1: number, tolMs = 1000) {
  let a = t0
  let b = t1
  let fa = f(a)
  for (let i = 0; i < 60 && b - a > tolMs; i++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m
      fa = fm
    } else b = m
  }
  return new Date((a + b) / 2)
}

const rad = Math.PI / 180
const sin = (d: number) => Math.sin(d * rad)
const cos = (d: number) => Math.cos(d * rad)
const tan = (d: number) => Math.tan(d * rad)
const atan2d = (y: number, x: number) => norm(Math.atan2(y, x) / rad)

export type HouseSystem = 'whole' | 'placidus'

export interface Angles {
  asc: number
  mc: number
  cusps: number[] // 12 cusps, cusps[0] = 1st house
}

export function angles(date: Date, lat: number, lon: number, system: HouseSystem): Angles {
  const eps = obliquity(date)
  const ramc = norm(A.SiderealTime(date) * 15 + lon)
  const mc = atan2d(sin(ramc), cos(ramc) * cos(eps))
  const asc = atan2d(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps)))
  let cusps: number[]
  if (system === 'whole') {
    const start = Math.floor(asc / 30) * 30
    cusps = Array.from({ length: 12 }, (_, i) => norm(start + i * 30))
  } else {
    const lonFromRa = (ra: number) => atan2d(sin(ra), cos(ra) * cos(eps))
    const cusp = (f: number, nocturnal: boolean) => {
      let lam = norm(nocturnal ? ramc + 180 : ramc) // first guess
      for (let i = 0; i < 30; i++) {
        const dec = Math.asin(sin(eps) * sin(lam)) / rad
        const x = Math.max(-1, Math.min(1, tan(lat) * tan(dec)))
        const ad = Math.asin(x) / rad
        const ra = nocturnal ? ramc + 180 - f * (90 - ad) : ramc + f * (90 + ad)
        lam = lonFromRa(norm(ra))
      }
      return lam
    }
    const c11 = cusp(1 / 3, false)
    const c12 = cusp(2 / 3, false)
    const c2 = cusp(2 / 3, true)
    const c3 = cusp(1 / 3, true)
    cusps = [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180), norm(asc + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12]
  }
  return { asc, mc, cusps }
}

export function houseOf(lon: number, cusps: number[]) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i]
    const b = cusps[(i + 1) % 12]
    const span = norm(b - a)
    if (norm(lon - a) < span) return i + 1
  }
  return 1
}
