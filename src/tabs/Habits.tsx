import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit } from '../lib/db'
import { HabitGlyph } from '../components/Icons'
import { HabitEditor } from '../components/HabitEditor'
import { blankHabit, isPaused, logMap, MILESTONES, scheduledOn, setLog, streaks, targetOf } from '../lib/habits'
import { addDays, dateKey, WEEKDAYS, weekStartOf } from '../lib/dates'
import { useWeekStart } from '../lib/useWeekStart'
import { MOON_WHEN_LABEL } from '../lib/moonDays'

export function scheduleText(h: Habit) {
  if (h.type === 'weekly') return `${h.target} times a week`
  const per = h.type === 'count' ? `${h.target}${h.unit ? ` ${h.unit}` : ''} a day, ` : ''
  if (h.schedule.kind === 'daily') return `${per}every day`
  if (h.schedule.kind === 'weekdays') {
    const d = [...h.schedule.days].sort()
    if (d.join() === '1,2,3,4,5') return `${per}weekdays`
    if (d.join() === '0,6') return `${per}weekends`
    return per + d.map((i) => WEEKDAYS[i]).join(', ')
  }
  return per + h.schedule.moon.map((m) => MOON_WHEN_LABEL[m].toLowerCase()).join(', ')
}

export function HabitsTab({ today }: { today: string }) {
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? []
  const weekStart = useWeekStart()
  const [editing, setEditing] = useState<{ habit: Habit; isNew: boolean } | null>(null)
  const [arranging, setArranging] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [month, setMonth] = useState(() => today.slice(0, 7))

  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  async function move(h: Habit, dir: -1 | 1) {
    const list = active
    const i = list.findIndex((x) => x.id === h.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const other = list[j]
    await db.habits.bulkPut([{ ...h, order: other.order }, { ...other, order: h.order }])
  }

  const shiftMonth = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthName = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  })()

  return (
    <div className="screen">
      <header className="glass card">
        <div className="row-between">
          <h1 className="serif">Habits</h1>
          <div className="row">
            {active.length > 1 && (
              <button className="pill" onClick={() => setArranging(!arranging)}>{arranging ? 'Done' : 'Arrange'}</button>
            )}
            <button className="pill solid" onClick={() => setEditing({ habit: blankHabit((habits.at(-1)?.order ?? 0) + 1), isNew: true })}>New</button>
          </div>
        </div>
        <div className="row-between month-nav">
          <button className="pill" aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
          <span className="serif month-name">{monthName}</span>
          <button className="pill" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => shiftMonth(1)}>›</button>
        </div>
      </header>

      {active.length === 0 && (
        <section className="glass card">
          <p>Your rituals will live here, the small daily ones that keep your candle lit. Tap New to add your first.</p>
        </section>
      )}

      {active.length > 0 && (
        <section className="stack">
          {active.map((h, i) => (
            <HabitCard key={h.id} h={h} logs={logMap(logs, h.id)} today={today} month={month} weekStart={weekStart}
              arranging={arranging} first={i === 0} last={i === active.length - 1}
              onMove={(d) => move(h, d)} onEdit={() => setEditing({ habit: h, isNew: false })} />
          ))}
        </section>
      )}

      {archived.length > 0 && (
        <section className="glass card">
          <button className="link" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="plain">
              {archived.map((h) => (
                <li key={h.id} className="row-between">
                  <span>{h.name}</span>
                  <button className="pill" onClick={() => setEditing({ habit: h, isNew: false })}>Open</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing && <HabitEditor habit={editing.habit} isNew={editing.isNew} today={today} folders={[...new Set(habits.map((h) => h.folder).filter((f): f is string => !!f))]} onClose={() => setEditing(null)} />}
    </div>
  )
}

function HabitCard(props: {
  h: Habit; logs: Map<string, number>; today: string; month: string; weekStart: 0 | 1
  arranging: boolean; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onEdit: () => void
}) {
  const { h, logs, today, month, weekStart, arranging, first, last, onMove, onEdit } = props
  const s = streaks(h, logs, today, weekStart)
  const shimmer = MILESTONES.includes(s.current)
  const target = targetOf(h)

  const [y, m] = month.split('-').map(Number)
  const firstKey = dateKey(new Date(y, m - 1, 1, 12))
  const daysIn = new Date(y, m, 0).getDate()
  const lead = (new Date(y, m - 1, 1).getDay() - weekStart + 7) % 7
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStart) % 7][0])

  async function tapDay(k: string) {
    const v = logs.get(k) ?? 0
    const next = h.type === 'count' ? (v >= target ? 0 : v + 1) : v > 0 ? 0 : 1
    await setLog(h.id, k, next)
  }

  return (
    <article className={`glass card habit-card${shimmer ? ' shimmer' : ''}`} style={{ ['--habit' as string]: h.color }}>
      <div className="row-between">
        <div className="habit-title">
          <span className="habit-icon"><HabitGlyph icon={h.icon} /></span>
          <div>
            <h3>{h.name}</h3>
            <p className="small muted">{scheduleText(h)}{h.folder ? `, in ${h.folder}` : ''}{isPaused(h, today) ? ', paused' : ''}</p>
          </div>
        </div>
        {arranging ? (
          <div className="row">
            <button className="pill" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}>↑</button>
            <button className="pill" aria-label="Move down" disabled={last} onClick={() => onMove(1)}>↓</button>
          </div>
        ) : (
          <button className="pill" onClick={onEdit}>Edit</button>
        )}
      </div>
      <p className="streak">
        <strong>{s.current}</strong> {s.unit}{s.current === 1 ? '' : 's'} in a row
        <span className="muted"> · best {s.best}</span>
        {'thisWeek' in s && <span className="muted"> · {s.thisWeek} of {target} this week</span>}
      </p>
      <div className="dots-grid" role="grid" aria-label={`${h.name}, month view`}>
        {heads.map((d, i) => <span key={`h${i}`} className="dow" aria-hidden="true">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const k = addDays(firstKey, i)
          const v = logs.get(k) ?? 0
          const future = k > today
          const sched = h.type === 'weekly' ? !isPaused(h, k) && k >= h.createdAt : scheduledOn(h, k)
          const full = v >= (h.type === 'weekly' ? 1 : target)
          const cls = ['day-dot', full ? 'full' : v > 0 ? 'part' : '', sched ? 'sched' : 'off', k === today ? 'today' : ''].join(' ')
          return (
            <button key={k} className={cls} disabled={future} onClick={() => tapDay(k)}
              aria-label={`${k}${full ? ', done' : v > 0 ? `, ${v} of ${target}` : ''}`}
              style={v > 0 && !full ? { ['--p' as string]: `${(v / target) * 100}%` } : undefined}>
              <span>{i + 1}</span>
            </button>
          )
        })}
      </div>
      {h.type === 'weekly' && <p className="small muted">Week starts {weekStartOf(today, weekStart) === today ? 'today' : WEEKDAYS[weekStart]}.</p>}
    </article>
  )
}
