import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { eventsOn, type Occurrence } from '../lib/ics'
import { addDays, dateKey, fromKey, WEEKDAYS, weekStartOf } from '../lib/dates'
import { useWeekStart } from '../lib/useWeekStart'
import { fmtTime } from '../lib/useProfile'
import { moonAt } from '../lib/moon'
import { blankEvent, EventEditor } from '../components/EventEditor'
import type { CalEvent } from '../lib/db'

type View = 'day' | 'week' | 'month'
const COLORS = ['#8FB8DE', '#E59AA8', '#7FD1B9', '#F2C46D', '#C9A0F2', '#F29E6D']
const HOUR = 52 // px per hour in the day view

const span = (k: string) => {
  const d = fromKey(k)
  return [new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()] as const
}

/** A small moon mark on the days of New, Full and the quarters. */
function moonMark(k: string) {
  const n = moonAt(fromKey(k)).phaseName
  return n === 'New Moon' ? '●' : n === 'Full Moon' ? '○' : n === 'First Quarter' ? '◐' : n === 'Last Quarter' ? '◑' : ''
}
const moonLabel = (k: string) => {
  const n = moonAt(fromKey(k)).phaseName
  return ['New Moon', 'Full Moon', 'First Quarter', 'Last Quarter'].includes(n) ? n : ''
}

