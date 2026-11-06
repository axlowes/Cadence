import { useEffect, useState } from 'react'
import { getSetting, setSetting } from './db'
import { guessPlace, skyAt, type Place } from './sky'

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    const wake = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [intervalMs])
  return now
}

export function usePlace() {
  const [place, setPlaceState] = useState<Place | null>(null)
  const [known, setKnown] = useState(false)
  useEffect(() => {
    getSetting<Place>('place').then((p) => {
      setPlaceState(p ?? guessPlace())
      setKnown(!!p)
    })
  }, [])
  const setPlace = async (p: Place) => {
    await setSetting('place', p)
    setPlaceState(p)
    setKnown(true)
  }
  return { place: place ?? guessPlace(), known, setPlace }
}

export function useSkyState(place: Place, now: Date, override: Date | null) {
  return skyAt(override ?? now, place)
}

export function locateMe(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
          label: 'where you are',
        }),
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * 3600_000 },
    )
  })
}
