import { useState } from 'react'
import { PlaceSearch } from './PlaceSearch'
import { BigThree, NatalTable } from './NatalSummary'
import { computeNatal, type Birth, type BirthPlace } from '../lib/natal'
import type { HouseSystem } from '../lib/astro'
import type { Place } from '../lib/sky'
import { locateMe } from '../lib/useSky'

interface Props {
  initial: { birth: Birth | null; houseSystem: HouseSystem }
  startAt?: number
  onPlace: (p: Place) => void
  onDone: (birth: Birth, houseSystem: HouseSystem) => void
  onCancel?: () => void
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function Setup({ initial, startAt = 0, onPlace, onDone, onCancel }: Props) {
  const [step, setStep] = useState(startAt)
  const [date, setDate] = useState(initial.birth?.date ?? '')
  const [time, setTime] = useState(initial.birth?.time ?? '')
  const [unknownTime, setUnknownTime] = useState(initial.birth ? initial.birth.time === null : false)
  const [place, setPlace] = useState<BirthPlace | null>(initial.birth?.place ?? null)
  const [here, setHere] = useState<BirthPlace | null>(null)
  const [hereNote, setHereNote] = useState('')
  const [system, setSystem] = useState<HouseSystem>(initial.houseSystem)

  const birth: Birth | null = date && place ? { date, time: unknownTime || !time ? null : time, place } : null
  const LAST = 6

  const next = () => setStep((s) => Math.min(LAST, s + 1))
  const back = () => (step === startAt && onCancel ? onCancel() : setStep((s) => Math.max(0, s - 1)))

  async function useLocation() {
    try {
      const p = await locateMe()
      onPlace(p)
      setHere({ name: 'Where you are now', lat: p.lat, lon: p.lon, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
      setHereNote('')
    } catch {
      setHereNote('Location was not shared. Type your home town below instead.')
    }
  }

  const canNext =
    (step === 1 && !!date) || (step === 2 && (unknownTime || !!time)) || (step === 3 && !!place) || step === 0 || step === 4 || step === 5

  return (
    <div className="screen setup">
      <div className="progress" aria-hidden="true">
        {Array.from({ length: LAST + 1 }, (_, i) => (
          <span key={i} className={i <= step ? 'pip on' : 'pip'} />
        ))}
      </div>

      {step === 0 && (
        <section className="glass card setup-card">
          <h1 className="serif">Welcome to Cadence</h1>
          <p>
            A home for your habits, your tasks and your feelings, each one held up against the Moon as she moves
            through your own chart.
          </p>
          <p className="muted">A few questions first, one at a time. You can change every answer later in Settings.</p>
          {!isStandalone() && (
            <p className="hint">
              To keep Cadence on your Home Screen, tap Share in Safari, then Add to Home Screen.
            </p>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="glass card setup-card">
          <h1 className="serif">When were you born?</h1>
          <p className="muted">Your birth date places the Sun and every planet in your chart.</p>
          <label className="lbl" htmlFor="birth-date">Birth date</label>
          <input id="birth-date" className="field" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </section>
      )}

      {step === 2 && (
        <section className="glass card setup-card">
          <h1 className="serif">What time were you born?</h1>
          <p className="muted">
            Your birth time sets your Rising sign and your houses. A birth certificate or a parent may know it.
          </p>
          <label className="lbl" htmlFor="birth-time">Birth time</label>
          <input id="birth-time" className="field" type="time" value={time} disabled={unknownTime} onChange={(e) => setTime(e.target.value)} />
          <label className="check" htmlFor="birth-unknown">
            <input id="birth-unknown" type="checkbox" checked={unknownTime} onChange={(e) => setUnknownTime(e.target.checked)} />
            <span>I don't know it</span>
          </label>
          {unknownTime && (
            <p className="muted small">That's all right. I'll use noon and leave houses and Rising out until you know.</p>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="glass card setup-card">
          <h1 className="serif">Where were you born?</h1>
          <p className="muted">The town tells me your sky that day and the clock it kept, daylight saving included.</p>
          <PlaceSearch idPrefix="birth" value={place} onPick={setPlace} />
        </section>
      )}

      {step === 4 && (
        <section className="glass card setup-card">
          <h1 className="serif">Where are you today?</h1>
          <p className="muted">This sets your sunrise and sunset, so the sky behind Cadence matches the one outside.</p>
          <button className="pill solid" onClick={useLocation}>Use my location</button>
          {hereNote && <p className="small">{hereNote}</p>}
          {here && <p className="picked">Got it. Your sky now follows {here.name === 'Where you are now' ? 'where you are' : here.name}.</p>}
          <p className="muted small">Or type your home town:</p>
          <PlaceSearch
            idPrefix="here"
            value={here}
            onPick={(p) => {
              setHere(p)
              onPlace({ lat: p.lat, lon: p.lon, label: p.name })
            }}
          />
        </section>
      )}

      {step === 5 && (
        <section className="glass card setup-card">
          <h1 className="serif">How should I draw your houses?</h1>
          <div className="choices">
            <button className={system === 'whole' ? 'choice on' : 'choice'} onClick={() => setSystem('whole')}>
              <strong>Whole Sign</strong>
              <span className="small">Each house is one whole sign, starting from your Rising sign. Simple and ancient.</span>
            </button>
            <button className={system === 'placidus' ? 'choice on' : 'choice'} onClick={() => setSystem('placidus')}>
              <strong>Placidus</strong>
              <span className="small">Houses of different sizes, built from the time it takes each degree to rise.</span>
            </button>
          </div>
        </section>
      )}

      {step === 6 && birth && (
        <SummaryStep birth={birth} system={system} />
      )}

      <div className="setup-nav">
        {step > 0 || onCancel ? <button className="pill" onClick={back}>Back</button> : <span />}
        {step < LAST ? (
          <button className="pill solid" disabled={!canNext} onClick={next}>
            {step === 0 ? 'Begin' : step === 4 && !here ? 'Skip for now' : 'Next'}
          </button>
        ) : (
          <div className="row">
            <button className="pill" onClick={() => setStep(2)}>Fix my time</button>
            <button className="pill solid" disabled={!birth} onClick={() => birth && onDone(birth, system)}>This is me</button>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryStep({ birth, system }: { birth: Birth; system: HouseSystem }) {
  const natal = computeNatal(birth, system)
  return (
    <section className="glass card setup-card">
      <h1 className="serif">Your chart</h1>
      <p className="muted">Check these against a chart you trust. If your Rising looks off, the birth time is the usual reason.</p>
      <BigThree natal={natal} />
      <NatalTable natal={natal} />
    </section>
  )
}