export function CalendarTab({ today, onOpenSettings }: { today: string; onOpenSettings: () => void }) {
  const events = useLiveQuery(() => db.events.toArray(), [])
  const weekStart = useWeekStart()
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('cal-view') as View) || 'day'
    } catch {
      return 'day'
    }
  })
  const [day, setDay] = useState(today)
  const [editing, setEditing] = useState<{ ev: CalEvent; isNew: boolean } | null>(null)
  const open = (o: Occurrence) => setEditing({ ev: o.ev, isNew: false })
  const sources = [...new Set((events ?? []).map((e) => e.source))]
  const color = (o: Occurrence) => o.ev.color ?? COLORS[sources.indexOf(o.ev.source) % COLORS.length]
  const pick = (v: View) => {
    setView(v)
    try {
      localStorage.setItem('cal-view', v)
    } catch {
      /* private window */
    }
  }
  const on = (k: string) => eventsOn(events ?? [], ...span(k))

  const step = (n: number) => {
    if (view === 'day') setDay(addDays(day, n))
    else if (view === 'week') setDay(addDays(day, 7 * n))
    else {
      const d = fromKey(day)
      setDay(dateKey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)))
    }
  }
  const d = fromKey(day)
  const title =
    view === 'day'
      ? d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : view === 'week'
        ? `Week of ${fromKey(weekStartOf(day, weekStart)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="screen">
      <header className="glass card stack">
        <div className="row-between">
          <h1 className="serif">Calendar</h1>
          <div className="row">
            {day !== today && <button className="pill" onClick={() => setDay(today)}>Today</button>}
            <button className="pill solid" onClick={() => setEditing({ ev: blankEvent(day), isNew: true })}>New</button>
          </div>
        </div>
        <div className="segmented three" role="radiogroup" aria-label="View">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'on' : ''} onClick={() => pick(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="row-between month-nav">
          <button className="pill" aria-label="Back" onClick={() => step(-1)}>‹</button>
          <span className="serif month-name">{title}</span>
          <button className="pill" aria-label="Forward" onClick={() => step(1)}>›</button>
        </div>
      </header>

      {events && events.length === 0 && (
        <section className="glass card stack">
          <p>Your calendar is empty for now. Tap New to add an event, or bring in your Google Calendar file and every view here will fill with your days.</p>
          <button className="pill solid" onClick={onOpenSettings}>Open Settings</button>
        </section>
      )}

      {view === 'day' && <DayView k={day} today={today} list={on(day)} color={color} onOpen={open} />}
      {view === 'week' && (
        <WeekView start={weekStartOf(day, weekStart)} today={today} on={on} color={color} onOpen={open}
          onPick={(k) => { setDay(k); pick('day') }} />
      )}
      {view === 'month' && (
        <MonthView month={day.slice(0, 7)} today={today} weekStart={weekStart} on={on} color={color}
          onPick={(k) => { setDay(k); pick('day') }} />
      )}
      {editing && <EventEditor event={editing.ev} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DayView({ k, today, list, color, onOpen }: { k: string; today: string; list: Occurrence[]; color: (o: Occurrence) => string; onOpen: (o: Occurrence) => void }) {
  const [d0] = span(k)
  const allDay = list.filter((o) => o.ev.allDay || o.end - o.start >= 86_400_000)
  const timed = list.filter((o) => !allDay.includes(o))
  const scroller = useRef<HTMLDivElement>(null)
  const now = new Date()
  const nowMin = k === today ? now.getHours() * 60 + now.getMinutes() : null

  // Open near the first event, or near now, instead of at midnight.
  useEffect(() => {
    const first = timed[0] ? Math.max(0, (timed[0].start - d0) / 60_000) : (nowMin ?? 7 * 60)
    scroller.current?.scrollTo({ top: Math.max(0, (first / 60 - 1) * HOUR) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])

  // Side by side columns for events that overlap.
  const cols: number[] = []
  const ends: number[] = []
  for (const o of timed) {
    let c = ends.findIndex((e) => e <= o.start)
    if (c === -1) c = ends.length
    ends[c] = o.end
    cols.push(c)
  }
  const width = Math.max(1, ends.length)
  const mark = moonLabel(k)

  return (
    <section className="glass card stack">
      {mark && <p className="small muted">{moonMark(k)} {mark} today</p>}
      {allDay.length > 0 && (
        <div className="stack tight">
          {allDay.map((o) => (
            <button key={o.ev.id + o.start} className="cal-chip" style={{ ['--ev' as string]: color(o) }} onClick={() => onOpen(o)}>{o.ev.title}</button>
          ))}
        </div>
      )}
      <div className="day-scroll" ref={scroller}>
        <div className="day-grid" style={{ height: 24 * HOUR }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="hour" style={{ top: h * HOUR }}>
              <span className="small muted">{h === 0 ? '' : fmtTime(new Date(2000, 0, 1, h)).replace(':00', '')}</span>
            </div>
          ))}
          {nowMin != null && <div className="now-line" style={{ top: (nowMin / 60) * HOUR }} aria-hidden="true" />}
          {timed.map((o, i) => {
            const top = (Math.max(0, o.start - d0) / 3_600_000) * HOUR
            const h = Math.max(22, ((Math.min(o.end, d0 + 86_400_000) - Math.max(o.start, d0)) / 3_600_000) * HOUR - 2)
            return (
              <button key={o.ev.id + o.start} onClick={() => onOpen(o)} className="day-ev" style={{ top, height: h, left: `calc(52px + (100% - 56px) * ${cols[i] / width})`, width: `calc((100% - 56px) / ${width} - 3px)`, ['--ev' as string]: color(o) }}>
                <strong>{o.ev.title}</strong>
                <span className="small">{fmtTime(new Date(o.start))}{o.end > o.start ? ` to ${fmtTime(new Date(o.end))}` : ''}</span>
                {o.ev.location && <span className="small muted">{o.ev.location}</span>}
              </button>
            )
          })}
        </div>
      </div>
      {list.length === 0 && <p className="small muted">Nothing on your calendar this day.</p>}
    </section>
  )
}

function WeekView({ start, today, on, color, onPick, onOpen }: { start: string; today: string; on: (k: string) => Occurrence[]; color: (o: Occurrence) => string; onPick: (k: string) => void; onOpen: (o: Occurrence) => void }) {
  return (
    <section className="glass card">
      <ul className="plain week-list">
        {Array.from({ length: 7 }, (_, i) => {
          const k = addDays(start, i)
          const list = on(k)
          const mark = moonLabel(k)
          return (
            <li key={k} className={k === today ? 'week-day today' : 'week-day'}>
              <button className="week-head" onClick={() => onPick(k)}>
                <span className="serif">{fromKey(k).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                {mark && <span className="small muted">{moonMark(k)} {mark}</span>}
              </button>
              {list.length === 0 && <p className="small muted">Open</p>}
              {list.map((o) => (
                <button key={o.ev.id + o.start} className="week-ev" style={{ ['--ev' as string]: color(o) }} onClick={() => onOpen(o)}>
                  <span className="small cal-time">{o.ev.allDay ? 'All day' : fmtTime(new Date(o.start))}</span>
                  <span>{o.ev.title}</span>
                </button>
              ))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MonthView({ month, today, weekStart, on, color, onPick }: { month: string; today: string; weekStart: 0 | 1; on: (k: string) => Occurrence[]; color: (o: Occurrence) => string; onPick: (k: string) => void }) {
  const [y, m] = month.split('-').map(Number)
  const first = dateKey(new Date(y, m - 1, 1, 12))
  const daysIn = new Date(y, m, 0).getDate()
  const lead = (new Date(y, m - 1, 1).getDay() - weekStart + 7) % 7
  return (
    <section className="glass card stack">
      <div className="month-grid">
        {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className="dow">{WEEKDAYS[(i + weekStart) % 7]}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const k = addDays(first, i)
          const list = on(k)
          return (
            <button key={k} className={k === today ? 'm-cell today' : 'm-cell'} onClick={() => onPick(k)} aria-label={`${k}, ${list.length} events`}>
              <span className="m-num">{i + 1}<span className="m-moon" aria-hidden="true">{moonMark(k)}</span></span>
              {list.slice(0, 2).map((o) => (
                <span key={o.ev.id + o.start} className="m-ev" style={{ ['--ev' as string]: color(o) }}>{o.ev.title}</span>
              ))}
              {list.length > 2 && <span className="m-more">+{list.length - 2}</span>}
            </button>
          )
        })}
      </div>
      <p className="small muted">● New Moon, ◐ First Quarter, ○ Full Moon, ◑ Last Quarter. Tap a day to open it.</p>
    </section>
  )
}
