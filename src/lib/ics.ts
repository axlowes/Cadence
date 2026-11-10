import { db, type CalEvent } from './db'

/** Reads an .ics calendar file, like the one Google Calendar exports, into events. */
export function parseIcs(text: string, source: string): CalEvent[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const events: CalEvent[] = []
  const moved: { uid: string; at: number }[] = []
  let cur: Record<string, { params: Record<string, string>; value: string }[]> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur) {
        const ev = toEvent(cur, source)
        if (ev) {
          if (ev.recurrenceOf) moved.push({ uid: ev.recurrenceOf, at: ev.recurrenceAt! })
          if (!ev.cancelled) events.push(ev.event)
        }
      }
      cur = null
      continue
    }
    if (!cur) continue
    const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/)
    if (!m) continue
    const params: Record<string, string> = {}
    for (const p of m[2].split(';').filter(Boolean)) {
      const [k, v] = p.split('=')
      params[k] = (v ?? '').replace(/^"|"$/g, '')
    }
    ;(cur[m[1]] ??= []).push({ params, value: m[3] })
  }
  // A moved or cancelled single occurrence is left out of its repeating series.
  for (const mv of moved) {
    const master = events.find((e) => e.id === mv.uid)
    if (master) master.exdates.push(mv.at)
  }
  return events
}

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

function toEvent(p: Record<string, { params: Record<string, string>; value: string }[]>, source: string) {
  const first = (k: string) => p[k]?.[0]
  const ds = first('DTSTART')
  if (!ds) return null
  const allDay = ds.params.VALUE === 'DATE' || /^\d{8}$/.test(ds.value)
  const start = parseTime(ds.value, ds.params.TZID)
  const de = first('DTEND')
  let end = de ? parseTime(de.value, de.params.TZID) : NaN
  if (isNaN(end)) {
    const dur = first('DURATION')?.value
    end = dur ? start + durationMs(dur) : allDay ? addLocalDays(start, 1) : start
  }
  const uid = first('UID')?.value ?? `${start}-${first('SUMMARY')?.value ?? ''}`
  const rid = first('RECURRENCE-ID')
  const exdates = (p.EXDATE ?? []).flatMap((x) => x.value.split(',').map((v) => parseTime(v, x.params.TZID)))
  const recurrenceAt = rid ? parseTime(rid.value, rid.params.TZID) : undefined
  return {
    cancelled: first('STATUS')?.value === 'CANCELLED',
    recurrenceOf: rid ? uid : undefined,
    recurrenceAt,
    event: {
      id: rid ? `${uid}@${recurrenceAt}` : uid,
      title: unescape(first('SUMMARY')?.value ?? 'Busy'),
      location: unescape(first('LOCATION')?.value ?? ''),
      allDay,
      start,
      end,
      rrule: rid ? null : (first('RRULE')?.value ?? null),
      exdates,
      source,
    } satisfies CalEvent,
  }
}

function durationMs(d: string) {
  const m = d.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/)
  if (!m) return 0
  const [w, dd, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0))
  return ((((w * 7 + dd) * 24 + h) * 60 + mi) * 60 + s) * 1000
}

/** 20251110 is local midnight, 20251110T150000Z is UTC, anything else is wall time in its time zone. */
function parseTime(v: string, tz?: string): number {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return NaN
  const [y, mo, d, h = 0, mi = 0, s = 0] = m.slice(1, 7).map((x) => Number(x ?? 0))
  if (!m[4]) return new Date(y, mo - 1, d).getTime()
  if (m[7]) return Date.UTC(y, mo - 1, d, h, mi, s)
  if (tz) {
    try {
      return zoned(y, mo - 1, d, h, mi, s, tz)
    } catch {
      /* unknown zone name, read it as local time */
    }
  }
  return new Date(y, mo - 1, d, h, mi, s).getTime()
}

function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
  const want = Date.UTC(y, mo, d, h, mi, s)
  let t = want
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]))
    const seen = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second)
    t += want - seen
  }
  return t
}

