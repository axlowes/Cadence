import { applyStarter } from '../lib/seed'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../lib/db'
import { exportBackup, readBackup, restoreBackup, type BackupFile } from '../lib/backup'

export function BackupCard() {
  const last = useLiveQuery(() => db.settings.get('lastBackup').then((r) => r?.value as number | undefined), [])
  const weekStart = useLiveQuery(() => db.settings.get('weekStart').then((r) => (r?.value as 0 | 1 | undefined) ?? 0), []) ?? 0
  const liftUnit = useLiveQuery(() => db.settings.get('liftUnit').then((r) => (r?.value as 'lb' | 'kg' | undefined) ?? 'lb'), []) ?? 'lb'
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [msg, setMsg] = useState('')

  const stale = !last || Date.now() - last > 30 * 86400_000
  return (
    <>
      <section className="glass card">
        <h2 className="serif">Weeks begin on</h2>
        <div className="segmented" role="radiogroup" aria-label="First day of the week">
          <button role="radio" aria-checked={weekStart === 0} className={weekStart === 0 ? 'on' : ''} onClick={() => setSetting('weekStart', 0)}>Sunday</button>
          <button role="radio" aria-checked={weekStart === 1} className={weekStart === 1 ? 'on' : ''} onClick={() => setSetting('weekStart', 1)}>Monday</button>
        </div>
      </section>

      <section className="glass card">
        <h2 className="serif">Lifting weights in</h2>
        <div className="segmented" role="radiogroup" aria-label="Weight unit">
          <button role="radio" aria-checked={liftUnit === 'lb'} className={liftUnit === 'lb' ? 'on' : ''} onClick={() => setSetting('liftUnit', 'lb')}>Pounds</button>
          <button role="radio" aria-checked={liftUnit === 'kg'} className={liftUnit === 'kg' ? 'on' : ''} onClick={() => setSetting('liftUnit', 'kg')}>Kilograms</button>
        </div>
      </section>

      <section className="glass card stack">
        <h2 className="serif">Backup</h2>
        <p className="muted small">
          {last ? `Last backup: ${new Date(last).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.` : 'No backup yet.'}
          {stale ? ' Everything lives only on this phone, so a fresh copy keeps it safe.' : ''}
        </p>
        <button className="pill solid" onClick={async () => { const ok = await exportBackup(); if (ok) setMsg('Backup made. Save it to Files or AirDrop it somewhere safe.') }}>
          Export everything
        </button>
        <label className="pill file-pill" htmlFor="import-file">Import a backup</label>
        <input id="import-file" type="file" accept="application/json,.json" className="visually-hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const added = await applyStarter(f).catch(() => null)
              if (added !== null) { setMsg(`Your starter list is in, ${added} habits added.`); return }
              setPending(await readBackup(f)); setMsg('')
            } catch (err) { setMsg((err as Error).message || 'That file could not be read.') }
          }} />
        {pending && (
          <div className="stack confirm-box">
            <p>
              Restore the backup from {new Date(pending.exportedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}? It
              holds {pending.data.habits.length} habits and {pending.data.tasks.length} tasks, and it replaces everything in Cadence now.
            </p>
            <div className="row">
              <button className="pill danger" onClick={async () => { await restoreBackup(pending); setPending(null); setMsg('Restored. Your passcode is the one from the backup.') }}>Replace and restore</button>
              <button className="pill" onClick={() => setPending(null)}>Keep what I have</button>
            </div>
          </div>
        )}
        {msg && <p className="small" role="status">{msg}</p>}
      </section>
    </>
  )
}

export function useBackupNudge() {
  // Since the last backup, or since the oldest habit or task when there has never been one.
  const since = useLiveQuery(async () => {
    const last = (await db.settings.get('lastBackup'))?.value as number | undefined
    if (last) return last
    const habits = await db.habits.toArray()
    const tasks = await db.tasks.toArray()
    const times = [
      ...habits.map((h) => new Date(h.createdAt + 'T12:00').getTime()),
      ...tasks.map((t) => t.createdAt),
    ]
    return times.length ? Math.min(...times) : null
  }, [])
  return !!since && Date.now() - since > 30 * 86400_000
}
