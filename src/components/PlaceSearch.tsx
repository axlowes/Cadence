import { useState } from 'react'
import type { BirthPlace } from '../lib/natal'

interface Result {
  id: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
  timezone: string
}

const zones = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone')
  } catch {
    return ['America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'UTC']
  }
})()

export function PlaceSearch({ value, onPick, idPrefix }: { value: BirthPlace | null; onPick: (p: BirthPlace) => void; idPrefix: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false)
  const [m, setM] = useState({ name: '', lat: '', lon: '', tz: Intl.DateTimeFormat().resolvedOptions().timeZone })

  async function search() {
    if (!q.trim()) return
    setBusy(true)
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      setManual(true)
    } finally {
      setBusy(false)
    }
  }

  const label = (r: Result) => [r.name, r.admin1, r.country].filter(Boolean).join(', ')

  return (
    <div className="stack">
      {value && (
        <p className="picked">
          Chosen: <strong>{value.name}</strong>
        </p>
      )}
      {!manual && (
        <>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              search()
            }}
          >
            <input
              id={`${idPrefix}-q`}
              className="field"
              placeholder="Type a town or city"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            <button className="pill solid" disabled={busy}>
              {busy ? 'Looking' : 'Search'}
            </button>
          </form>
          {results && results.length === 0 && <p className="muted">Nothing found by that name. Try the nearest bigger town.</p>}
          {results && results.length > 0 && (
            <div className="choices">
              {results.map((r) => (
                <button
                  key={r.id}
                  className={value?.name === label(r) ? 'choice on' : 'choice'}
                  onClick={() => onPick({ name: label(r), lat: r.latitude, lon: r.longitude, tz: r.timezone })}
                >
                  {label(r)}
                </button>
              ))}
            </div>
          )}
          <button className="link" onClick={() => setManual(true)}>Enter coordinates instead</button>
        </>
      )}
      {manual && (
        <div className="stack">
          <p className="muted">
            I couldn't reach the town finder, which happens without signal and inside the preview. You can type the
            place in by hand: search the town on a map app to find its latitude and longitude.
          </p>
          <label className="lbl" htmlFor={`${idPrefix}-name`}>Place name</label>
          <input id={`${idPrefix}-name`} className="field" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Toronto, Ontario" />
          <div className="row">
            <div className="grow">
              <label className="lbl" htmlFor={`${idPrefix}-lat`}>Latitude</label>
              <input id={`${idPrefix}-lat`} className="field" inputMode="decimal" value={m.lat} onChange={(e) => setM({ ...m, lat: e.target.value })} placeholder="43.65" />
            </div>
            <div className="grow">
              <label className="lbl" htmlFor={`${idPrefix}-lon`}>Longitude</label>
              <input id={`${idPrefix}-lon`} className="field" inputMode="decimal" value={m.lon} onChange={(e) => setM({ ...m, lon: e.target.value })} placeholder="-79.38" />
            </div>
          </div>
          <label className="lbl" htmlFor={`${idPrefix}-tz`}>Time zone</label>
          <select id={`${idPrefix}-tz`} className="field" value={m.tz} onChange={(e) => setM({ ...m, tz: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <p className="muted small">West longitudes are negative, so anywhere in Canada or the US starts with a minus sign.</p>
          <div className="row">
            <button
              className="pill solid"
              disabled={!m.name || isNaN(parseFloat(m.lat)) || isNaN(parseFloat(m.lon))}
              onClick={() => onPick({ name: m.name, lat: parseFloat(m.lat), lon: parseFloat(m.lon), tz: m.tz })}
            >
              Use this place
            </button>
            <button className="link" onClick={() => setManual(false)}>Search again</button>
          </div>
        </div>
      )}
    </div>
  )
}
