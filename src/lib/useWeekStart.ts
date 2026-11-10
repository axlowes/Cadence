import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

export function useWeekStart(): 0 | 1 {
  const v = useLiveQuery(() => db.settings.get('weekStart').then((r) => r?.value as 0 | 1 | undefined), [])
  return v ?? 0
}
