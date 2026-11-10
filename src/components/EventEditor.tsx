import { useState } from 'react'
import { Sheet, ConfirmButton } from './Sheet'
import { db, newId, type CalEvent } from '../lib/db'
import { dateKey } from '../lib/dates'
import { fmtTime } from '../lib/useProfile'

export const OWN_SOURCE = 'Cadence'
type Repeat = 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'DAILY', label: 'Every day' },
  { id: 'WEEKLY', label: 'Every week' },
  { id: 'MONTHLY', label: 'Every month' },
  { id: 'YEARLY', label: 'Every year' },
]

const hm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const at = (day: string, time: string) => new Date(`${day}T${time || '00:00'}`).getTime()

export function blankEvent(day: string): CalEvent {
  const now = new Date()
  const h = Math.min(22, now.getHours() + 1)
  const start = new Date(`${day}T${String(h).padStart(2, '0')}:00`).getTime()
  return { id: newId(), title: '', location: '', allDay: false, start, end: start + 3_600_000, rrule: null, exdates: [], source: OWN_SOURCE, note: '', sent: false }
}

/** Google's own "new event" page, filled in. Opening it and tapping Save puts the event in her Google Calendar. */
export function googleLink(e: CalEvent) {
  const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const day = (ms: number) => dateKey(new Date(ms)).replace(/-/g, '')
  const dates = e.allDay ? `${day(e.start)}/${day(e.end)}` : `${utc(e.start)}/${utc(e.end)}`
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates })
  if (e.location) p.set('location', e.location)
  if (e.note) p.set('details', e.note)
  if (e.rrule) p.set('recur', `RRULE:${e.rrule}`)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export function EventEditor({ event, isNew, onClose }: { event: CalEvent; isNew: boolean; onClose: () => void }) {
  const own = event.source === OWN_SOURCE
  const [day, setDay] = useState(dateKey(new Date(event.start)))
  const [endDay, setEndDay] = useState(dateKey(new Date(event.allDay ? event.end - 86_400_000 : event.end)))
  const [start, setStart] = useState(hm(event.start))
  const [end, setEnd] = useState(hm(event.end))
  const [e, setE] = useState(event)
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }))
  const repeat = (e.rrule?.match(/FREQ=(\w+)/)?.[1] as Repeat) ?? 'none'

  const build = (): CalEvent => {
    if (e.allDay) {
      const s = at(day, '00:00')
      const last = Math.max(s, at(endDay < day ? day : endDay, '00:00'))
      const d = new Date(last)
      d.setDate(d.getDate() + 1)
      return { ...e, title: e.title.trim() || 'New event', start: s, end: d.getTime() }
    }
    const s = at(day, start)
    let en = at(day, end)
    if (en <= s) en = s + 3_600_000
    return { ...e, title: e.title.trim() || 'New event', start: s, end: en }
  }
  const save = async (next = build()) => {
    await db.events.put(next)
    onClose()
  }
  const sendToGoogle = async () => {
    const next = { ...build(), sent: true }
    // Open first, while the tap still counts, or Safari blocks the new tab.
    window.open(googleLink(next), '_blank', 'noopener')
    await db.events.put(next)
    onClose()
  }

  if (!own) {
    return (
      <Sheet title={event.title} onClose={onClose}>
        <div className="stack">
          <p>
            {new Date(event.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {event.allDay ? ', all day' : `, ${fmtTime(new Date(event.start))} to ${fmtTime(new Date(event.end))}`}
          </p>
          {event.location && <p className="muted">{event.location}</p>}
          <p className="small muted">This one came from {event.source}. Change it in Google Calendar, then bring the file in again.</p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={isNew ? 'New event' : 'Edit event'} onClose={onClose}>
      <div className="stack">
        <label className="lbl" htmlFor="ev-title">Event</label>
        <input id="ev-title" className="field" value={e.title} placeholder="Coffee with Mom, dentist, full moon circle" onChange={(x) => set({ title: x.target.value })} autoFocus={isNew} />

        <label className="check" htmlFor="ev-allday">
          <input id="ev-allday" type="checkbox" checked={e.allDay} onChange={(x) => set({ allDay: x.target.checked })} />
          <span>All day</span>
        </label>

        <div className="row">
          <div className="grow">
            <label className="lbl" htmlFor="ev-day">{e.allDay ? 'From' : 'Day'}</label>
            <input id="ev-day" className="field" type="date" value={day} onChange={(x) => x.target.value && setDay(x.target.value)} />
          </div>
          {e.allDay && (
            <div className="grow">
              <label className="lbl" htmlFor="ev-endday">To</label>
              <input id="ev-endday" className="field" type="date" value={endDay < day ? day : endDay} onChange={(x) => x.target.value && setEndDay(x.target.value)} />
            </div>
          )}
        </div>
        {!e.allDay && (
          <div className="row">
            <div className="grow">
              <label className="lbl" htmlFor="ev-start">Starts</label>
              <input id="ev-start" className="field" type="time" value={start} onChange={(x) => setStart(x.target.value)} />
            </div>
            <div className="grow">
              <label className="lbl" htmlFor="ev-end">Ends</label>
              <input id="ev-end" className="field" type="time" value={end} onChange={(x) => setEnd(x.target.value)} />
            </div>
          </div>
        )}

        <label className="lbl" htmlFor="ev-repeat">Repeat</label>
        <select id="ev-repeat" className="field" value={repeat} onChange={(x) => set({ rrule: x.target.value === 'none' ? null : `FREQ=${x.target.value}` })}>
          {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>

        <label className="lbl" htmlFor="ev-where">Where (optional)</label>
        <input id="ev-where" className="field" value={e.location} onChange={(x) => set({ location: x.target.value })} />
        <label className="lbl" htmlFor="ev-note">Notes (optional)</label>
        <textarea id="ev-note" className="field" rows={3} value={e.note ?? ''} onChange={(x) => set({ note: x.target.value })} />

        <button className="pill solid" onClick={sendToGoogle}>{e.sent ? 'Save and open in Google again' : 'Save and add to Google Calendar'}</button>
        <button className="pill" onClick={() => save()}>Save in Cadence only</button>
        <p className="small muted">
          Adding to Google opens a new event in Google Calendar with everything filled in. Tap Save there and it is in your Google Calendar too.
        </p>
        {!isNew && (
          <ConfirmButton label="Delete" confirmLabel="Delete this event"
            onConfirm={async () => {
              await db.events.delete(e.id)
              onClose()
            }} />
        )}
        {!isNew && e.sent && <p className="small muted">Deleting here does not remove it from Google Calendar.</p>}
      </div>
    </Sheet>
  )
}
