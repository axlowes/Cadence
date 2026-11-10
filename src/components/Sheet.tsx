import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row-between sheet-head">
          <h2 className="serif">{title}</h2>
          <button className="pill" onClick={onClose}>Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'pill' }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  return (
    <details className="confirm">
      <summary className={className}>{label}</summary>
      <button className="pill danger" onClick={onConfirm}>{confirmLabel}</button>
    </details>
  )
}
