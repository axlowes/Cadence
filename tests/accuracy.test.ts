import { describe, expect, it } from 'vitest'
import ref from './reference.json'
import { nextIngress, voidForSignAt } from '../src/lib/lunar'
import { computeNatal } from '../src/lib/natal'
import { signOf } from '../src/lib/astro'

const TWO_MIN = 2 * 60_000

describe('Moon against the Swiss Ephemeris (3 sample months)', () => {
  it('sign ingress times are within 2 minutes', () => {
    let worst = 0
    for (const iso of ref.ingresses) {
      const want = new Date(iso).getTime()
      const got = nextIngress(new Date(want - 3600_000)).time.getTime()
      worst = Math.max(worst, Math.abs(got - want))
    }
    console.log(`ingresses: ${ref.ingresses.length}, worst error ${(worst / 1000).toFixed(1)}s`)
    expect(worst).toBeLessThan(TWO_MIN)
  })

  it('void-of-course windows are within 2 minutes', () => {
    let worst = 0
    for (const v of ref.voids) {
      const end = new Date(v.end).getTime()
      const w = voidForSignAt(new Date(end - 60_000), 'modern')
      worst = Math.max(worst, Math.abs(w.start.getTime() - new Date(v.start).getTime()), Math.abs(w.end.getTime() - end))
    }
    console.log(`void windows: ${ref.voids.length}, worst error ${(worst / 1000).toFixed(1)}s`)
    expect(worst).toBeLessThan(TWO_MIN)
  })
})

describe('Natal chart', () => {
  it('handles historical daylight saving (Toronto, summer 1990 was EDT)', () => {
    const n = computeNatal(
      { date: '1990-07-15', time: '08:00', place: { name: 'Toronto', lat: 43.65, lon: -79.38, tz: 'America/Toronto' } },
      'whole',
    )
    expect(n.utc.toISOString()).toBe('1990-07-15T12:00:00.000Z')
    const sign = (name: string) => signOf(n.points.find((p) => p.name === name)!.lon)
    expect(sign('Sun')).toBe('Cancer')
  })
})
