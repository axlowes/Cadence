import { describe, expect, it } from 'vitest'
import { cycleOn, periods } from '../src/lib/cycle'
import type { CycleDay } from '../src/lib/db'

const log = (start: string, n: number): CycleDay[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(start + 'T12:00'); d.setDate(d.getDate() + i)
    return { date: d.toISOString().slice(0, 10), flow: 'medium' }
  })

describe('cycle', () => {
  const days = [...log('2026-09-05', 5), ...log('2026-10-03', 4), { date: '2026-10-20', flow: 'spotting' as const }, ...log('2026-10-31', 1)]
  const ps = periods(days)
  it('groups periods and ignores spotting', () => {
    expect(ps).toEqual([{ start: '2026-09-05', days: 5 }, { start: '2026-10-03', days: 4 }, { start: '2026-10-31', days: 1 }])
  })
  it('finds the day and phase', () => {
    const a = cycleOn(ps, '2026-11-02')!
    expect(a.day).toBe(3)
    expect(a.phase).toBe('Menstrual') // only the first day is logged, so her usual length is expected
    expect(a.cycleLength).toBe(28)
    expect(a.nextStart).toBe('2026-11-28')
    expect(cycleOn(ps, '2026-11-10')!.phase).toBe('Follicular')
    expect(cycleOn(ps, '2026-11-13')!.phase).toBe('Ovulatory')
    expect(cycleOn(ps, '2026-11-20')!.phase).toBe('Luteal')
    expect(cycleOn(ps, '2026-10-08')!.phase).toBe('Follicular')
    expect(cycleOn(ps, '2026-11-30')!.late).toBe(2)
    expect(cycleOn(ps, '2026-09-01')).toBeNull()
  })
})
