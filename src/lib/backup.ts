import { db, setSetting } from './db'

export interface BackupFile {
  app: 'cadence'
  version: 1
  exportedAt: string
  data: { settings: unknown[]; habits: unknown[]; logs: unknown[]; tasks: unknown[]; lifts?: unknown[]; feelings?: unknown[]; events?: unknown[]; cycle?: unknown[] }
}

export async function makeBackup(): Promise<Blob> {
  const [settings, habits, logs, tasks, lifts, feelings, events, cycle] = await Promise.all([
    db.settings.toArray(), db.habits.toArray(), db.logs.toArray(), db.tasks.toArray(), db.lifts.toArray(),
    db.feelings.toArray(), db.events.toArray(), db.cycle.toArray(),
  ])
  const file: BackupFile = { app: 'cadence', version: 1, exportedAt: new Date().toISOString(), data: { settings, habits, logs, tasks, lifts, feelings, events, cycle } }
  return new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' })
}

/** Hands the backup to the share sheet (Files, AirDrop) where possible, otherwise downloads it. */
export async function exportBackup() {
  const blob = await makeBackup()
  const name = `cadence-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([blob], name, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  let shared = false
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cadence backup' })
      shared = true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
    }
  }
  if (!shared) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  await setSetting('lastBackup', Date.now())
  return true
}

export async function readBackup(file: File): Promise<BackupFile> {
  const parsed = JSON.parse(await file.text())
  if (parsed?.app !== 'cadence' || !parsed.data) throw new Error('This file is not a Cadence backup.')
  return parsed as BackupFile
}

export async function restoreBackup(b: BackupFile) {
  await db.transaction('rw', [db.settings, db.habits, db.logs, db.tasks, db.lifts, db.feelings, db.events, db.cycle], async () => {
    await Promise.all([db.settings.clear(), db.habits.clear(), db.logs.clear(), db.tasks.clear(), db.lifts.clear(), db.feelings.clear(), db.events.clear(), db.cycle.clear()])
    await db.cycle.bulkPut((b.data.cycle ?? []) as never[])
    await db.feelings.bulkPut((b.data.feelings ?? []) as never[])
    await db.events.bulkPut((b.data.events ?? []) as never[])
    await db.lifts.bulkPut((b.data.lifts ?? []) as never[])
    await db.settings.bulkPut(b.data.settings as never[])
    await db.habits.bulkPut(b.data.habits as never[])
    await db.logs.bulkPut(b.data.logs as never[])
    await db.tasks.bulkPut(b.data.tasks as never[])
  })
}
