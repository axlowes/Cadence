import { useMemo } from 'react'
import { moonAt } from './moon'
import { nextIngress, upcomingLunations, voidStatus, nextLunarReturn, type VocMode } from './lunar'
import { dayBounds, moonHouse, moonTransits } from './transits'
import type { Natal } from './natal'
import { houseOf } from './astro'

/** Everything the screens need about today's Moon, recomputed once a minute at most. */
export function useMoon(now: Date, natal: Natal | null, vocMode: VocMode) {
  const minute = Math.floor(now.getTime() / 60_000)
  return useMemo(() => {
    const t = new Date(minute * 60_000)
    const moon = moonAt(t)
    const ingress = nextIngress(t)
    const voc = voidStatus(t, vocMode)
    // if this sign's void has passed, the next one belongs to the next sign
    const nextVoid = !voc.isVoid && t >= voc.end ? voidStatus(new Date(voc.end.getTime() + 60_000), vocMode) : voc
    const lunations = upcomingLunations(t, 4).map((l) => ({
      ...l,
      house: natal?.cusps ? houseOf(l.lon, natal.cusps) : null,
    }))
    const { start, end } = dayBounds(t)
    const transits = natal ? moonTransits(natal, start, end, t) : []
    const house = natal ? moonHouse(natal, t) : null
    const natalMoon = natal?.points.find((p) => p.name === 'Moon')?.lon
    const lunarReturn = natalMoon !== undefined ? nextLunarReturn(new Date(start.getTime() - 86400_000), natalMoon) : null
    return { moon, ingress, voc, nextVoid, lunations, transits, house, lunarReturn, dayStart: start, dayEnd: end }
  }, [minute, natal, vocMode])
}

export type MoonInfo = ReturnType<typeof useMoon>
