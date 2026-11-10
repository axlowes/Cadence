import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type Lift } from '../lib/db'
import { HabitGlyph } from './Icons'
import { logMap, scheduledOn, setLog, stepOf, streaks, targetOf, MILESTONES } from '../lib/habits'
import { useWeekStart } from '../lib/useWeekStart'

const readOpen = (key: string) => {
  try {
    return localStorage.getItem(`folder-open:${key}`) === '1'
  } catch {
    return false
  }
}
const writeOpen = (key: string, open: boolean) => {
  try {
    localStorage.setItem(`folder-open:${key}`, open ? '1' : '0')
  } catch {
    /* private window */
  }
}

export function useHabitsHint(today: string) {
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.where('date').equals(today).toArray(), [today]) ?? []
  const todays = habits.filter((h) => scheduledOn(h, today))
  if (!todays.length) return 'A day of rest'
  const done = todays.filter((h) => (logs.find((l) => l.habitId === h.id)?.value ?? 0) >= targetOf(h)).length
  return `${done} of ${todays.length} done`
}

export function TodayHabits({ today, onOpenHabits }: { today: string; onOpenHabits: () => void }) {
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? []
  const lifts = useLiveQuery(() => db.lifts.toArray(), []) ?? []
  const weekStart = useWeekStart()
  const todays = habits.filter((h) => scheduledOn(h, today))
  if (habits.length === 0)
    return (
      <p className="muted">
        No habits yet. <button className="link inline" onClick={onOpenHabits}>Add your first in Habits.</button>
      </p>
    )
  if (todays.length === 0) return <p className="muted">Nothing is asked of you today. Rest is a ritual too.</p>

  const loose = todays.filter((h) => !h.folder)
  const folders = [...new Set(todays.map((h) => h.folder).filter((f): f is string => !!f))]
  const tick = (h: Habit) => (
    <HabitTick key={h.id} h={h} logs={logMap(logs, h.id)} lifts={lifts} today={today} weekStart={weekStart} />
  )
  const byGroup = (list: Habit[]) => <div className="stack tight">{list.map(tick)}</div>

  return (
    <div className="stack">
      {byGroup(loose)}
      {folders.map((f) => {
        const list = todays.filter((h) => h.folder === f)
        const done = list.filter((h) => (logs.find((l) => l.id === `${h.id}:${today}`)?.value ?? 0) >= targetOf(h)).length
        return (
          <details key={f} className="folder" open={readOpen(f)} onToggle={(e) => writeOpen(f, (e.target as HTMLDetailsElement).open)}>
            <summary>
              <span className="serif folder-name">{f}</span>
              <span className="small muted">{done} of {list.length} done</span>
              <span className="chev" aria-hidden="true">⌄</span>
            </summary>
            <div className="stack folder-body">{byGroup(list)}</div>
          </details>
        )
      })}
    </div>
  )
}

function HabitTick({ h, logs, lifts, today, weekStart }: { h: Habit; logs: Map<string, number>; lifts: Lift[]; today: string; weekStart: 0 | 1 }) {
  const [panel, setPanel] = useState<'steps' | 'note' | null>(null)
  const v = logs.get(today) ?? 0
  const target = targetOf(h)
  const done = h.type === 'count' ? v >= target : v > 0
  const s = streaks(h, logs, today, weekStart)
  const shimmer = done && MILESTONES.includes(s.current)
  const steps = (h.steps ?? []).filter(Boolean)
  const unit = h.unit ? ` ${h.unit}` : ''

  const sub =
    h.type === 'count'
      ? `${v} of ${target}${unit}`
      : h.type === 'weekly' && 'thisWeek' in s
        ? `${s.thisWeek} of ${target} this week`
        : ''
  const streakText = s.current > 1 ? `${s.current} ${s.unit}s in a row` : ''

  return (
    <div className={`tick-block${shimmer ? ' shimmer' : ''}`} style={{ ['--habit' as string]: h.color }}>
      <div className={`tick-row${done ? ' done' : ''}`}>
        <button className="tick" aria-pressed={done} aria-label={`${h.name}${done ? ', done' : ''}`}
          onClick={() => setLog(h.id, today, h.type === 'count' ? (v >= target ? 0 : Math.min(target, v + stepOf(h))) : done ? 0 : 1)}>
          <span className="tick-flame" aria-hidden="true"><HabitGlyph icon={h.icon} size={22} /></span>
          <span className="tick-text">
            <span className="tick-name">{h.name}</span>
            {(sub || streakText) && <span className="small muted">{[sub, streakText].filter(Boolean).join(' · ')}</span>}
          </span>
        </button>
        {steps.length > 0 && (
          <button className={`mini-pill${panel === 'steps' ? ' on' : ''}`} aria-expanded={panel === 'steps'} onClick={() => setPanel(panel === 'steps' ? null : 'steps')}>
            {h.trackWeight ? 'Lifts' : 'Steps'}
          </button>
        )}
        {h.note && (
          <button className={`mini-pill${panel === 'note' ? ' on' : ''}`} aria-expanded={panel === 'note'} onClick={() => setPanel(panel === 'note' ? null : 'note')}>
            Notes
          </button>
        )}
      </div>
      {h.type === 'count' && <Tracker h={h} v={v} target={target} today={today} />}
      {panel === 'steps' && <StepsPanel h={h} steps={steps} lifts={lifts} today={today} />}
      {panel === 'note' && <div className="note-panel">{h.note}</div>}
    </div>
  )
}

