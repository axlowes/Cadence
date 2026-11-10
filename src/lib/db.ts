import Dexie, { type EntityTable } from 'dexie'

export interface Setting {
  key: string
  value: unknown
}

export type HabitType = 'check' | 'count' | 'weekly'
export type HabitGroup = 'allday' | 'morning' | 'afternoon' | 'evening'
export type HabitIcon = 'candle' | 'crystal' | 'leaf' | 'cup' | 'flame' | 'book'
export type MoonWhen = 'newmoon' | 'waxing' | 'fullmoon' | 'waning'

export interface HabitSchedule {
  kind: 'daily' | 'weekdays' | 'moon'
  days: number[] // 0 = Sunday, used when kind = weekdays
  moon: MoonWhen[] // used when kind = moon
}

export interface Habit {
  id: string
  name: string
  icon: HabitIcon
  color: string
  type: HabitType
  target: number // per day for count, per week for weekly, 1 for check
  schedule: HabitSchedule
  group: HabitGroup
  order: number
  archived: boolean
  paused: { start: string; end: string | null }[] // date keys, end exclusive
  createdAt: string // date key
  folder?: string | null // habits sharing a folder fold into one drop-down on Today
  note?: string // reference notes, like a meal plan
  steps?: string[] // a checklist inside the habit, like exercises
  trackWeight?: boolean // log a weight for each step
  unit?: string // for counts: glasses, g, servings
  step?: number // how much one tap adds, for counts
  workout?: boolean // shows on the Workouts tab
}

export interface Lift {
  id: string // `${habitId}:${date}:${stepIndex}`
  habitId: string
  date: string
  step: string // the exercise name, so history survives reordering
  weight: number | null
  sets?: number | null
  reps?: number | null
  unit: 'lb' | 'kg'
}

export type Feeling = 'calm' | 'happy' | 'excited' | 'proud' | 'energized' | 'tired' | 'low' | 'irritable' | 'confused' | 'numb'

export interface FeelingEntry {
  id: string
  at: number // ms
  date: string // YYYY-MM-DD
  feeling: Feeling
  note: string
  moonSign: string
  phaseName: string
  illumination: number
  voc: boolean
}

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy'

export interface CycleDay {
  date: string // YYYY-MM-DD
  flow: Flow
}

export interface CalEvent {
  id: string // uid, or uid + recurrence id for a moved occurrence
  title: string
  location: string
  allDay: boolean
  start: number // ms; for all-day, local midnight of the first day
  end: number
  rrule: string | null
  exdates: number[]
  source: string // the imported file name, or Cadence for events made here
  note?: string
  sent?: boolean // opened in Google Calendar to be saved there too
}

export interface HabitLog {
  id: string // `${habitId}:${date}`
  habitId: string
  date: string // YYYY-MM-DD
  value: number
}

export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'newmoon' | 'fullmoon'
export type TaskTag = 'begin' | 'release' | 'clear' | null

export interface Task {
  id: string
  title: string
  due: string | null // YYYY-MM-DD
  time: string | null // HH:MM
  note: string
  priority: 'none' | 'low' | 'high'
  repeat: TaskRepeat
  tag: TaskTag
  done: boolean
  doneAt: number | null
  createdAt: number
}

class CadenceDB extends Dexie {
  settings!: EntityTable<Setting, 'key'>
  habits!: EntityTable<Habit, 'id'>
  logs!: EntityTable<HabitLog, 'id'>
  tasks!: EntityTable<Task, 'id'>
  lifts!: EntityTable<Lift, 'id'>
  feelings!: EntityTable<FeelingEntry, 'id'>
  events!: EntityTable<CalEvent, 'id'>
  cycle!: EntityTable<CycleDay, 'date'>
  constructor() {
    super('cadence')
    this.version(1).stores({ settings: 'key' })
    this.version(2).stores({
      settings: 'key',
      habits: 'id, order, archived',
      logs: 'id, habitId, date',
      tasks: 'id, due, done, doneAt',
    })
    this.version(3).stores({
      settings: 'key',
      habits: 'id, order, archived',
      logs: 'id, habitId, date',
      tasks: 'id, due, done, doneAt',
      lifts: 'id, habitId, date, step',
    })
    this.version(4)
      .stores({
        settings: 'key',
        habits: 'id, order, archived',
        logs: 'id, habitId, date',
        tasks: 'id, due, done, doneAt',
        lifts: 'id, habitId, date, step',
        feelings: 'id, date, at',
        events: 'id, start',
      })
      .upgrade(async (tx) => {
        // Habits are one list now. Keep the order she saw: all day, morning, afternoon, evening.
        const rank: Record<string, number> = { allday: 0, morning: 1, afternoon: 2, evening: 3 }
        const all = (await tx.table('habits').toArray()) as Habit[]
        all.sort((a, b) => (rank[a.group] ?? 1) - (rank[b.group] ?? 1) || a.order - b.order)
        const isWorkout = (h: Habit) => (h.steps ?? []).length > 0 || /yoga|workout|swat|pilates|run\b/i.test(h.name)
        await tx.table('habits').bulkPut(all.map((h, i) => ({ ...h, order: i + 1, workout: h.workout ?? isWorkout(h) })))
      })
    this.version(5).stores({
      settings: 'key',
      habits: 'id, order, archived',
      logs: 'id, habitId, date',
      tasks: 'id, due, done, doneAt',
      lifts: 'id, habitId, date, step',
      feelings: 'id, date, at',
      events: 'id, start',
      cycle: 'date',
    })
  }
}

export const db = new CadenceDB()

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* not supported */
  }
}

export const newId = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
