import { useEffect, useRef, useState } from 'react'
import type { Task } from '../lib/db'
import { completeTask, moveToTomorrow, undoTask } from '../lib/tasks'
import { CrescentHint } from './Icons'
import { prettyDay } from '../lib/dates'

const THRESHOLD = 80

export function TaskRow({ t, today, waxing, onOpen, showDue }: { t: Task; today: string; waxing: boolean; onOpen: () => void; showDue?: boolean }) {
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const swiping = useRef(false)

  const hint = !t.done && ((waxing && t.tag === 'begin') || (!waxing && (t.tag === 'release' || t.tag === 'clear')))
  const overdue = !t.done && t.due !== null && t.due < today

  const row = useRef<HTMLDivElement>(null)
  const dxRef = useRef(0)
  const latest = useRef({ t, today })
  latest.current = { t, today }

  const begin = (x: number, y: number) => {
    start.current = { x, y, id: 0 }
    swiping.current = false
  }
  const track = (x: number, y: number) => {
    if (!start.current) return false
    const ddx = x - start.current.x
    const ddy = y - start.current.y
    if (!swiping.current && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.5) swiping.current = true
    if (swiping.current) {
      dxRef.current = Math.max(-140, Math.min(140, ddx))
      setDx(dxRef.current)
    }
    return swiping.current
  }
  const finish = async () => {
    const d = dxRef.current
    const was = swiping.current
    start.current = null
    dxRef.current = 0
    setDx(0)
    if (!was) return
    const { t: task, today: day } = latest.current
    if (d > THRESHOLD && !task.done) await completeTask(task)
    else if (d < -THRESHOLD && !task.done) await moveToTomorrow(task, day)
    setTimeout(() => (swiping.current = false), 50)
  }

  // Touch listeners are attached by hand so a sideways swipe can stop the page from scrolling.
  useEffect(() => {
    const el = row.current
    if (!el) return
    const ts = (e: TouchEvent) => begin(e.touches[0].clientX, e.touches[0].clientY)
    const tm = (e: TouchEvent) => {
      if (track(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault()
    }
    const te = () => void finish()
    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('touchcancel', te)
    return () => {
      el.removeEventListener('touchstart', ts)
      el.removeEventListener('touchmove', tm)
      el.removeEventListener('touchend', te)
      el.removeEventListener('touchcancel', te)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDown = (e: React.PointerEvent) => e.pointerType === 'mouse' && begin(e.clientX, e.clientY)
  const onMove = (e: React.PointerEvent) => e.pointerType === 'mouse' && track(e.clientX, e.clientY)
  const onUp = (e: React.PointerEvent) => e.pointerType === 'mouse' && void finish()

  return (
    <li className="task-wrap">
      <div className="task-under" aria-hidden="true">
        <span className={dx > 0 ? 'under-left on' : 'under-left'}>Done</span>
        <span className={dx < 0 ? 'under-right on' : 'under-right'}>Tomorrow</span>
      </div>
      <div
        ref={row}
        className={`task-row${t.done ? ' done' : ''}`}
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform 0.25s ease' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <button className={`task-check${t.priority === 'high' ? ' high' : ''}`} aria-label={t.done ? `Mark ${t.title} not done` : `Complete ${t.title}`}
          onClick={() => (t.done ? undoTask(t) : completeTask(t))}>
          {t.done ? '✓' : ''}
        </button>
        <button className="task-main" onClick={() => !swiping.current && onOpen()}>
          <span className="task-title">
            {t.title}
            {hint && <span className="task-hint" title={waxing ? 'The Moon is waxing, a good time to begin' : 'The Moon is waning, a good time to let go'}><CrescentHint /></span>}
          </span>
          <span className={`small ${overdue ? 'overdue' : 'muted'}`}>
            {[
              showDue && t.due ? prettyDay(t.due, today) : overdue ? `From ${prettyDay(t.due!, today).toLowerCase()}` : null,
              t.time ? fmtClock(t.time) : null,
              t.repeat !== 'none' ? 'repeats' : null,
              t.priority === 'high' ? 'important' : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </button>
      </div>
    </li>
  )
}

export const fmtClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm')
}
