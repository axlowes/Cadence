import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../lib/db'
import { TaskRow } from '../components/TaskRow'
import { TaskEditor } from '../components/TaskEditor'
import { blankTask } from '../lib/tasks'
import { prettyDay } from '../lib/dates'

type View = 'today' | 'upcoming' | 'someday' | 'done'

export function useTasks() {
  return useLiveQuery(() => db.tasks.toArray(), []) ?? []
}

const byTime = (a: Task, b: Task) =>
  (a.due ?? '').localeCompare(b.due ?? '') ||
  (a.time ?? '99').localeCompare(b.time ?? '99') ||
  (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0) ||
  a.createdAt - b.createdAt

export function todayTasks(tasks: Task[], today: string) {
  return tasks.filter((t) => !t.done && t.due !== null && t.due <= today).sort(byTime)
}

export function QuickAdd({ due, placeholder = 'Add a task' }: { due: string | null; placeholder?: string }) {
  const [title, setTitle] = useState('')
  return (
    <form
      className="row quick-add"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return
        await db.tasks.put(blankTask(title.trim(), due))
        setTitle('')
      }}
    >
      <input className="field" value={title} placeholder={placeholder} onChange={(e) => setTitle(e.target.value)} aria-label={placeholder} enterKeyHint="done" />
      <button className="pill solid" aria-label="Add task">+</button>
    </form>
  )
}

export function TasksTab({ today, waxing }: { today: string; waxing: boolean }) {
  const tasks = useTasks()
  const [view, setView] = useState<View>('today')
  const [open, setOpen] = useState<{ task: Task; isNew: boolean } | null>(null)
  const monthAgo = Date.now() - 30 * 86400_000

  const lists: Record<View, Task[]> = {
    today: todayTasks(tasks, today),
    upcoming: tasks.filter((t) => !t.done && t.due !== null && t.due > today).sort(byTime),
    someday: tasks.filter((t) => !t.done && t.due === null).sort((a, b) => a.createdAt - b.createdAt),
    done: tasks.filter((t) => t.done && (t.doneAt ?? 0) >= monthAgo).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  }
  const list = lists[view]
  const groups = view === 'upcoming' ? [...new Set(list.map((t) => t.due!))] : null

  return (
    <div className="screen">
      <header className="glass card stack">
        <h1 className="serif">Tasks</h1>
        <QuickAdd due={view === 'someday' ? null : today} placeholder={view === 'someday' ? 'Add something for someday' : 'Add a task for today'} />
        <div className="segmented four" role="tablist" aria-label="Task views">
          {(['today', 'upcoming', 'someday', 'done'] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
              {v !== 'done' && lists[v].length > 0 && <span className="count"> {lists[v].length}</span>}
            </button>
          ))}
        </div>
      </header>

      <section className="glass card">
        {list.length === 0 && (
          <p className="muted">
            {view === 'today' ? 'Nothing due today. Set something down above when it comes to you.'
              : view === 'upcoming' ? 'Nothing waiting ahead yet.'
              : view === 'someday' ? 'Ideas without a date rest here until their time comes.'
              : 'What you finish in the next 30 days will gather here.'}
          </p>
        )}
        {groups
          ? groups.map((d) => (
              <div key={d}>
                <p className="lbl day-head">{prettyDay(d, today)}</p>
                <ul className="tasks">
                  {list.filter((t) => t.due === d).map((t) => <TaskRow key={t.id} t={t} today={today} waxing={waxing} onOpen={() => setOpen({ task: t, isNew: false })} />)}
                </ul>
              </div>
            ))
          : (
              <ul className="tasks">
                {list.map((t) => <TaskRow key={t.id} t={t} today={today} waxing={waxing} showDue={view === 'done'} onOpen={() => setOpen({ task: t, isNew: false })} />)}
              </ul>
            )}
        {list.length > 0 && view !== 'done' && <p className="muted small swipe-hint">Swipe right to finish, left to move to tomorrow. Tap a task to edit it.</p>}
      </section>

      {open && <TaskEditor task={open.task} isNew={open.isNew} onClose={() => setOpen(null)} />}
    </div>
  )
}
