import { useEffect, useState } from 'react'
import { checkPasscode, savePasscode } from '../lib/passcode'
import { getSetting, setSetting } from '../lib/db'

type Mode = 'create' | 'confirm' | 'unlock'

export function Passcode({ creating, onDone }: { creating: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>(creating ? 'create' : 'unlock')
  const [code, setCode] = useState('')
  const [first, setFirst] = useState('')
  const [length, setLength] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!creating) getSetting<number>('passcodeLength').then((n) => setLength(n ?? 6))
  }, [creating])

  const titles: Record<Mode, string> = {
    create: 'Choose a passcode',
    confirm: 'Once more, so I know it is yours',
    unlock: 'Welcome back',
  }
  const hints: Record<Mode, string> = {
    create: '4 to 6 digits. It keeps this little sky yours alone.',
    confirm: 'Type the same digits again.',
    unlock: 'Your passcode opens the door.',
  }

  async function submit(value: string) {
    if (busy) return
    setBusy(true)
    try {
      if (mode === 'create') {
        setFirst(value)
        setCode('')
        setMode('confirm')
        setMessage('')
      } else if (mode === 'confirm') {
        if (value === first) {
          try {
            await savePasscode(value)
            await setSetting('passcodeLength', value.length)
          } catch {
            /* storage unavailable (a preview window); open anyway */
          }
          onDone()
        } else {
          setMessage('Those two did not match. Let us begin again.')
          setCode('')
          setFirst('')
          setMode('create')
        }
      } else {
        if (await checkPasscode(value)) onDone()
        else {
          setMessage('Not quite. Try again.')
          setCode('')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  function press(d: string) {
    if (busy) return
    const next = (code + d).slice(0, 6)
    setCode(next)
    setMessage('')
    const target = mode === 'unlock' ? length : mode === 'confirm' ? first.length : null
    if (target && next.length === target) submit(next)
  }

  const showEnter = mode === 'create'
  const dots = mode === 'unlock' ? (length ?? 6) : mode === 'confirm' ? first.length : Math.max(4, code.length)

  return (
    <div className="lock">
      <div className="glass lock-card">
        <h1 className="serif">{titles[mode]}</h1>
        <p className="muted">{hints[mode]}</p>
        <div className="dots" aria-label={`${code.length} digits entered`}>
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className={i < code.length ? 'dot on' : 'dot'} />
          ))}
        </div>
        <p className="lock-message" role="status">{message}</p>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="key" onClick={() => press(d)}>{d}</button>
          ))}
          <button className="key key-soft" onClick={() => setCode(code.slice(0, -1))} aria-label="Delete">
            ⌫
          </button>
          <button className="key" onClick={() => press('0')}>0</button>
          {showEnter ? (
            <button
              className="key key-soft"
              disabled={code.length < 4}
              onClick={() => submit(code)}
              aria-label="Continue"
            >
              →
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  )
}
