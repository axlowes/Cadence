import { MoonDrawing } from '../components/MoonDrawing'
import { GearIcon } from '../components/Icons'
import { moonAt } from '../lib/moon'

interface Props {
  now: Date
  placeKnown: boolean
  onLocate: () => void
  onOpenMoon: () => void
  onOpenSettings: () => void
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function Today({ now, placeKnown, onLocate, onOpenMoon, onOpenSettings }: Props) {
  const moon = moonAt(now)
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div className="screen">
      <header className="glass sky-header">
        <button className="gear" onClick={onOpenSettings} aria-label="Settings">
          <GearIcon />
        </button>
        <button className="sky-header-tap" onClick={onOpenMoon}>
          <MoonDrawing angle={moon.angle} size={84} />
          <div>
            <p className="eyebrow">{date}</p>
            <h1 className="serif">
              {moon.phaseName} in {moon.sign}, {Math.round(moon.illumination * 100)}%
            </h1>
          </div>
        </button>
      </header>

      {!isStandalone() && (
        <section className="glass card">
          <h2 className="serif">Keep me on your Home Screen</h2>
          <p>
            In Safari, tap the Share button at the bottom of the screen, then Add to Home Screen. I will
            open full screen, work without signal, and be able to send your 1pm check-in.
          </p>
        </section>
      )}

      {!placeKnown && (
        <section className="glass card">
          <h2 className="serif">Let the sky follow you</h2>
          <p>
            The colors behind you are a guess from your time zone right now. Share your location once and
            they will rise and set with your real Sun.
          </p>
          <button className="pill" onClick={onLocate}>Use my location</button>
        </section>
      )}

      <section className="glass card soon">
        <h2 className="serif">Moon in your chart</h2>
        <p className="muted">Once you share your birth details, today's transits will be read here.</p>
      </section>
      <section className="glass card soon">
        <h2 className="serif">How are you feeling?</h2>
        <p className="muted">Ten little faces are on their way.</p>
      </section>
      <section className="glass card soon">
        <h2 className="serif">Today's habits and tasks</h2>
        <p className="muted">Your rituals and to-dos will gather here.</p>
      </section>
    </div>
  )
}
