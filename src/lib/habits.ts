import { db, newId, type Habit, type HabitLog } from './db'
import { addDays, dateKey, weekday, weekStartOf } from './dates'
import { matchesMoon } from './moonDays'

export const HABIT_COLORS = ['#E8A87C', '#D98BA6', '#C9B6E4', '#8FB8DE', '#9CC9A5', '#E9C46A']

export function isPaused(h: Habit, k: string) {
  return h.paused.some((p) => k >= p.start && (p.end === null || k < p.end))
}

/** Is this habit asked of her on this day? (Weekly goals can be done any day.) */
export function scheduledOn(h: Habit, k: string) {
  if (h.archived || k < h.createdAt || isPaused(h, k)) return false
  if (h.type === 'weekly') return true
  if (h.schedule.kind === 'daily') return true
  if (h.schedule.kind === 'weekdays') return h.schedule.days.includes(weekday(k))
  return matchesMoon(k, h.schedule.moon)
}

export const targetOf = (h: Habit) => (h.type === 'check' ? 1 : Math.max(1, h.target))
export const stepOf = (h: Habit) => Math.max(1, h.step ?? 1)

export type LogMap = Map<string, number> // date -> value

export function logMap(logs: HabitLog[], habitId: string): LogMap {
  const m = new Map<string, number>()
  for (const l of logs) if (l.habitId === habitId && l.value > 0) m.set(l.date, l.value)
  return m
}

const LOOKBACK = 800 // days

export function streaks(h: Habit, logs: LogMap, today: string, weekStart: 0 | 1) {
  if (h.type === 'weekly') return weeklyStreaks(h, logs, today, weekStart)
  const met = (k: string) => (logs.get(k) ?? 0) >= targetOf(h)
  // current: walk back from today; an unfinished today doesn't break it
  let current = 0
  for (let i = 0; i < LOOKBACK; i++) {
    const k = addDays(today, -i)
    if (k < h.createdAt) break
    if (!scheduledOn(h, k)) continue
    if (met(k)) current++
    else if (i === 0) continue
    else break
  }
  let best = 0
  let run = 0
  const first = h.createdAt > addDays(today, -LOOKBACK) ? h.createdAt : addDays(today, -LOOKBACK)
  for (let k = first; k <= today; k = addDays(k, 1)) {
    if (!scheduledOn(h, k)) continue
    if (met(k)) {
      run++
      best = Math.max(best, run)
    } else if (k !== today) run = 0
  }
  return { current, best, unit: 'day' as const }
}

function weekCount(logs: LogMap, start: string) {
  let n = 0
  for (let i = 0; i < 7; i++) if ((logs.get(addDays(start, i)) ?? 0) > 0) n++
  return n
}

function weekPaused(h: Habit, start: string) {
  for (let i = 0; i < 7; i++) if (!isPaused(h, addDays(start, i))) return false
  return true
}

function weeklyStreaks(h: Habit, logs: LogMap, today: string, weekStart: 0 | 1) {
  const thisWeek = weekStartOf(today, weekStart)
  const firstWeek = weekStartOf(h.createdAt, weekStart)
  const met = (s: string) => weekCount(logs, s) >= targetOf(h)
  let current = 0
  for (let s = thisWeek, i = 0; s >= firstWeek && i < 120; s = addDays(s, -7), i++) {
    if (weekPaused(h, s)) continue
    if (met(s)) current++
    else if (s === thisWeek) continue
    else break
  }
  let best = 0
  let run = 0
  for (let s = firstWeek; s <= thisWeek; s = addDays(s, 7)) {
    if (weekPaused(h, s)) continue
    if (met(s)) {
      run++
      best = Math.max(best, run)
    } else if (s !== thisWeek) run = 0
  }
  return { current, best, unit: 'week' as const, thisWeek: weekCount(logs, thisWeek) }
}

export const MILESTONES = [7, 30, 108]

export async function setLog(habitId: string, date: string, value: number) {
  const id = `${habitId}:${date}`
  if (value <= 0) await db.logs.delete(id)
  else await db.logs.put({ id, habitId, date, value })
}

export function blankHabit(order: number): Habit {
  return {
    id: newId(),
    name: '',
    icon: 'candle',
    color: HABIT_COLORS[0],
    type: 'check',
    target: 1,
    schedule: { kind: 'daily', days: [1, 2, 3, 4, 5], moon: ['waxing'] },
    group: 'morning',
    order,
    archived: false,
    paused: [],
    createdAt: dateKey(new Date()),
    folder: null,
    note: '',
    steps: [],
    trackWeight: false,
    workout: false,
    unit: '',
    step: 1,
  }
}

export function pauseNow(h: Habit, today: string): Habit {
  if (isPaused(h, today)) return h
  return { ...h, paused: [...h.paused, { start: today, end: null }] }
}

export function resumeNow(h: Habit, today: string): Habit {
  return { ...h, paused: h.paused.map((p) => (p.end === null ? { ...p, end: today } : p)) }
}
