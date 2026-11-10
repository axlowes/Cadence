import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../lib/db'
import { connect, disconnect, redirectUri, syncNow, token } from '../lib/google'
import { eventsOn, importIcs } from '../lib/ics'
import { fmtTime } from '../lib/useProfile'
import { Fold } from './Fold'

/** Today's events from the calendars she has brought in. Hidden until there is at least one. */
export function TodayCalendar({ now }: { now: Date }) {
  const events = useLiveQuery(() => db.events.toArray(), []) ?? []
  if (!events.length) return null
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const list = eventsOn(events, d0, d1)
  const next = list.find((o) => !o.ev.allDay && o.start > now.getTime())
  const hint = list.length ? `${list.length} today${next ? `, next at ${fmtTime(new Date(next.start))}` : ''}` : 'Nothing today'
  return (
    <Fold id="calendar" title="Today's calendar" hint={hint}>
      {list.length === 0 && <p className="muted">Nothing on your calendar today. The hours are yours.</p>}
      <ul className="plain cal-list">
        {list.map((o) => {
          const past = !o.ev.allDay && o.end < now.getTime()
          return (
            <li key={o.ev.id + o.start} className={past ? 'cal-item past' : 'cal-item'}>
              <span className="cal-time small">{o.ev.allDay ? 'All day' : `${fmtTime(new Date(o.start))}`}</span>
              <span>
                <span className="cal-title">{o.ev.title}</span>
                {o.ev.location && <span className="small muted cal-where">{o.ev.location}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </Fold>
  )
}

/** Settings card for bringing a Google Calendar export into the app. */
export function CalendarCard() {
  const count = useLiveQuery(() => db.events.count(), []) ?? 0
  const sources = useLiveQuery(async () => [...new Set((await db.events.toArray()).map((e) => e.source))], []) ?? []
  const input = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  return (
    <section className="glass card stack">
      <h2 className="serif">Calendar from a file</h2>
      <p className="small">
        On a computer, open calendar.google.com, then the gear, Settings, Import and export, and Export. Open the zip it downloads and choose the .ics file for the calendar you want here.
      </p>
      {count > 0 && <p className="small muted">{count} events from {sources.join(', ')}.</p>}
      <div className="row">
        <button className="pill solid" onClick={() => input.current?.click()}>{count ? 'Bring in another calendar' : 'Choose a calendar file'}</button>
        {count > 0 && (
          <button className="pill" onClick={async () => { await db.events.clear(); setMsg('Your calendar events were cleared.') }}>Clear</button>
        )}
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      <input ref={input} type="file" accept=".ics,text/calendar" hidden multiple
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          try {
            let n = 0
            for (const f of files) n += await importIcs(f)
            setMsg(`${n} events are in. You will find today's on the Today screen.`)
          } catch (err) {
            setMsg((err as Error).message)
          }
        }} />
      <p className="small muted">Bringing the same file in again replaces the old copy, so you can refresh it whenever your plans change.</p>
    </section>
  )
}

/** Settings card for live Google Calendar. */
export function GoogleCard() {
  const clientId = useLiveQuery(() => db.settings.get('googleClientId').then((r) => (r?.value as string) ?? ''), [])
  const last = useLiveQuery(() => db.settings.get('googleLastSync').then((r) => r?.value as number | undefined), [])
  const connected = useLiveQuery(() => db.settings.get('googleConnected').then((r) => !!r?.value), [])
  const [msg, setMsg] = useState('')
  const live = !!token()
  if (clientId === undefined) return null
  return (
    <section className="glass card stack">
      <h2 className="serif">Live Google Calendar</h2>
      {!clientId && (
        <p className="small">Paste the key you made in Google Cloud. It ends in .apps.googleusercontent.com.</p>
      )}
      <label className="lbl" htmlFor="g-client">Your Google key (client ID)</label>
      <input id="g-client" className="field" defaultValue={clientId} placeholder="1234-abc.apps.googleusercontent.com" autoComplete="off" spellCheck={false}
        onBlur={(e) => setSetting('googleClientId', e.target.value.trim())} />
      <p className="small muted">Your web address for Google is {redirectUri()}</p>
      {clientId && !live && (
        <button className="pill solid" onClick={() => connect().catch((e) => setMsg((e as Error).message))}>
          {connected ? 'Reconnect Google' : 'Connect Google Calendar'}
        </button>
      )}
      {live && (
        <>
          <p className="small">Connected. Your calendars refresh when you open Cadence and every 15 minutes while it is open.</p>
          {last && <p className="small muted">Last refreshed {new Date(last).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.</p>}
          <div className="row">
            <button className="pill solid" onClick={async () => {
              setMsg('Refreshing...')
              try { setMsg(`${await syncNow()} events are up to date.`) } catch (e) { setMsg((e as Error).message === 'signed-out' ? 'Google signed you out. Tap Reconnect.' : (e as Error).message) }
            }}>Refresh now</button>
            <button className="pill" onClick={async () => { await disconnect(); setMsg('Google is disconnected. Its events were cleared from Cadence.') }}>Disconnect</button>
          </div>
        </>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  )
}
