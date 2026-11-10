import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Feeling, type FeelingEntry } from '../lib/db'
import type { MoonInfo } from '../lib/useMoon'
import { dateKey } from '../lib/dates'
import { fmtTime } from '../lib/useProfile'
import { Fold } from './Fold'
import { useCycle } from './Cycle'
import { moonOfStart, PHASE, type Phase } from '../lib/cycle'

export const FEELINGS: { id: Feeling; label: string; color: string; line: string }[] = [
  { id: 'calm', label: 'Calm', color: '#8FB8DE', line: 'Calm, like still water holding the Moon. Notice what brought you here, so you can find the way back.' },
  { id: 'happy', label: 'Happy', color: '#F2C46D', line: 'Happy. Drink this one all the way down, and save a little of the light for a grayer day.' },
  { id: 'excited', label: 'Excited', color: '#F29E6D', line: 'Excited, a spark looking for kindling. Write down what lit it before the feeling moves on.' },
  { id: 'proud', label: 'Proud', color: '#C9A0F2', line: 'Proud. Let yourself have it fully. You built this with your own two hands.' },
  { id: 'energized', label: 'Energized', color: '#7FD1B9', line: 'Energized, fire in your legs and in your thoughts. Spend it on the thing that matters most today.' },
  { id: 'tired', label: 'Tired', color: '#A7A2C9', line: 'Tired. Your body is asking for softness, and listening to her is its own kind of magic.' },
  { id: 'low', label: 'Low', color: '#7C8FB5', line: 'Low. Be gentle with yourself today. The Moon goes dark every month, and she always comes back.' },
  { id: 'irritable', label: 'Irritable', color: '#E07A7A', line: 'Irritable, heat with nowhere to go yet. Give it a walk, a breath or a page before you give it to anyone.' },
  { id: 'confused', label: 'Confused', color: '#D6A6C9', line: 'Confused. You are standing at a crossroads in the fog, and you are allowed to wait there until it lifts.' },
  { id: 'numb', label: 'Numb', color: '#B8B4AE', line: 'Numb. Sometimes the heart goes quiet to rest. A warm cup, a slow breath, and feeling will find its way back.' },
]

const FEATURES: Record<Feeling, React.ReactNode> = {
  calm: (<><path d="M12 18q3 2.2 6 0M22 18q3 2.2 6 0" /><path d="M15 25.5q5 3 10 0" /></>),
  happy: (<><circle cx="15" cy="17" r="1.4" className="fill" /><circle cx="25" cy="17" r="1.4" className="fill" /><path d="M13 23q7 7.5 14 0" /></>),
  excited: (<><circle cx="15" cy="16.5" r="2.2" /><circle cx="25" cy="16.5" r="2.2" /><path d="M13.5 23h13q-6.5 9-13 0z" /><path d="M6 8l1.5 1.5M34 8l-1.5 1.5M20 3.5v1.8" /></>),
  proud: (<><path d="M12 18q3-3 6 0M22 18q3-3 6 0" /><path d="M15 25q5 3.5 10-.5" /><path d="M11 13.5l4-1M29 13.5l-4-1" /></>),
  energized: (<><circle cx="15" cy="17" r="1.8" /><circle cx="25" cy="17" r="1.8" /><path d="M13 23.5h14q-7 7-14 0z" /><path d="M13 23.5h14" /><path d="M31 5l-2 4h3l-2 4" /></>),
  tired: (<><path d="M12 18h6M22 18h6" /><path d="M12.5 18q2.5 2 5 0M22.5 18q2.5 2 5 0" /><path d="M16.5 26.5h7" /><path d="M29 8h3l-3 3h3" /></>),
  low: (<><circle cx="15" cy="18" r="1.4" className="fill" /><circle cx="25" cy="18" r="1.4" className="fill" /><path d="M15 27.5q5-4 10 0" /><path d="M26 21.5q-1 2 0 2.6q1-.6 0-2.6z" className="fill" /></>),
  irritable: (<><path d="M12 13.5l5 2.5M28 13.5l-5 2.5" /><circle cx="15.5" cy="18.5" r="1.4" className="fill" /><circle cx="24.5" cy="18.5" r="1.4" className="fill" /><path d="M14.5 26.5l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 1.5 1" /></>),
  confused: (<><path d="M12 13q3-2 6 0M23 15.5h5" /><circle cx="15" cy="17.5" r="1.4" className="fill" /><circle cx="25.5" cy="18" r="1.4" className="fill" /><path d="M14 26q2-2 4 0t4 0 4 0" /></>),
  numb: (<><path d="M12.5 18h5M22.5 18h5" /><path d="M15 26h10" /></>),
}

