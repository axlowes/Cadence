import type { CycleDay } from './db'
import { addDays } from './dates'
import { moonAt } from './moon'

export type Phase = 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal'

export const PHASE: Record<Phase, { season: string; line: string }> = {
  Menstrual: {
    season: 'your inner winter',
    line: 'Your inner winter. Energy draws down and inward, like sap returning to the roots. Rest is the work right now, and your intuition is at its clearest.',
  },
  Follicular: {
    season: 'your inner spring',
    line: 'Your inner spring. Energy is rising and curiosity comes back. A good stretch for beginnings, plans and saying yes to something new.',
  },
  Ovulatory: {
    season: 'your inner summer',
    line: 'Your inner summer, the full bloom. You are magnetic and easy to hear. Have the conversation, share the work, let yourself be seen.',
  },
  Luteal: {
    season: 'your inner autumn',
    line: 'Your inner autumn. The harvest is in and the edges get sharper. Finish things, clear the clutter, and be tender with yourself as the light lowers.',
  },
}

const diff = (a: string, b: string) => Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86_400_000)

export interface Period { start: string; days: number }

/** Groups logged flow days into periods. Spotting alone never starts one, and a gap of a day or two stays inside the same period. */
export function periods(days: CycleDay[]): Period[] {
  const real = days.filter((d) => d.flow !== 'spotting').map((d) => d.date).sort()
  const out: Period[] = []
  for (const k of real) {
    const cur = out.at(-1)
    if (cur && diff(addDays(cur.start, cur.days - 1), k) <= 2) cur.days = diff(cur.start, k) + 1
    else out.push({ start: k, days: 1 })
  }
  return out
}

export interface CycleInfo {
  day: number
  phase: Phase
  start: string
  cycleLength: number
  periodLength: number
  nextStart: string
  late: number // days past the expected start
}

export function lengths(ps: Period[], usualCycle = 28, usualPeriod = 5) {
  const gaps = ps.slice(1).map((p, i) => diff(ps[i].start, p.start)).filter((g) => g >= 18 && g <= 45).slice(-6)
  const cycleLength = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : usualCycle
  const done = ps.slice(0, -1).slice(-6)
  const periodLength = done.length ? Math.round(done.reduce((a, p) => a + p.days, 0) / done.length) : Math.max(usualPeriod, ps.at(-1)?.days ?? 0)
  return { cycleLength, periodLength }
}

/** Where the day k sits in her cycle, or null before her first logged period. */
export function cycleOn(ps: Period[], k: string, usualCycle = 28, usualPeriod = 5): CycleInfo | null {
  const before = ps.filter((p) => p.start <= k)
  const cur = before.at(-1)
  if (!cur) return null
  const { cycleLength, periodLength } = lengths(before, usualCycle, usualPeriod)
  const day = diff(cur.start, k) + 1
  // Trust the days she logged. If she logged only the first day, or is still logging, expect her usual length.
  const lastLogged = addDays(cur.start, cur.days - 1)
  const bleed = cur.days >= periodLength || (cur.days > 1 && diff(lastLogged, k) > 1) ? cur.days : periodLength
  const ov = cycleLength - 14
  const phase: Phase = day <= bleed ? 'Menstrual' : day < ov - 1 ? 'Follicular' : day <= ov + 1 ? 'Ovulatory' : 'Luteal'
  const nextStart = addDays(cur.start, cycleLength)
  return { day, phase, start: cur.start, cycleLength, periodLength, nextStart, late: Math.max(0, diff(nextStart, k)) }
}

/** The Moon on the day a period began. Bleeding near the New Moon is called a White Moon cycle, near the Full Moon a Red Moon cycle. */
export function moonOfStart(start: string) {
  const m = moonAt(new Date(start + 'T12:00'))
  const near = (t: number) => Math.abs(((m.angle - t + 540) % 360) - 180) <= 45
  return { ...m, kind: near(0) ? 'White Moon' : near(180) ? 'Red Moon' : null }
}
