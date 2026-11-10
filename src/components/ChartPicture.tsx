import { useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../lib/db'

// A personal chart picture can sit in src/seed as chart.local.jpg or .png. Git ignores it.
const seeded = Object.values(
  import.meta.glob<string>('../seed/chart.local.*', { eager: true, query: '?inline', import: 'default' }),
)[0]

function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => reject(new Error('That file could not be opened as a picture.'))
    img.src = url
  })
}

export function ChartPicture() {
  const stored = useLiveQuery(() => db.settings.get('chartImage').then((r) => (r ? (r.value as string | null) : undefined)), [])
  const input = useRef<HTMLInputElement>(null)
  // undefined: never set, so fall back to the seeded picture. null: she removed it.
  const src = stored === undefined ? seeded : stored

  return (
    <div className="stack tight">
      {src ? (
        <img className="chart-pic" src={src} alt="Your birth chart wheel" />
      ) : (
        <p className="muted">Add a picture of your chart wheel and it will live here, close at hand whenever the Moon touches a placement.</p>
      )}
      <div className="row">
        <button className="pill" onClick={() => input.current?.click()}>{src ? 'Change picture' : 'Add a picture'}</button>
        {src && <button className="pill" onClick={() => setSetting('chartImage', null)}>Remove</button>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            await setSetting('chartImage', await shrink(f))
          } catch (err) {
            alert((err as Error).message)
          }
        }} />
    </div>
  )
}
