import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSetting, setSetting } from './db'
import { computeNatal, type Birth } from './natal'
import type { HouseSystem } from './astro'
import type { VocMode } from './lunar'

export interface Profile {
  birth: Birth | null
  houseSystem: HouseSystem
  vocMode: VocMode
  setupDone: boolean
}

const DEFAULTS: Profile = { birth: null, houseSystem: 'whole', vocMode: 'modern', setupDone: false }

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    Promise.all([
      getSetting<Birth>('birth'),
      getSetting<HouseSystem>('houseSystem'),
      getSetting<VocMode>('vocMode'),
      getSetting<boolean>('setupDone'),
    ])
      .then(([birth, houseSystem, vocMode, setupDone]) =>
        setProfile({
          birth: birth ?? null,
          houseSystem: houseSystem ?? 'whole',
          vocMode: vocMode ?? 'modern',
          setupDone: !!setupDone,
        }),
      )
      .catch(() => setProfile(DEFAULTS))
  }, [])

  const update = useCallback(async (patch: Partial<Profile>) => {
    setProfile((p) => ({ ...(p ?? DEFAULTS), ...patch }))
    try {
      for (const [k, v] of Object.entries(patch)) await setSetting(k, v)
    } catch {
      /* storage unavailable in a preview window */
    }
  }, [])

  const natal = useMemo(
    () => (profile?.birth ? computeNatal(profile.birth, profile.houseSystem) : null),
    [profile?.birth, profile?.houseSystem],
  )
  return { profile, update, natal }
}

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm')

export const fmtDayTime = (d: Date, now = new Date()) => {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((day.getTime() - today.getTime()) / 86400_000)
  const when =
    days === 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : days === -1
          ? 'yesterday'
          : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${when} at ${fmtTime(d)}`
}
