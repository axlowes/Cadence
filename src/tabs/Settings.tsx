import { useState } from 'react'
import type { Place } from '../lib/sky'

interface Props {
  place: Place
  placeKnown: boolean
  onLocate: () => void
  onPreview: (d: Date | null) => void
  onChangePasscode: () => void
  onClose: () => void
}

const fmt = (m: number) => {
  const d = new Date()
  d.setHours(0, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function Settings({ place, placeKnown, onLocate, onPreview, onChangePasscode, onClose }: Props) {
  const [minutes, setMinutes] = useState<number | null>(null)

  const scrub = (m: number) => {
    setMinutes(m)
    const d = new Date()
    d.setHours(0, m, 0, 0)
    onPreview(d)
  }
  const close = () => {
    onPreview(null)
    onClose()
  }

  return (
    <div className="screen">
      <header className="glass card row-between">
        <h1 className="serif">Settings</h1>
        <button className="pill" onClick={close}>Done</button>
      </header>

      <section className="glass card">
        <h2 className="serif">Your sky</h2>
        <p className="muted">
          {placeKnown
            ? `Following the Sun at ${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}.`
            : 'Following a guess from your time zone.'}
        </p>
        <button className="pill" onClick={onLocate}>{placeKnown ? 'Update my location' : 'Use my location'}</button>
      </section>

      <section className="glass card">
        <h2 className="serif">Watch a whole day pass</h2>
        <p className="muted">Slide to see how today's sky moves from night to dawn, day and dusk.</p>
        <input
          type="range"
          min={0}
          max={1439}
          step={1}
          value={minutes ?? new Date().getHours() * 60 + new Date().getMinutes()}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label="Time of day"
          className="slider"
        />
        <div className="row-between">
          <span>{minutes === null ? 'Now' : fmt(minutes)}</span>
          {minutes !== null && (
            <button
              className="link"
              onClick={() => {
                setMinutes(null)
                onPreview(null)
              }}
            >
              Back to now
            </button>
          )}
        </div>
      </section>

      <section className="glass card">
        <h2 className="serif">Passcode</h2>
        <button className="pill" onClick={onChangePasscode}>Change passcode</button>
      </section>
    </div>
  )
}
