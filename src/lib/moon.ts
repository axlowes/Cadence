import * as Astronomy from 'astronomy-engine'

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const

export interface MoonToday {
  angle: number // 0 new, 180 full
  illumination: number // 0..1
  ageDays: number
  phaseName: string
  sign: (typeof SIGNS)[number]
  degree: number
}

const SYNODIC = 29.530588

export function phaseName(angle: number) {
  const near = (target: number) => Math.abs(((angle - target + 540) % 360) - 180) < 6
  if (near(0)) return 'New Moon'
  if (near(90)) return 'First Quarter'
  if (near(180)) return 'Full Moon'
  if (near(270)) return 'Last Quarter'
  if (angle < 90) return 'Waxing Crescent'
  if (angle < 180) return 'Waxing Gibbous'
  if (angle < 270) return 'Waning Gibbous'
  return 'Waning Crescent'
}

export function moonAt(date: Date): MoonToday {
  const angle = Astronomy.MoonPhase(date)
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction
  const lon = Astronomy.EclipticGeoMoon(date).lon
  return {
    angle,
    illumination,
    ageDays: (angle / 360) * SYNODIC,
    phaseName: phaseName(angle),
    sign: SIGNS[Math.floor(lon / 30) % 12],
    degree: Math.floor(lon % 30),
  }
}
