import { useState } from 'react'
import { Sheet, ConfirmButton } from './Sheet'
import { HabitGlyph, HABIT_ICONS } from './Icons'
import { db, type Habit, type HabitType, type MoonWhen } from '../lib/db'
import { HABIT_COLORS, isPaused, pauseNow, resumeNow } from '../lib/habits'
import { WEEKDAYS } from '../lib/dates'
import { MOON_WHEN_LABEL } from '../lib/moonDays'

export function HabitEditor({ habit, isNew, today, onClose, folders = [] }: { habit: Habit; isNew: boolean; today: string; onClose: () => void; folders?: string[] }) {
  const [h, setH] = useState<Habit>(habit)
  const set = (patch: Partial<Habit>) => setH((x) => ({ ...x, ...patch }))
  const setSched = (patch: Partial<Habit['schedule']>) => setH((x) => ({ ...x, schedule: { ...x.schedule, ...patch } }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function save(next = h) {
    await db.habits.put({
      ...next,
      name: next.name.trim() || 'New habit',
      steps: (next.steps ?? []).map((x) => x.trim()).filter(Boolean),
      folder: next.folder?.trim() || null,
    })
    onClose()
  }

  const paused = isPaused(h, today)

  return (
    <Sheet title={isNew ? 'New habit' : 'Edit habit'} onClose={onClose}>
      <div className="stack">
        <label className="lbl" htmlFor="habit-name">Name</label>
        <input id="habit-name" className="field" value={h.name} placeholder="Morning tea, workout, laundry" onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />

        <span className="lbl">Kind</span>
        <div className="segmented three" role="radiogroup" aria-label="Kind of habit">
          {(['check', 'count', 'weekly'] as HabitType[]).map((t) => (
            <button key={t} role="radio" aria-checked={h.type === t} className={h.type === t ? 'on' : ''}
              onClick={() => set({ type: t, target: t === 'check' ? 1 : t === 'count' ? Math.max(2, h.target) : Math.min(7, Math.max(1, h.target)) })}>
              {t === 'check' ? 'Done or not' : t === 'count' ? 'Count' : 'Weekly goal'}
            </button>
          ))}
        </div>
        {h.type !== 'check' && (
          <div className="row">
            <label className="lbl" htmlFor="habit-target">{h.type === 'count' ? 'Times each day' : 'Times each week'}</label>
            <div className="stepper">
              <button className="key-mini" aria-label="Less" onClick={() => set({ target: Math.max(1, h.target - 1) })}>−</button>
              <input id="habit-target" className="field num" inputMode="numeric" value={h.target}
                onChange={(e) => set({ target: Math.max(1, Math.min(h.type === 'weekly' ? 7 : 99, Number(e.target.value) || 1)) })} />
              <button className="key-mini" aria-label="More" onClick={() => set({ target: Math.min(h.type === 'weekly' ? 7 : 99, h.target + 1) })}>+</button>
            </div>
          </div>
        )}

        {h.type === 'count' && (
          <div className="row">
            <div className="grow">
              <label className="lbl" htmlFor="habit-unit">Measured in</label>
              <input id="habit-unit" className="field" placeholder="glasses, g, servings" value={h.unit ?? ''} onChange={(e) => set({ unit: e.target.value })} />
            </div>
            <div className="grow">
              <label className="lbl" htmlFor="habit-step">Each tap adds</label>
              <input id="habit-step" className="field num" inputMode="numeric" value={h.step ?? 1}
                onChange={(e) => set({ step: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </div>
        )}

        {h.type !== 'weekly' && (
          <>
            <span className="lbl">When</span>
            <div className="segmented three" role="radiogroup" aria-label="Schedule">
              <button role="radio" aria-checked={h.schedule.kind === 'daily'} className={h.schedule.kind === 'daily' ? 'on' : ''} onClick={() => setSched({ kind: 'daily' })}>Every day</button>
              <button role="radio" aria-checked={h.schedule.kind === 'weekdays'} className={h.schedule.kind === 'weekdays' ? 'on' : ''} onClick={() => setSched({ kind: 'weekdays' })}>Some days</button>
              <button role="radio" aria-checked={h.schedule.kind === 'moon'} className={h.schedule.kind === 'moon' ? 'on' : ''} onClick={() => setSched({ kind: 'moon' })}>By the Moon</button>
            </div>
            {h.schedule.kind === 'weekdays' && (
              <div className="daychips">
                {WEEKDAYS.map((d, i) => (
                  <button key={d} className={h.schedule.days.includes(i) ? 'daychip on' : 'daychip'} aria-pressed={h.schedule.days.includes(i)}
                    onClick={() => setSched({ days: toggle(h.schedule.days, i).sort() })}>{d}</button>
                ))}
              </div>
            )}
            {h.schedule.kind === 'moon' && (
              <div className="daychips">
                {(Object.keys(MOON_WHEN_LABEL) as MoonWhen[]).map((w) => (
                  <button key={w} className={h.schedule.moon.includes(w) ? 'daychip wide on' : 'daychip wide'} aria-pressed={h.schedule.moon.includes(w)}
                    onClick={() => setSched({ moon: toggle(h.schedule.moon, w) })}>{MOON_WHEN_LABEL[w]}</button>
                ))}
              </div>
            )}
          </>
        )}

        <label className="check" htmlFor="habit-workout">
          <input id="habit-workout" type="checkbox" checked={!!h.workout} onChange={(e) => set({ workout: e.target.checked })} />
          <span>This is a workout, show it on the Workouts tab</span>
        </label>

        <label className="lbl" htmlFor="habit-folder">Drop-down on Today (optional)</label>
        <input id="habit-folder" className="field" list="habit-folders" placeholder="Home care" value={h.folder ?? ''} onChange={(e) => set({ folder: e.target.value || null })} />
        <datalist id="habit-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        <p className="muted small">Habits with the same drop-down name fold together on Today until you open them.</p>

        <label className="lbl" htmlFor="habit-steps">Steps inside it (optional, one per line)</label>
        <textarea id="habit-steps" className="field" rows={4} placeholder={'Dynamic warm up\nSquat and press'} value={(h.steps ?? []).join('\n')}
          onChange={(e) => set({ steps: e.target.value.split('\n') })} />
        {(h.steps ?? []).filter((x) => x.trim()).length > 0 && (
          <label className="check" htmlFor="habit-weight">
            <input id="habit-weight" type="checkbox" checked={!!h.trackWeight} onChange={(e) => set({ trackWeight: e.target.checked })} />
            <span>Track the weight I lift for each step</span>
          </label>
        )}

        <label className="lbl" htmlFor="habit-note">Notes (optional)</label>
        <textarea id="habit-note" className="field" rows={4} placeholder="Recipes, a meal plan, anything you want close by" value={h.note ?? ''} onChange={(e) => set({ note: e.target.value })} />

        <span className="lbl">Symbol</span>
        <div className="icon-pick">
          {HABIT_ICONS.map((i) => (
            <button key={i} className={h.icon === i ? 'icon-opt on' : 'icon-opt'} aria-label={i} aria-pressed={h.icon === i} onClick={() => set({ icon: i })}>
              <HabitGlyph icon={i} />
            </button>
          ))}
        </div>
        <span className="lbl">Color</span>
        <div className="icon-pick">
          {HABIT_COLORS.map((c) => (
            <button key={c} className={h.color === c ? 'swatch on' : 'swatch'} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={h.color === c} onClick={() => set({ color: c })} />
          ))}
        </div>

        <button className="pill solid" onClick={() => save()}>{isNew ? 'Add habit' : 'Save'}</button>

        {!isNew && (
          <div className="row editor-extra">
            <button className="pill" onClick={() => save(paused ? resumeNow(h, today) : pauseNow(h, today))}>
              {paused ? 'Resume' : 'Pause for now'}
            </button>
            <button className="pill" onClick={() => save({ ...h, archived: !h.archived })}>{h.archived ? 'Bring back' : 'Archive'}</button>
            <ConfirmButton label="Delete" confirmLabel="Delete it and its history"
              onConfirm={async () => {
                await db.habits.delete(h.id)
                await db.logs.where('habitId').equals(h.id).delete()
                onClose()
              }} />
          </div>
        )}
        {!isNew && <p className="muted small">Pausing keeps your streak safe while you travel or rest. Archiving tucks it away with its history.</p>}
      </div>
    </Sheet>
  )
}
