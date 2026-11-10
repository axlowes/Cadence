import { db, newId, type Task } from './db'
import { addDays, addMonths, dateKey } from './dates'
import { nextMoonDay } from './moonDays'

export function blankTask(title: string, due: string | null): Task {
  return {
    id: newId(),
    title,
    due,
    time: null,
    note: '',
    priority: 'none',
    repeat: 'none',
    tag: guessTag(title),
    done: false,
    doneAt: null,
    createdAt: Date.now(),
  }
}

/** Words that hint whether a task is a beginning or a letting go. */
export function guessTag(title: string): Task['tag'] {
  const t = title.toLowerCase()
  if (/\b(start|begin|launch|plant|sign up|apply|new|plan)\b/.test(t)) return 'begin'
  if (/\b(clean|clear|declutter|tidy|purge|donate|organi[sz]e|wash|scrub)\b/.test(t)) return 'clear'
  if (/\b(cancel|quit|release|let go|return|end|finish|delete)\b/.test(t)) return 'release'
  return null
}

function nextDue(t: Task): string | null {
  const base = t.due ?? dateKey(new Date())
  switch (t.repeat) {
    case 'daily': return addDays(base, 1)
    case 'weekly': return addDays(base, 7)
    case 'monthly': return addMonths(base, 1)
    case 'newmoon': return nextMoonDay(base, 'newmoon')
    case 'fullmoon': return nextMoonDay(base, 'fullmoon')
    default: return null
  }
}

export async function completeTask(t: Task) {
  await db.tasks.put({ ...t, done: true, doneAt: Date.now() })
  const due = nextDue(t)
  if (due) await db.tasks.put({ ...t, id: newId(), done: false, doneAt: null, due, createdAt: Date.now() })
}

export async function undoTask(t: Task) {
  await db.tasks.put({ ...t, done: false, doneAt: null })
}

export async function moveToTomorrow(t: Task, today: string) {
  await db.tasks.put({ ...t, due: addDays(today, 1) })
}

export const REPEAT_LABEL: Record<Task['repeat'], string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  newmoon: 'Every New Moon',
  fullmoon: 'Every Full Moon',
}