export function Face({ feeling, size = 44 }: { feeling: Feeling; size?: number }) {
  const f = FEELINGS.find((x) => x.id === feeling)!
  return (
    <svg className="face" width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="20" cy="20" r="15.5" fill={f.color} fillOpacity={0.32} stroke={f.color} />
      {FEATURES[feeling]}
    </svg>
  )
}

const label = (id: Feeling) => FEELINGS.find((f) => f.id === id)!.label

/** The ten little faces. Each check-in is saved with the Moon's sign and phase at that moment. */
export function FeelingsCard({ now, info }: { now: Date; info: MoonInfo }) {
  const today = dateKey(now)
  const entries = useLiveQuery(() => db.feelings.where('date').equals(today).sortBy('at'), [today]) ?? []
  const [justPicked, setJustPicked] = useState<string | null>(null)
  const latest = entries.at(-1)
  const active = latest && latest.id === justPicked ? latest : null

  async function pick(feeling: Feeling) {
    // A second tap within a few minutes changes your answer instead of adding another check-in.
    if (latest && Date.now() - latest.at < 10 * 60_000) {
      await db.feelings.update(latest.id, { feeling })
      setJustPicked(latest.id)
      return
    }
    const entry: FeelingEntry = {
      id: newId(), at: Date.now(), date: today, feeling, note: '',
      moonSign: info.moon.sign, phaseName: info.moon.phaseName,
      illumination: info.moon.illumination, voc: info.voc.isVoid,
    }
    await db.feelings.add(entry)
    setJustPicked(entry.id)
  }

  return (
    <Fold id="feelings" title={<>How are you feeling? <Face feeling="happy" size={28} /></>} hint={latest ? `You felt ${label(latest.feeling).toLowerCase()} at ${fmtTime(new Date(latest.at))}` : 'Tap to check in'}>
      <div className="faces" role="group" aria-label="Pick how you feel">
        {FEELINGS.map((f) => {
          const on = latest?.feeling === f.id && Date.now() - latest.at < 10 * 60_000
          return (
            <button key={f.id} className={on ? 'face-btn on' : 'face-btn'} aria-pressed={on} onClick={() => pick(f.id)} style={{ ['--face' as string]: f.color }}>
              <Face feeling={f.id} />
              <span>{f.label}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <div className="stack tight feeling-reply">
          <p>{FEELINGS.find((f) => f.id === active.feeling)!.line}</p>
          <p className="small muted">
            Saved with the Moon in {active.moonSign}, {active.phaseName.toLowerCase()}{active.voc ? ', void of course' : ''}.
          </p>
          <label className="lbl" htmlFor="feeling-note">Anything you want to remember?</label>
          <textarea id="feeling-note" className="field" rows={3} key={active.id} defaultValue={active.note}
            placeholder="What happened, who you were with, what your body is telling you"
            onBlur={(e) => db.feelings.update(active.id, { note: e.target.value })} />
        </div>
      )}

      {entries.length > 0 && (
        <ul className="plain feeling-log">
          {entries.map((e) => (
            <li key={e.id} className="row">
              <Face feeling={e.feeling} size={24} />
              <span className="small">{fmtTime(new Date(e.at))}, {label(e.feeling).toLowerCase()}</span>
              {e.note && <span className="small muted feeling-note">{e.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Fold>
  )
}

function tops<T>(items: T[], key: (x: T) => string | null, feel: (x: T) => Feeling, limit = 2) {
  const by = new Map<string, Map<Feeling, number>>()
  for (const x of items) {
    const k = key(x)
    if (!k) continue
    const m = by.get(k) ?? new Map<Feeling, number>()
    m.set(feel(x), (m.get(feel(x)) ?? 0) + 1)
    by.set(k, m)
  }
  return [...by.entries()]
    .map(([k, m]) => {
      const [top, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
      return { k, top, n }
    })
    .filter((p) => p.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
}

/** Recent check-ins for the Insights tab, read against the Moon and her cycle. */
export function FeelingHistory() {
  const entries = useLiveQuery(() => db.feelings.orderBy('at').reverse().limit(120).toArray(), []) ?? []
  const cycle = useCycle()
  const withCycle = entries.map((e) => ({ e, c: cycle.on(e.date) }))

  const patterns = [
    ...tops(entries, (e) => e.moonSign, (e) => e.feeling).map((p) => ({ ...p, text: `With the Moon in ${p.k}, you have felt ${label(p.top).toLowerCase()} ${p.n} times.` })),
    ...tops(entries, (e) => e.phaseName, (e) => e.feeling).map((p) => ({ ...p, text: `Under a ${p.k.toLowerCase()}, you have felt ${label(p.top).toLowerCase()} ${p.n} times.` })),
    ...tops(withCycle, (x) => x.c?.phase ?? null, (x) => x.e.feeling).map((p) => ({
      ...p, text: `In your ${p.k.toLowerCase()} days, ${PHASE[p.k as Phase].season}, you have felt ${label(p.top).toLowerCase()} ${p.n} times.`,
    })),
  ]

  const starts = cycle.ps.slice(-6).reverse()
  let lastDate = ''
  return (
    <div className="stack">
      {!entries.length && <p className="muted">Check in with the faces on Today, and your feelings will gather here beside the Moon that held them.</p>}
      {patterns.length > 0 && (
        <div className="stack tight">
          <p className="lbl">Patterns so far</p>
          {patterns.map((p) => (
            <p key={p.text} className="row">
              <Face feeling={p.top} size={28} />
              <span>{p.text}</span>
            </p>
          ))}
        </div>
      )}
      {entries.length > 0 && patterns.length === 0 && (
        <p className="small muted">Patterns appear once a feeling returns under the same Moon or in the same part of your cycle.</p>
      )}

      {starts.length > 0 && (
        <div className="stack tight">
          <p className="lbl">Your periods and the Moon</p>
          {starts.map((p) => {
            const m = moonOfStart(p.start)
            return (
              <p key={p.start} className="small">
                {new Date(p.start + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}: began under a {m.phaseName.toLowerCase()} in {m.sign}
                {m.kind ? `, a ${m.kind} cycle` : ''}.
              </p>
            )
          })}
          <p className="small muted">A period near the New Moon is called a White Moon cycle, a time for turning inward. Near the Full Moon it is a Red Moon cycle, the healer's and creator's rhythm.</p>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="plain feeling-log">
          {withCycle.map(({ e, c }) => {
            const head = e.date !== lastDate
            lastDate = e.date
            return (
              <li key={e.id} className="stack tight">
                {head && <p className="lbl">{new Date(e.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>}
                <div className="row">
                  <Face feeling={e.feeling} size={28} />
                  <span>
                    {label(e.feeling)}{' '}
                    <span className="small muted">
                      at {fmtTime(new Date(e.at))}, Moon in {e.moonSign}, {e.phaseName.toLowerCase()}{c ? `, cycle day ${c.day}` : ''}
                    </span>
                  </span>
                </div>
                {e.note && <p className="small feeling-note">{e.note}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
