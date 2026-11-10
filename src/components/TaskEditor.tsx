import { useState } from 'react'
import { Sheet, ConfirmButton } from './Sheet'
import { db, type Task } from '../lib/db'
import { REPEAT_LABEL } from '../lib/tasks'

export function TaskEditor({ task, isNew, onClose }: { task: Task; isNew: boolean; onClose: () => void }) {
  const [t, setT] = useState(task)
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }))
  const save = async () => {
    await db.tasks.put({ ...t, title: t.title.trim() || 'Untitled', time: t.due ? t.time : null })
    onClose()
  }
  return (
    <Sheet title={isNew ? 'New task' : 'Edit task'} onClose={onClose}>
      <div className="stack">
        <label className="lbl" htmlFor="task-title">Task</label>
        <input id="task-title" className="field" value={t.title} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew} />
        <div className="row">
          <div className="grow">
            <label className="lbl" htmlFor="task-due">Day</label>
            <input id="task-due" className="field" type="date" value={t.due ?? ''} onChange={(e) => set({ due: e.target.value || null })} />
          </div>
          <div className="grow">
            <label className="lbl" htmlFor="task-time">Time</label>
            <input id="task-time" className="field" type="time" value={t.time ?? ''} disabled={!t.due} onChange={(e) => set({ time: e.target.value || null })} />
          </div>
        </div>
        {t.due && <button className="link" onClick={() => set({ due: null, time: null })}>Move to Someday (no date)</button>}

        <span className="lbl">Importance</span>
        <div className="segmented three" role="radiogroup" aria-label="Importance">
          {(['none', 'low', 'high'] as const).map((p) => (
            <button key={p} role="radio" aria-checked={t.priority === p} className={t.priority === p ? 'on' : ''} onClick={() => set({ priority: p })}>
              {p === 'none' ? 'None' : p === 'low' ? 'Low' : 'High'}
            </button>
          ))}
        </div>

        <label className="lbl" htmlFor="task-repeat">Repeat</label>
        <select id="task-repeat" className="field" value={t.repeat} onChange={(e) => set({ repeat: e.target.value as Task['repeat'] })}>
          {(Object.keys(REPEAT_LABEL) as Task['repeat'][]).map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
        </select>

        <span className="lbl">Moon tag</span>
        <div className="segmented four" role="radiogroup" aria-label="Moon tag">
          {([null, 'begin', 'release', 'clear'] as Task['tag'][]).map((g) => (
            <button key={String(g)} role="radio" aria-checked={t.tag === g} className={t.tag === g ? 'on' : ''} onClick={() => set({ tag: g })}>
              {g === null ? 'None' : g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        <p className="muted small">Begin tasks get a little crescent while the Moon is waxing, release and clear tasks while she wanes.</p>

        <label className="lbl" htmlFor="task-note">Note</label>
        <textarea id="task-note" className="field" rows={3} value={t.note} onChange={(e) => set({ note: e.target.value })} />

        <button className="pill solid" onClick={save}>{isNew ? 'Add task' : 'Save'}</button>
        {!isNew && (
          <ConfirmButton label="Delete" confirmLabel="Delete this task" onConfirm={async () => { await db.tasks.delete(t.id); onClose() }} />
        )}
      </div>
    </Sheet>
  )
}
