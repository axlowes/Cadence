import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type Lift } from '../lib/db'
import { blankHabit, scheduledOn, setLog } from '../lib/habits'
import { addDays, WEEKDAYS, weekStartOf } from '../lib/dates'
import { useWeekStart } from '../lib/useWeekStart'
import { HabitGlyph } from '../components/Icons'
import { HabitEditor } from '../components/HabitEditor'
import { liftText, StepsPanel } from '../components/TodayHabits'

const short = (k: string) => new Date(k + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function WorkoutsTab({ today }: { today: string }) {
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? []
  const lifts = useLiveQuery(() => db.lifts.toArray(), []) ?? []
  const weekStart = useWeekStart()
  const [day, setDay] = useState(today)
  const [editing, setEditing] = useState<{ habit: Habit; isNew: boolean } | null>(null)

  const workouts = habits.filter((h) => h.workout && !h.archived)
  const start = weekStartOf(day, weekStart)
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  // The weekly plan, shown for any week, even ones before the workout was added.
  const on = (k: string) => workouts.filter((h) => scheduledOn({ ...h, createdAt: '0000-01-01' }, k))
  const isDone = (h: Habit, k: string) => (logs.find((l) => l.id === `${h.id}:${k}`)?.value ?? 0) > 0
  const dayName = new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const planned = on(day)

  // Every exercise you have logged a weight for, newest first.
  const history = new Map<string, Lift[]>()
  for (const l of [...lifts].sort((a, b) => b.date.localeCompare(a.date))) {
    const list = history.get(l.step) ?? []
    list.push(l)
    history.set(l.step, list)
  }

  return (
    <div className="screen">
      <header className="glass card stack">
        <div className="row-between">
          <h1 className="serif">Workouts</h1>
          <button className="pill solid" onClick={() => setEditing({ habit: { ...blankHabit((habits.at(-1)?.order ?? 0) + 1), workout: true, icon: 'flame' }, isNew: true })}>New</button>
        </div>
        <div className="row-between month-nav">
          <button className="pill" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}>‹</button>
          <span className="serif month-name">Week of {short(start)}</span>
          <button className="pill" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}>›</button>
        </div>
        <div className="week-strip" role="tablist" aria-label="Days of the week">
          {week.map((k) => {
            const list = on(k)
            const done = list.length > 0 && list.every((h) => isDone(h, k))
            return (
              <button key={k} role="tab" aria-selected={k === day} className={['wk-day', k === day ? 'on' : '', k === today ? 'today' : ''].join(' ')} onClick={() => setDay(k)}>
                <span className="small">{WEEKDAYS[new Date(k + 'T12:00').getDay()]}</span>
                <span className={done ? 'wk-dot done' : list.length ? 'wk-dot' : 'wk-dot rest'} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </header>

      <section className="glass card stack">
        <p className="lbl">{dayName}</p>
        {planned.length === 0 && <p>A rest day. Your muscles grow while you sleep and soften, so let them.</p>}
        {planned.map((h) => {
          const done = isDone(h, day)
          const steps = (h.steps ?? []).filter(Boolean)
          return (
            <div key={h.id} className="stack tight workout" style={{ ['--habit' as string]: h.color }}>
              <div className={`tick-row${done ? ' done' : ''}`}>
                <button className="tick" aria-pressed={done} disabled={day > today} onClick={() => setLog(h.id, day, done ? 0 : 1)}>
                  <span className="tick-flame" aria-hidden="true"><HabitGlyph icon={h.icon} size={22} /></span>
                  <span className="tick-text">
                    <span className="tick-name serif">{h.name}</span>
                    <span className="small muted">{done ? 'Done, well moved' : day > today ? 'Coming up' : 'Tap when you finish'}</span>
                  </span>
                </button>
                <button className="mini-pill" onClick={() => setEditing({ habit: h, isNew: false })}>Edit</button>
              </div>
              {steps.length > 0 && <StepsPanel key={day} h={h} steps={steps} lifts={lifts} today={day} />}
              {steps.length > 0 && !h.trackWeight && <p className="small muted">Turn on weight tracking in Edit to log what you lift.</p>}
            </div>
          )
        })}
      </section>

      <section className="glass card stack">
        <h2 className="serif">Your lifts over time</h2>
        {history.size === 0 && <p className="muted">Type a weight beside any exercise and it will be kept here, so you can watch yourself grow stronger week by week.</p>}
        {[...history.entries()].map(([name, list]) => {
          const weighed = list.filter((x) => x.weight != null)
          const best = weighed.reduce<Lift | undefined>((m, x) => (!m || x.weight! > m.weight! ? x : m), undefined)
          return (
            <div key={name} className="lift-history">
              <div className="row-between">
                <strong>{name}</strong>
                {best && <span className="small muted">best {best.weight} {best.unit}</span>}
              </div>
              <p className="small">
                {list.slice(0, 6).map((x) => `${short(x.date)}: ${liftText(x)}`).join(', ')}
              </p>
            </div>
          )
        })}
      </section>

      {editing && (
        <HabitEditor habit={editing.habit} isNew={editing.isNew} today={today}
          folders={[...new Set(habits.map((h) => h.folder).filter((f): f is string => !!f))]} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
