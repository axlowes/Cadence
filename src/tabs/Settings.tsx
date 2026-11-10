import { useState } from 'react'
import type { Place } from '../lib/sky'
import type { Profile } from '../lib/useProfile'
import { BackupCard } from '../components/BackupCard'
import { CalendarCard } from '../components/Calendar'

interface Props {
  place: Place
  placeKnown: boolean
  profile: Profile
  onUpdate: (patch: Partial<Profile>) => void
  onEditBirth: () => void
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

function fmtBirth(p: Profile) {
  const b = p.birth
  if (!b) return 'Not set yet'
  const [y, m, d] = b.date.split('-').map(Number)
  const date = new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  let time = 'time unknown'
  if (b.time) {
    const [hh, mm] = b.time.split(':').map(Number)
    time = new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return `${date}, ${time}, ${b.place.name}`
}

export function Settings(props: Props) {
  const { place, placeKnown, profile, onUpdate, onEditBirth, onLocate, onPreview, onChangePasscode, onClose } = props
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
        <h2 className="serif">Your birth details</h2>
        <p>{fmtBirth(profile)}</p>
        <button className="pill" onClick={onEditBirth}>{profile.birth ? 'Change birth details' : 'Add birth details'}</button>
      </section>

      <section className="glass card">
        <h2 className="serif">Houses</h2>
        <div className="segmented" role="radiogroup" aria-label="House system">
          <button role="radio" aria-checked={profile.houseSystem === 'whole'} className={profile.houseSystem === 'whole' ? 'on' : ''} onClick={() => onUpdate({ houseSystem: 'whole' })}>Whole Sign</button>
          <button role="radio" aria-checked={profile.houseSystem === 'placidus'} className={profile.houseSystem === 'placidus' ? 'on' : ''} onClick={() => onUpdate({ houseSystem: 'placidus' })}>Placidus</button>
        </div>
      </section>

      <section className="glass card">
        <h2 className="serif">Void of course</h2>
        <p className="muted small">Which planets the Moon's last aspect can be to before she goes quiet.</p>
        <div className="segmented" role="radiogroup" aria-label="Void of course planets">
          <button role="radio" aria-checked={profile.vocMode === 'modern'} className={profile.vocMode === 'modern' ? 'on' : ''} onClick={() => onUpdate({ vocMode: 'modern' })}>Sun to Pluto</button>
          <button role="radio" aria-checked={profile.vocMode === 'traditional'} className={profile.vocMode === 'traditional' ? 'on' : ''} onClick={() => onUpdate({ vocMode: 'traditional' })}>Sun to Saturn</button>
        </div>
      </section>

      <section className="glass card">
        <h2 className="serif">Your sky</h2>
        <p className="muted">
          {placeKnown
            ? `Following the Sun at ${place.label && place.label !== 'where you are' ? place.label : `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`}.`
            : 'Following a guess from your time zone.'}
        </p>
        <button className="pill" onClick={onLocate}>{placeKnown ? 'Update my location' : 'Use my location'}</button>
      </section>

      <section className="glass card">
        <h2 className="serif">Watch a whole day pass</h2>
        <p className="muted">Slide to see how today's sky moves from night to dawn, day and dusk.</p>
        <input
          id="sky-scrub"
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
            <button className="link" onClick={() => { setMinutes(null); onPreview(null) }}>Back to now</button>
          )}
        </div>
      </section>

      <CalendarCard />
      <BackupCard />

      <section className="glass card">
        <h2 className="serif">Passcode</h2>
        <button className="pill" onClick={onChangePasscode}>Change passcode</button>
      </section>
    </div>
  )
}
