import { db, getSetting, setSetting, type CalEvent } from './db'

/**
 * Live Google Calendar, straight from the phone to Google. No server in between.
 * Sign-in uses Google's redirect flow, which works inside a Home Screen app on iPhone.
 * The key (client ID) she makes in Google Cloud is not a secret, it only names the app to Google.
 */

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'
const API = 'https://www.googleapis.com/calendar/v3'
const LS = { state: 'g-state', token: 'g-token', tried: 'g-silent-tried' }

interface Token { access: string; exp: number }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private window */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* private window */ } },
}

export const redirectUri = () => `${location.origin}${import.meta.env.BASE_URL}`

export function token(): Token | null {
  try {
    const t = JSON.parse(ls.get(LS.token) ?? 'null') as Token | null
    return t && t.exp > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
}

/** Sends her to Google to sign in. With silent, Google answers at once if she already said yes before. */
export async function connect(silent = false) {
  const clientId = await getSetting<string>('googleClientId')
  if (!clientId) throw new Error('Add your Google key in Settings first.')
  const state = Math.random().toString(36).slice(2)
  ls.set(LS.state, state)
  const p = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri(), response_type: 'token', scope: SCOPES,
    include_granted_scopes: 'true', state,
  })
  if (silent) p.set('prompt', 'none')
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p}`)
}

/** Call once at start. Picks up the sign-in Google hands back in the address, then tidies the address. */
export async function finishSignIn(): Promise<'ok' | 'error' | null> {
  const hash = location.hash.startsWith('#') ? new URLSearchParams(location.hash.slice(1)) : null
  if (!hash || (!hash.get('access_token') && !hash.get('error'))) return null
  history.replaceState(null, '', location.pathname + location.search)
  if (hash.get('state') !== ls.get(LS.state)) return 'error'
  ls.del(LS.state)
  const access = hash.get('access_token')
  if (!access) return 'error'
  ls.set(LS.token, JSON.stringify({ access, exp: Date.now() + Number(hash.get('expires_in') ?? 3600) * 1000 }))
  await setSetting('googleConnected', true)
  return 'ok'
}

/** At launch, if she has connected before and the hour-long pass has run out, quietly ask Google for a new one. */
export async function refreshAtLaunch() {
  if (token() || !(await getSetting('googleConnected')) || !(await getSetting('googleClientId'))) return false
  const last = Number(ls.get(LS.tried) ?? 0)
  if (Date.now() - last < 10 * 60_000) return false // tried a moment ago, don't loop
  ls.set(LS.tried, String(Date.now()))
  await connect(true)
  return true
}

export async function disconnect() {
  const t = token()
  ls.del(LS.token)
  await setSetting('googleConnected', false)
  await db.events.filter((e) => !!e.calendarId).delete()
  if (t) fetch(`https://oauth2.googleapis.com/revoke?token=${t.access}`, { method: 'POST' }).catch(() => {})
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token()
  if (!t) throw new Error('signed-out')
  const res = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${t.access}`, 'Content-Type': 'application/json', ...init.headers } })
  if (res.status === 401) {
    ls.del(LS.token)
    throw new Error('signed-out')
  }
  if (!res.ok) throw new Error(`Google said no (${res.status}).`)
  return (res.status === 204 ? null : await res.json()) as T
}

interface GTime { date?: string; dateTime?: string }
interface GEvent { id: string; status?: string; summary?: string; location?: string; description?: string; start: GTime; end: GTime; recurringEventId?: string }

const toMs = (t: GTime) => (t.dateTime ? new Date(t.dateTime).getTime() : new Date(`${t.date}T00:00`).getTime())

/** Brings in the next year (and the last two months) from every calendar she shows in Google. */
export async function syncNow() {
  const list = await api<{ items: { id: string; summary: string; summaryOverride?: string; selected?: boolean; primary?: boolean; backgroundColor?: string; accessRole: string }[] }>(
    '/users/me/calendarList?fields=items(id,summary,summaryOverride,selected,primary,backgroundColor,accessRole)',
  )
  const cals = list.items.filter((c) => c.selected || c.primary)
  const from = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const to = new Date(Date.now() + 365 * 86_400_000).toISOString()
  const out: CalEvent[] = []
  for (const c of cals) {
    let page = ''
    do {
      const q = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: 'true', maxResults: '2500', fields: 'nextPageToken,items(id,status,summary,location,description,start,end,recurringEventId)' })
      if (page) q.set('pageToken', page)
      const r = await api<{ items: GEvent[]; nextPageToken?: string }>(`/calendars/${encodeURIComponent(c.id)}/events?${q}`)
      for (const g of r.items) {
        if (g.status === 'cancelled' || !g.start) continue
        out.push({
          id: `g:${c.id}:${g.id}`, title: g.summary ?? 'Busy', location: g.location ?? '', note: g.description ?? '',
          allDay: !!g.start.date, start: toMs(g.start), end: toMs(g.end), rrule: null, exdates: [],
          source: c.summaryOverride ?? (c.primary ? 'Google' : c.summary), calendarId: c.id, googleId: g.id,
          color: c.backgroundColor, canEdit: c.accessRole === 'owner' || c.accessRole === 'writer',
        })
      }
      page = r.nextPageToken ?? ''
    } while (page)
  }
  await db.transaction('rw', db.events, async () => {
    await db.events.filter((e) => !!e.calendarId).delete()
    await db.events.bulkPut(out)
  })
  await setSetting('googleLastSync', Date.now())
  return out.length
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function body(e: CalEvent) {
  const when = (ms: number) => (e.allDay ? { date: dayOf(ms) } : { dateTime: new Date(ms).toISOString(), timeZone: zone() })
  return {
    summary: e.title, location: e.location || undefined, description: e.note || undefined,
    start: when(e.start), end: when(e.end),
    ...(e.rrule && !e.googleId ? { recurrence: [`RRULE:${e.rrule}`] } : {}),
  }
}

/** Saves an event to Google, new or changed, then refreshes so every repeat shows. */
export async function saveToGoogle(e: CalEvent) {
  if (e.googleId && e.calendarId) {
    await api(`/calendars/${encodeURIComponent(e.calendarId)}/events/${e.googleId}`, { method: 'PATCH', body: JSON.stringify(body(e)) })
  } else {
    await api('/calendars/primary/events', { method: 'POST', body: JSON.stringify(body(e)) })
    await db.events.delete(e.id)
  }
  await syncNow()
}

export async function deleteFromGoogle(e: CalEvent) {
  if (!e.googleId || !e.calendarId) return
  await api(`/calendars/${encodeURIComponent(e.calendarId)}/events/${e.googleId}`, { method: 'DELETE' })
  await db.events.delete(e.id)
}