const addLocalDays = (ms: number, n: number) => {
  const d = new Date(ms)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Start times of every occurrence of a repeating series, in order. Keeps local clock time across daylight saving. */
function* starts(ev: CalEvent, until: number): Generator<number> {
  if (!ev.rrule) { yield ev.start; return }
  const r = Object.fromEntries(ev.rrule.split(';').map((kv) => kv.split('=')))
  const freq = r.FREQ as string
  const interval = Math.max(1, Number(r.INTERVAL ?? 1))
  const count = r.COUNT ? Number(r.COUNT) : Infinity
  const stop = Math.min(until, r.UNTIL ? parseTime(r.UNTIL) + (/^\d{8}$/.test(r.UNTIL) ? 86_400_000 - 1 : 0) : Infinity)
  const s0 = new Date(ev.start)
  const at = (y: number, m: number, d: number) => new Date(y, m, d, s0.getHours(), s0.getMinutes(), s0.getSeconds()).getTime()
  const byday: { n: number; wd: number }[] = (r.BYDAY ?? '').split(',').filter(Boolean).map((x: string) => {
    const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/)
    return { n: m?.[1] ? Number(m[1]) : 0, wd: DAYS.indexOf(m?.[2] ?? '') }
  })
  const bymd: number[] = (r.BYMONTHDAY ?? '').split(',').filter(Boolean).map(Number)
  let n = 0
  const emit = function* (t: number) {
    if (t < ev.start || t > stop || n >= count) return
    n++
    yield t
  }
  for (let k = 0; k < 40_000; k++) {
    let batch: number[] = []
    if (freq === 'DAILY') {
      batch = [at(s0.getFullYear(), s0.getMonth(), s0.getDate() + k * interval)]
    } else if (freq === 'WEEKLY') {
      const wkst = DAYS.indexOf(r.WKST ?? 'MO')
      const back = (s0.getDay() - wkst + 7) % 7
      const base = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() - back + k * 7 * interval)
      const wds = byday.length ? byday.map((b) => b.wd) : [s0.getDay()]
      batch = wds.map((wd) => at(base.getFullYear(), base.getMonth(), base.getDate() + ((wd - wkst + 7) % 7)))
    } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
      const step = freq === 'YEARLY' ? 12 * interval : interval
      const month0 = freq === 'YEARLY' && r.BYMONTH ? Number(r.BYMONTH) - 1 : s0.getMonth()
      const first = new Date(s0.getFullYear(), month0 + k * step, 1)
      const y = first.getFullYear(), m = first.getMonth()
      const dim = new Date(y, m + 1, 0).getDate()
      if (byday.length) {
        for (const b of byday) {
          const all: number[] = []
          for (let d = 1; d <= dim; d++) if (new Date(y, m, d).getDay() === b.wd) all.push(d)
          const picks = b.n > 0 ? [all[b.n - 1]] : b.n < 0 ? [all[all.length + b.n]] : all
          for (const d of picks) if (d) batch.push(at(y, m, d))
        }
      } else {
        const days = bymd.length ? bymd.map((d) => (d < 0 ? dim + d + 1 : d)) : [s0.getDate()]
        for (const d of days) if (d >= 1 && d <= dim) batch.push(at(y, m, d))
      }
    } else {
      yield ev.start
      return
    }
    batch.sort((a, b) => a - b)
    for (const t of batch) {
      if (t > stop || n >= count) return
      yield* emit(t)
    }
  }
}

export interface Occurrence { ev: CalEvent; start: number; end: number }

/** Every event, or occurrence of a repeating one, that touches the day from dayStart to dayEnd. */
export function eventsOn(events: CalEvent[], dayStart: number, dayEnd: number): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of events) {
    if (ev.start >= dayEnd) continue
    const dur = Math.max(0, ev.end - ev.start)
    const skip = new Set(ev.exdates)
    for (const t of starts(ev, dayEnd)) {
      if (t >= dayEnd) break
      const e = t + dur
      if (skip.has(t)) continue
      if (e > dayStart || (dur === 0 && t >= dayStart)) out.push({ ev, start: t, end: e })
    }
  }
  return out.sort((a, b) => Number(b.ev.allDay) - Number(a.ev.allDay) || a.start - b.start)
}

/** Replaces whatever came from the same file before, and keeps the past light. */
export async function importIcs(file: File) {
  const text = await file.text()
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('This does not look like a calendar file. Look for one that ends in .ics.')
  const cutoff = Date.now() - 400 * 86_400_000
  const events = parseIcs(text, file.name).filter((e) => e.rrule || e.end > cutoff)
  await db.transaction('rw', db.events, async () => {
    await db.events.filter((e) => e.source === file.name).delete()
    // Events she made here and sent to Google now come back inside the file, so keep only one copy.
    const key = (e: CalEvent) => `${e.title.trim().toLowerCase()}|${e.start}`
    const incoming = new Set(events.map(key))
    await db.events.filter((e) => e.source === 'Cadence' && !!e.sent && incoming.has(key(e))).delete()
    await db.events.bulkPut(events)
  })
  return events.length
}
