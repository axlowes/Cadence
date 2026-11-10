import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, type CycleDay, type Flow } from '../lib/db'
import { cycleOn, moonOfStart, periods, PHASE } from '../lib/cycle'
import { addDays, dateKey, WEEKDAYS } from '../lib/dates'
import { useWeekStart } from '../lib/useWeekStart'
import { Sheet } from './Sheet'

const FLOWS: { id: Flow | null; label: string }[] = [
  { id: null, label: 'None' },
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
]
const NEXT: Record<string, Flow | null> = { none: 'light', light: 'medium', medium: 'heavy', heavy: 'spotting', spotting: null }

export async function setFlow(date: string, flow: Flow | null) {
  if (flow) await db.cycle.put({ date, flow })
  else await db.cycle.delete(date)
}

export function useCycle() {
  const days = useLiveQuery(() => db.cycle.toArray(), [])
  const usual = useLiveQuery(() => db.settings.get('cycleUsual').then((r) => (r?.value as { cycle: number; period: number }) ?? { cycle: 28, period: 5 }), [])
  const ps = periods(days ?? [])
  const u = usual ?? { cycle: 28, period: 5 }
  return { loaded: days !== undefined, days: days ?? [], ps, usual: u, on: (k: string) => cycleOn(ps, k, u.cycle, u.period) }
}

const pretty = (k: string) => new Date(k + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function cycleHint(c: ReturnType<typeof useCycle>, today: string) {
  const info = c.on(today)
  if (!info) return 'Tap to log your period'
  if (info.late) return `Day ${info.day}, your period may be ${info.late} ${info.late === 1 ? 'day' : 'days'} late`
  return `Day ${info.day}, ${info.phase.toLowerCase()}, ${PHASE[info.phase].season}`
}

/** The body of the cycle card on Today. */
export function CycleToday({ today }: { today: string }) {
  const c = useCycle()
  const [calendar, setCalendar] = useState(false)
  const info = c.on(today)
  const flow = c.days.find((d) => d.date === today)?.flow ?? null
  const startMoon = info ? moonOfStart(info.start) : null
  return (
    <>
      {info ? (
        <>
          <p>{PHASE[info.phase].line}</p>
          <p className="small muted">
            Day {info.day} of about {info.cycleLength}. This cycle began {pretty(info.start)} under a {startMoon!.phaseName.toLowerCase()} in {startMoon!.sign}
            {startMoon!.kind ? `, a ${startMoon!.kind} cycle` : ''}.{' '}
            {info.late ? `Your period was expected around ${pretty(info.nextStart)}.` : `Your next period is expected around ${pretty(info.nextStart)}.`}
          </p>
        </>
      ) : (
        <p>Tell me when your period comes and I'll follow your cycle beside the Moon, so your feelings, your body and the sky can be read together.</p>
      )}
      <span className="lbl">Bleeding today</span>
      <div className="segmented five" role="radiogroup" aria-label="Bleeding today">
        {FLOWS.map((f) => (
          <button key={f.label} role="radio" aria-checked={flow === f.id} className={flow === f.id ? 'on' : ''} onClick={() => setFlow(today, f.id)}>{f.label}</button>
        ))}
      </div>
      <button className="pill" onClick={() => setCalendar(true)}>Log other days</button>
      {calendar && <CycleCalendar today={today} onClose={() => setCalendar(false)} />}
    </>
  )
}

function CycleCalendar({ today, onClose }: { today: string; onClose: () => void }) {
  const c = useCycle()
  const weekStart = useWeekStart()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [y, m] = month.split('-').map(Number)
  const first = dateKey(new Date(y, m - 1, 1, 12))
  const daysIn = new Date(y, m, 0).getDate()
  const lead = (new Date(y, m - 1, 1).getDay() - weekStart + 7) % 7
  const byDate = new Map(c.days.map((d: CycleDay) => [d.date, d.flow]))
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const info = c.on(today)
  const expected = new Set<string>()
  if (info) for (let i = 0; i < info.periodLength; i++) expected.add(addDays(info.nextStart, i))

  return (
    <Sheet title="Your cycle" onClose={onClose}>
      <div className="stack">
        <p className="small muted">Tap a day to log bleeding. Each tap steps through light, medium, heavy and spotting, then clears it.</p>
        <div className="row-between month-nav">
          <button className="pill" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
          <span className="serif month-name">{new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <button className="pill" aria-label="Next month" onClick={() => shift(1)}>›</button>
        </div>
        <div className="dots-grid cycle-grid">
          {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className="dow" aria-hidden="true">{WEEKDAYS[(i + weekStart) % 7][0]}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const k = addDays(first, i)
            const f = byDate.get(k)
            const future = k > today
            return (
              <button key={k} disabled={future} className={['day-dot', 'cyc', f ?? '', !f && expected.has(k) ? 'expected' : '', k === today ? 'today' : ''].join(' ')}
                aria-label={`${k}${f ? `, ${f}` : ''}`} onClick={() => setFlow(k, NEXT[f ?? 'none'])}>
                <span>{i + 1}</span>
              </button>
            )
          })}
        </div>
        <div className="row cycle-legend small">
          <span><i className="cyc-key light" /> light</span><span><i className="cyc-key medium" /> medium</span>
          <span><i className="cyc-key heavy" /> heavy</span><span><i className="cyc-key spotting" /> spotting</span>
          {info && <span><i className="cyc-key expected" /> expected</span>}
        </div>
        <UsualLengths usual={c.usual} />
      </div>
    </Sheet>
  )
}

function UsualLengths({ usual }: { usual: { cycle: number; period: number } }) {
  return (
    <div className="stack tight">
      <p className="small muted">Until you have logged two periods, I use your usual lengths. After that I learn from what you log.</p>
      <div className="row">
        <label className="lbl" htmlFor="usual-cycle">Usual cycle (days)</label>
        <input id="usual-cycle" className="field num" inputMode="numeric" defaultValue={usual.cycle}
          onBlur={(e) => setSetting('cycleUsual', { ...usual, cycle: Math.min(45, Math.max(18, Number(e.target.value) || 28)) })} />
      </div>
      <div className="row">
        <label className="lbl" htmlFor="usual-period">Usual period (days)</label>
        <input id="usual-period" className="field num" inputMode="numeric" defaultValue={usual.period}
          onBlur={(e) => setSetting('cycleUsual', { ...usual, period: Math.min(10, Math.max(1, Number(e.target.value) || 5)) })} />
      </div>
    </div>
  )
}
