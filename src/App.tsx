import { useEffect, useRef, useState } from 'react'
import { SkyBackground } from './components/SkyBackground'
import { Passcode } from './components/Passcode'
import { TodayIcon, CandleIcon, QuillIcon, MoonIcon, CrystalIcon, WeightIcon, CalendarIcon } from './components/Icons'
import { CalendarTab } from './tabs/CalendarTab'
import { WorkoutsTab } from './tabs/Workouts'
import { FeelingHistory } from './components/Faces'
import { Today } from './tabs/Today'
import { Settings } from './tabs/Settings'
import { MoonTab } from './tabs/Moon'
import { HabitsTab } from './tabs/Habits'
import { TasksTab } from './tabs/Tasks'
import { dateKey } from './lib/dates'
import { applySeedOnce } from './lib/seed'
import { Setup } from './components/Setup'
import { useProfile } from './lib/useProfile'
import { useMoon } from './lib/useMoon'
import { hasPasscode } from './lib/passcode'
import { requestPersistence } from './lib/db'
import { inkColor, glassCss } from './lib/sky'
import { locateMe, useNow, usePlace, useSkyState } from './lib/useSky'

type Tab = 'today' | 'calendar' | 'habits' | 'workouts' | 'tasks' | 'moon' | 'insights'
type Gate = 'loading' | 'create' | 'locked' | 'open'

const TABS: { id: Tab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: 'today', label: 'Today', Icon: TodayIcon },
  { id: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { id: 'habits', label: 'Habits', Icon: CandleIcon },
  { id: 'workouts', label: 'Workouts', Icon: WeightIcon },
  { id: 'tasks', label: 'Tasks', Icon: QuillIcon },
  { id: 'moon', label: 'Moon', Icon: MoonIcon },
  { id: 'insights', label: 'Insights', Icon: CrystalIcon },
]

const RELOCK_AFTER_MS = 5 * 60_000

export default function App() {
  const [gate, setGate] = useState<Gate>('loading')
  const [tab, setTab] = useState<Tab>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preview, setPreview] = useState<Date | null>(null)
  const now = useNow()
  const { place, known, setPlace } = usePlace()
  const sky = useSkyState(place, now, preview)
  const hiddenAt = useRef<number | null>(null)
  const { profile, update, natal } = useProfile()
  const info = useMoon(now, natal, profile?.vocMode ?? 'modern')
  const [editingBirth, setEditingBirth] = useState(false)

  useEffect(() => {
    requestPersistence()
    applySeedOnce().catch(() => {})
    hasPasscode()
      .then((has) => setGate(has ? 'locked' : 'create'))
      .catch(() => setGate('create'))
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setGate((g) => (g === 'open' ? 'locked' : g))
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--ink', inkColor(sky.ink))
    root.style.setProperty('--glass', glassCss(sky.ink))
    root.style.setProperty('--glass-strong', glassCss(sky.ink, true))
    root.style.setProperty('--sheet', sky.ink === 'light' ? '#18122e' : '#fbf7f0')
    root.dataset.ink = sky.ink
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sky.stops[0])
  }, [sky.ink, sky.stops])

  const locate = async () => {
    try {
      setPlace(await locateMe())
    } catch {
      alert('Location was not shared. You can try again any time from Settings.')
    }
  }

  let body: React.ReactNode = null
  if (gate === 'create' || gate === 'locked') {
    body = <Passcode creating={gate === 'create'} onDone={() => setGate('open')} />
  } else if (gate === 'open' && profile && (!profile.setupDone || editingBirth)) {
    body = (
      <div className="content">
        <Setup
          initial={{ birth: profile.birth, houseSystem: profile.houseSystem }}
          startAt={editingBirth ? 1 : 0}
          onPlace={(p) => setPlace(p)}
          onCancel={editingBirth ? () => setEditingBirth(false) : undefined}
          onDone={(birth, houseSystem) => {
            update({ birth, houseSystem, setupDone: true })
            applySeedOnce().catch(() => {})
            setEditingBirth(false)
            setTab('today')
          }}
        />
      </div>
    )
  } else if (gate === 'open' && settingsOpen && profile) {
    body = (
      <Settings
        place={place}
        placeKnown={known}
        profile={profile}
        onUpdate={update}
        onEditBirth={() => {
          setSettingsOpen(false)
          setEditingBirth(true)
        }}
        onLocate={locate}
        onPreview={setPreview}
        onChangePasscode={() => {
          setSettingsOpen(false)
          setGate('create')
        }}
        onClose={() => setSettingsOpen(false)}
      />
    )
  } else if (gate === 'open') {
    body = (
      <>
        <main className="content" key={tab}>
          {tab === 'today' && (
            <Today
              now={now}
              info={info}
              natal={natal}
              placeKnown={known}
              onLocate={locate}
              onOpenMoon={() => setTab('moon')}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenHabits={() => setTab('habits')}
            />
          )}
          {tab === 'habits' && <HabitsTab today={dateKey(now)} />}
          {tab === 'tasks' && <TasksTab today={dateKey(now)} waxing={info.moon.angle < 180} />}
          {tab === 'moon' && <MoonTab now={now} info={info} natal={natal} />}
          {tab === 'calendar' && <CalendarTab today={dateKey(now)} onOpenSettings={() => setSettingsOpen(true)} />}
          {tab === 'workouts' && <WorkoutsTab today={dateKey(now)} />}
          {tab === 'insights' && (
            <div className="screen">
              <header className="glass card"><h1 className="serif">Insights</h1></header>
              <section className="glass card"><FeelingHistory /></section>
            </div>
          )}
        </main>
        <nav className="glass tabbar" aria-label="Sections">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={tab === id ? 'tab active' : 'tab'}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </>
    )
  }

  return (
    <>
      <SkyBackground sky={sky} />
      {body}
    </>
  )
}
