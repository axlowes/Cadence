import Dexie, { type EntityTable } from 'dexie'

export interface Setting {
  key: string
  value: unknown
}

class SkyDB extends Dexie {
  settings!: EntityTable<Setting, 'key'>
  constructor() {
    super('cadence')
    this.version(1).stores({ settings: 'key' })
  }
}

export const db = new SkyDB()

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* not supported */
  }
}
