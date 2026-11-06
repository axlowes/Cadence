import { useEffect, useRef, useState } from 'react'
import { SkyBackground } from './components/SkyBackground'
import { Passcode } from './components/Passcode'
import { TodayIcon, CandleIcon, QuillIcon, MoonIcon, CrystalIcon } from './components/Icons'
import { Today } from './tabs/Today'
import { Placeholder } from './tabs/Placeholder'
import { Settings } from './tabs/Settings'
import { hasPasscode } from './lib/passcode'
import { requestPersistence } from './lib/db'
import { inkColor, glassCss } from './lib/sky'
import { locateMe, useNow, usePlace, useSkyState } from './lib/useSky'

type Tab = 'today' | 'habits' | 'tasks' | 'moon' | 'insights'
type Gate = 'loading' | 'create' | 'locked' | 'open'

const TABS: { id: Tab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: 'today', label: 'Today', Icon: TodayIcon },
  { id: 'habits', label: 'Habits', Icon: CandleIcon },
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

  useEffect(() => {
    requestPersistence()
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
  } else if (gate === 'open' && settingsOpen) {
    body = (
      <Settings
        place={place}
        placeKnown={known}
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
        <main className="content">
          {tab === 'today' && (
            <Today
              now={now}
              placeKnown={known}
              onLocate={locate}
              onOpenMoon={() => setTab('moon')}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {tab === 'habits' && (
            <Placeholder
              title="Habits"
              line="Your rituals will live here, the small daily ones that keep your candle lit, with their streaks drawn in dots."
            />
          )}
          {tab === 'tasks' && (
            <Placeholder title="Tasks" line="A quick place to set things down, a few words and a tap, so your mind can rest." />
          )}
          {tab === 'moon' && (
            <Placeholder
              title="Moon"
              line="Soon this page will hold the Moon's sign, her void hours, and how she moves through your own chart."
            />
          )}
          {tab === 'insights' && (
            <Placeholder
              title="Insights"
              line="As you check in, your feelings and the Moon will start to speak to each other here."
            />
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
