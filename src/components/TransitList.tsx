import type { Transit } from '../lib/transits'
import { aspectLabel } from '../lib/transits'
import { fmtDayTime } from '../lib/useProfile'

export function TransitList({ transits, now, limit }: { transits: Transit[]; now: Date; limit?: number }) {
  const sorted = [...transits].sort((a, b) => Number(b.active) - Number(a.active) || a.exact.getTime() - b.exact.getTime())
  const shown = limit ? sorted.slice(0, limit) : sorted
  return (
    <ul className="transits">
      {shown.map((t) => (
        <li key={`${t.aspect}-${t.to}-${t.exact.getTime()}`}>
          <div className="row-between">
            <strong>{aspectLabel(t.aspect, t.to)}</strong>
            {t.active && <span className="chip">active</span>}
          </div>
          <p className="small muted">
            {t.exact < now ? 'Was exact ' : 'Exact '}
            {fmtDayTime(t.exact, now)}
          </p>
          <p>{t.meaning}</p>
        </li>
      ))}
    </ul>
  )
}
