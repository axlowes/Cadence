import { db, getSetting, setSetting, type Habit, type HabitGroup, type HabitIcon, type HabitType } from './db'
import { blankHabit } from './habits'
import { dateKey } from './dates'

export interface SeedItem {
  key: string
  name: string
  days: number[]
  group: HabitGroup
  icon: HabitIcon
  color: string
  type?: HabitType
  target?: number
  unit?: string
  step?: number
  folder?: string
  note?: string
  steps?: string[]
  trackWeight?: boolean
  workout?: boolean
}

// Personal starter lists live in src/seed/*.local.json, which git ignores, so they never reach the public code.
const files = import.meta.glob<{ default: SeedItem[] }>('../seed/*.local.json', { eager: true })
const items: SeedItem[] = Object.values(files).flatMap((m) => m.default)

const fields = (it: SeedItem): Partial<Habit> => ({
  folder: it.folder ?? null,
  note: it.note ?? '',
  steps: it.steps ?? [],
  trackWeight: !!it.trackWeight,
  workout: !!it.workout,
})

/**
 * Adds each starter item once. An item already added is never touched again, so edits she makes stick.
 * For a habit added by an older version of the list, only the new fields (folder, notes, steps) are filled in.
 */
export const applySeedOnce = () => applySeed(items)

/** A starter file she brings in by hand: her lists, and her chart picture. Adds, never replaces. */
export async function applyStarter(file: File) {
  const data = JSON.parse(await file.text()) as { app?: string; items?: SeedItem[]; chartImage?: string }
  if (data.app !== 'cadence-starter' || !Array.isArray(data.items)) return null
  const before = await db.habits.count()
  await applySeed(data.items)
  if (data.chartImage && !(await getSetting('chartImage'))) await setSetting('chartImage', data.chartImage)
  return (await db.habits.count()) - before
}

async function applySeed(items: SeedItem[]) {
  if (!items.length) return
  const done = new Set((await getSetting<string[]>('seededKeys')) ?? [])
  const legacy = !!(await getSetting('seedApplied')) && done.size === 0
  const existing = await db.habits.toArray()
  const start = dateKey(new Date())
  let order = Math.max(0, ...existing.map((h) => h.order)) + 1
  const puts: Habit[] = []
  for (const it of items) {
    if (done.has(it.key)) continue
    done.add(it.key)
    const match = legacy && it.key.startsWith('binder-') ? existing.find((h) => h.name === it.name) : undefined
    if (match) {
      puts.push({ ...match, ...fields(it), folder: match.folder ?? it.folder ?? null, note: match.note || it.note || '' })
      continue
    }
    if (legacy && it.key.startsWith('binder-')) continue // she deleted it, leave it gone
    const type = it.type ?? 'check'
    puts.push({
      ...blankHabit(order++),
      name: it.name,
      icon: it.icon,
      color: it.color,
      group: it.group,
      type,
      target: type === 'check' ? 1 : (it.target ?? 1),
      unit: it.unit ?? '',
      step: it.step ?? 1,
      schedule: { kind: it.days.length === 7 ? 'daily' : 'weekdays', days: it.days, moon: ['waxing'] },
      createdAt: start,
      ...fields(it),
    })
  }
  if (puts.length) await db.habits.bulkPut(puts)
  await setSetting('seededKeys', [...done])
}