function Tracker({ h, v, target, today }: { h: Habit; v: number; target: number; today: string }) {
  const step = stepOf(h)
  if (target <= 12 && step === 1) {
    return (
      <div className="pips" role="group" aria-label={`${h.name}, ${v} of ${target}`}>
        {Array.from({ length: target }, (_, i) => (
          <button key={i} className={i < v ? 'pip-btn on' : 'pip-btn'} aria-label={`${i + 1}`} onClick={() => setLog(h.id, today, v === i + 1 ? i : i + 1)} />
        ))}
        {v > target && <span className="small muted">+{v - target}</span>}
      </div>
    )
  }
  const pct = Math.min(100, (v / target) * 100)
  return (
    <div className="bar-tracker">
      <div className="bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div className="row">
        <button className="key-mini" aria-label={`Take away ${step}`} onClick={() => setLog(h.id, today, Math.max(0, v - step))}>−</button>
        <input className="field num bar-input" inputMode="numeric" aria-label={`${h.name} amount`} value={v}
          onChange={(e) => setLog(h.id, today, Math.max(0, Number(e.target.value) || 0))} />
        <button className="pill solid add-step" onClick={() => setLog(h.id, today, v + step)}>+{step}{h.unit ? ` ${h.unit}` : ''}</button>
      </div>
    </div>
  )
}

export const liftText = (l: Pick<Lift, 'sets' | 'reps' | 'weight' | 'unit'>) => {
  const sr = l.sets && l.reps ? `${l.sets} × ${l.reps}` : l.sets ? `${l.sets} sets` : l.reps ? `${l.reps} reps` : ''
  const w = l.weight != null ? `${l.weight} ${l.unit}` : ''
  return [sr, w].filter(Boolean).join(' at ')
}

export function StepsPanel({ h, steps, lifts, today }: { h: Habit; steps: string[]; lifts: Lift[]; today: string }) {
  const unit = useLiveQuery(() => db.settings.get('liftUnit').then((r) => (r?.value as 'lb' | 'kg') ?? 'lb'), []) ?? 'lb'
  const mine = lifts.filter((l) => l.habitId === h.id)
  return (
    <ul className="steps-panel">
      {steps.map((name, i) => {
        const id = `${h.id}:${today}:${i}`
        const todayLift = mine.find((l) => l.id === id)
        const last = mine
          .filter((l) => l.step === name && l.date < today)
          .sort((a, b) => b.date.localeCompare(a.date))[0]
        return (
          <li key={i}>
            <span className="step-name">{name}</span>
            {h.trackWeight && <LiftInputs key={id} id={id} h={h} name={name} today={today} unit={unit} cur={todayLift} last={last} />}
            {h.trackWeight && last && (
              <span className="small muted step-last">
                Last time {liftText(last)}, {new Date(last.date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function LiftInputs({ id, h, name, today, unit, cur, last }: { id: string; h: Habit; name: string; today: string; unit: 'lb' | 'kg'; cur?: Lift; last?: Lift }) {
  type K = 'sets' | 'reps' | 'weight'
  const fromCur = () => ({ sets: str(cur?.sets), reps: str(cur?.reps), weight: str(cur?.weight) })
  const [vals, setVals] = useState(fromCur)
  const box = useRef<HTMLSpanElement>(null)
  // Saved values arrive a moment after first paint. Take them in unless she is typing here.
  useEffect(() => {
    if (!box.current?.contains(document.activeElement)) setVals(fromCur())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.sets, cur?.reps, cur?.weight])
  async function save() {
    const sets = num(vals.sets), reps = num(vals.reps), weight = num(vals.weight)
    if (sets == null && reps == null && weight == null) await db.lifts.delete(id)
    else await db.lifts.put({ id, habitId: h.id, date: today, step: name, sets, reps, weight, unit })
  }
  const field = (k: K, label: string) => (
    <label className="lift-field">
      <input className="field num lift-input" inputMode="decimal" data-k={k} aria-label={`${name} ${label}`}
        placeholder={last?.[k] != null ? String(last[k]) : ''} value={vals[k]}
        onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} onBlur={save} />
      <span className="small">{label}</span>
    </label>
  )
  return (
    <span className="lift" ref={box}>
      {field('sets', 'sets')}
      {field('reps', 'reps')}
      {field('weight', unit)}
    </span>
  )
}

const str = (n: number | null | undefined) => (n == null ? '' : String(n))
const num = (v: string) => {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}
