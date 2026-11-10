import { describe, expect, it } from 'vitest'
import { parseIcs, eventsOn } from '../src/lib/ics'

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:yoga
SUMMARY:Yoga\\, gentle
DTSTART;TZID=America/Toronto:20261006T090000
DTEND;TZID=America/Toronto:20261006T100000
RRULE:FREQ=WEEKLY;BYDAY=TU,TH
EXDATE;TZID=America/Toronto:20261112T090000
END:VEVENT
BEGIN:VEVENT
UID:yoga
RECURRENCE-ID;TZID=America/Toronto:20261110T090000
SUMMARY:Yoga moved
DTSTART;TZID=America/Toronto:20261110T113000
DTEND;TZID=America/Toronto:20261110T123000
END:VEVENT
BEGIN:VEVENT
UID:book
SUMMARY:Book club
DTSTART:20260113T230000Z
DTEND:20260114T000000Z
RRULE:FREQ=MONTHLY;BYDAY=2TU
END:VEVENT
BEGIN:VEVENT
UID:bday
SUMMARY:Birthday
DTSTART;VALUE=DATE:20250623
DTEND;VALUE=DATE:20250624
RRULE:FREQ=YEARLY
END:VEVENT
END:VCALENDAR`

const day = (y: number, m: number, d: number) => [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()] as const
const titles = (y: number, m: number, d: number) => {
  const evs = parseIcs(ICS, 'test.ics')
  return eventsOn(evs, ...day(y, m, d)).map((o) => `${o.ev.title}@${new Date(o.start).getHours()}:${String(new Date(o.start).getMinutes()).padStart(2, '0')}`)
}

describe('ics', () => {
  it('expands weekly, moved and skipped occurrences', () => {
    expect(process.env.TZ).toBe('America/Toronto')
    expect(titles(2026, 11, 3)).toEqual(['Yoga, gentle@9:00']) // after DST ends, still 9am
    expect(titles(2026, 11, 10)).toEqual(['Yoga moved@11:30', 'Book club@18:00'])
    expect(titles(2026, 11, 12)).toEqual([])
    expect(titles(2026, 11, 5)).toEqual(['Yoga, gentle@9:00'])
  })
  it('handles monthly by weekday and yearly all-day', () => {
    expect(titles(2026, 12, 8)).toEqual(['Yoga, gentle@9:00', 'Book club@18:00'])
    expect(titles(2027, 6, 23)).toEqual(['Birthday@0:00'])
    expect(titles(2027, 6, 24)).toEqual(['Yoga, gentle@9:00'])
  })
})
