import type { ReactNode } from 'react'

const read = (id: string) => {
  try {
    return localStorage.getItem(`fold:${id}`) === '1'
  } catch {
    return false
  }
}
const write = (id: string, open: boolean) => {
  try {
    localStorage.setItem(`fold:${id}`, open ? '1' : '0')
  } catch {
    /* private window */
  }
}

/** A Today card that stays folded to its title and a one-line glance until she taps it. Remembers how she left it. */
export function Fold({ id, title, hint, children }: { id: string; title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <details className="glass card fold" open={read(id)} onToggle={(e) => write(id, (e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="fold-head">
          <span className="serif fold-title">{title}</span>
          {hint && <span className="small muted fold-hint">{hint}</span>}
        </span>
        <span className="chev" aria-hidden="true">⌄</span>
      </summary>
      <div className="stack fold-body">{children}</div>
    </details>
  )
}
