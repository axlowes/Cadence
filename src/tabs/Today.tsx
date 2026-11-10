import { MoonDrawing } from '../components/MoonDrawing'
import { GearIcon } from '../components/Icons'
import { TransitList } from '../components/TransitList'
import type { MoonInfo } from '../lib/useMoon'
import type { Natal } from '../lib/natal'
import { fmtTime } from '../lib/useProfile'
import { FeelingsCard } from '../components/Faces'
import { TodayCalendar } from '../components/Calendar'
import { TodayHabits, useHabitsHint } from '../components/TodayHabits'
import { Fold } from '../components/Fold'
import { CycleToday, cycleHint, useCycle } from '../components/Cycle'
import { TaskRow } from '../components/TaskRow'
import { TaskEditor } from '../components/TaskEditor'
import { QuickAdd, todayTasks, useTasks } from './Tasks'
import { useBackupNudge } from '../components/BackupCard'
import { dateKey } from '../lib/dates'
import { useState } from 'react'
import type { Task } from '../lib/db'

interface Props {
  now: Date
  info: MoonInfo
  natal: Natal | null
  placeKnown: boolean
  onLocate: () => void
  onOpenMoon: () => void
  onOpenSettings: () => void
  onOpenHabits: () => void
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function Today({ now, info, natal, placeKnown, onLocate, onOpenMoon, onOpenSettings, onOpenHabits }: Props) {
  const today = dateKey(now)
  const tasks = todayTasks(useTasks(), today)
  const [open, setOpen] = useState<Task | null>(null)
  const nudge = useBackupNudge()
  const { moon, voc } = info
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const sameDay = voc.end.toDateString() === now.toDateString()
  const cycle = useCycle()
  const habitsHint = useHabitsHint(today)
  const n = info.transits.length
  const chartHint = !natal ? 'Add your birth details in Settings' : n ? `${n} Moon ${n === 1 ? 'aspect' : 'aspects'} to your chart today` : 'A quiet day in your chart'
  return (
    <div className="screen">
      <header className="glass sky-header">
        <button className="gear" onClick={onOpenSettings} aria-label="Settings">
          <GearIcon />
        </button>
        <button className="sky-header-tap" onClick={onOpenMoon}>
          <MoonDrawing angle={moon.angle} size={84} />
          <div>
            <p className="date-old">{date}</p>
            <h1 className="serif">
              {moon.phaseName} in {moon.sign}, {Math.round(moon.illumination * 100)}%
            </h1>
          </div>
        </button>
      </header>

      {voc.isVoid && (
        <section className="glass card void-banner" role="status">
          <p>
            Moon void until {sameDay ? fmtTime(voc.end) : voc.end.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}, then enters {voc.nextSign}.
          </p>
        </section>
      )}

      <Fold id="chart" title="Moon in your chart" hint={chartHint}>
        {!natal && <p className="muted">Add your birth details in Settings and today's transits will be read here.</p>}
        {info.house && <p>{info.house.text}</p>}
        {natal && info.transits.length > 0 && <TransitList transits={info.transits} now={now} limit={2} />}
        {natal && info.transits.length === 0 && (
          <p className="muted">The Moon makes no exact aspects to your chart today, a quiet day to simply feel.</p>
        )}
      </Fold>

      <FeelingsCard now={now} info={info} />
      <Fold id="cycle" title="Your cycle" hint={cycleHint(cycle, today)}>
        <CycleToday today={today} />
      </Fold>
      <TodayCalendar now={now} />
      <Fold id="habits" title="Today's habits" hint={habitsHint}>
        <TodayHabits today={today} onOpenHabits={onOpenHabits} />
      </Fold>

      <Fold id="tasks" title="Today's tasks" hint={tasks.length ? `${tasks.length} due today` : 'Nothing due today'}>
        <QuickAdd due={today} />
        {tasks.length > 0 ? (
          <ul className="tasks">
            {tasks.map((t) => <TaskRow key={t.id} t={t} today={today} waxing={info.moon.angle < 180} onOpen={() => setOpen(t)} />)}
          </ul>
        ) : (
          <p className="muted">Nothing due today.</p>
        )}
      </Fold>

      {nudge && (
        <section className="glass card">
          <h2 className="serif">A gentle reminder</h2>
          <p>It's been a while since your last backup. Settings has an Export button whenever you have a moment.</p>
          <button className="pill" onClick={onOpenSettings}>Open Settings</button>
        </section>
      )}

      {open && <TaskEditor task={open} isNew={false} onClose={() => setOpen(null)} />}
      {!isStandalone() && (
        <section className="glass card">
          <h2 className="serif">Keep me on your Home Screen</h2>
          <p>In Safari, tap Share, then Add to Home Screen. I'll open full screen and work without signal.</p>
        </section>
      )}

      {!placeKnown && (
        <section className="glass card">
          <h2 className="serif">Let the sky follow you</h2>
          <p>The colors behind you are a guess from your time zone. Share your location and they'll rise and set with your real Sun.</p>
          <button className="pill" onClick={onLocate}>Use my location</button>
        </section>
      )}

    </div>
  )
}
