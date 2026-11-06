import * as Astronomy from 'astronomy-engine'
import { interpolate, formatHex, wcagContrast, wcagLuminance, parse, type Color } from 'culori'

export interface Place {
  lat: number
  lon: number
  label?: string
}

/** Until we know where she is, guess from the time zone offset so the sky is close. */
export function guessPlace(date = new Date()): Place {
  const offsetHours = -date.getTimezoneOffset() / 60
  return { lat: 40, lon: offsetHours * 15, label: 'your time zone' }
}

export function sunAltitude(date: Date, place: Place) {
  const obs = new Astronomy.Observer(place.lat, place.lon, 0)
  const eq = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true)
  return Astronomy.Horizon(date, obs, eq.ra, eq.dec, 'normal').altitude
}

/** 1 while the Sun is climbing (morning), 0 while it sinks, smooth in between. */
export function risingWeight(date: Date, place: Place) {
  const obs = new Astronomy.Observer(place.lat, place.lon, 0)
  const h = Astronomy.HourAngle(Astronomy.Body.Sun, date, obs) // 0..24, 0 = solar noon
  return 0.5 - 0.5 * Math.sin((h * Math.PI) / 12)
}

type Stops = [string, string, string]

const mid = (a: string, b: string) => formatHex(interpolate([a, b], 'oklch')(0.5))!

export const MOODS: Record<'night' | 'dawn' | 'day' | 'dusk', Stops> = {
  night: ['#0B0A1F', mid('#0B0A1F', '#2A1B4A'), '#2A1B4A'],
  dawn: ['#3B2F6B', '#F2A07B', '#F7D9C4'],
  day: ['#8EC5E8', mid('#8EC5E8', '#F5EEDC'), '#F5EEDC'],
  dusk: ['#2E2357', '#C2577A', '#F0A45A'],
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

function mixStops(a: Stops, b: Stops, t: number): Stops {
  return a.map((c, i) => formatHex(interpolate([c, b[i]], 'oklch')(t))!) as Stops
}

/** Night centers at -14°, dawn or dusk at -2° (the middle of -12..+8), day at +10°. */
function branch(alt: number, twilight: Stops): Stops {
  if (alt <= -2) return mixStops(MOODS.night, twilight, smooth((alt + 14) / 12))
  return mixStops(twilight, MOODS.day, smooth((alt + 2) / 12))
}

export interface SkyState {
  stops: Stops
  altitude: number
  stars: number // 0..1 star opacity
  ink: 'light' | 'dark'
  mood: 'night' | 'dawn' | 'day' | 'dusk'
}

const INK = { light: '#FBF6EE', dark: '#1E1633' }
const GLASS = {
  light: { color: '#120D2A', alpha: 0.5 }, // dark glass under light text
  dark: { color: '#FFFBF5', alpha: 0.58 }, // pale glass under dark text
}

function over(bg: string, glass: { color: string; alpha: number }) {
  return formatHex(interpolate([bg, glass.color], 'rgb')(glass.alpha))!
}

/** Worst-case contrast of text on a glass card anywhere over the gradient. */
export function minCardContrast(stops: Stops, ink: 'light' | 'dark') {
  return Math.min(...stops.map((s) => wcagContrast(INK[ink], over(s, GLASS[ink]))))
}

export function skyAt(date: Date, place: Place): SkyState {
  const altitude = sunAltitude(date, place)
  const w = risingWeight(date, place)
  const stops = mixStops(branch(altitude, MOODS.dusk), branch(altitude, MOODS.dawn), w)
  const ink = minCardContrast(stops, 'light') >= minCardContrast(stops, 'dark') ? 'light' : 'dark'
  const stars = smooth((-altitude - 6) / 8)
  let mood: SkyState['mood'] = 'day'
  if (altitude < -12) mood = 'night'
  else if (altitude <= 8) mood = w >= 0.5 ? 'dawn' : 'dusk'
  return { stops, altitude, stars, ink, mood }
}

export const inkColor = (ink: 'light' | 'dark') => INK[ink]
export const glassCss = (ink: 'light' | 'dark', strong = false) => {
  const g = strong ? { ...GLASS[ink], alpha: 0.84 } : GLASS[ink]
  const c = parse(g.color) as Color & { r: number; g: number; b: number }
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${g.alpha})`
}
export const luminance = (hex: string) => wcagLuminance(hex)
