import { getSetting, setSetting } from './db'

interface StoredCode {
  salt: string
  hash: string
}

const toB64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(code: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200_000, hash: 'SHA-256' },
    key,
    256,
  )
  return toB64(bits)
}

export async function hasPasscode() {
  return !!(await getSetting<StoredCode>('passcode'))
}

export async function savePasscode(code: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  await setSetting('passcode', { salt: toB64(salt), hash: await derive(code, salt) })
}

export async function checkPasscode(code: string) {
  const stored = await getSetting<StoredCode>('passcode')
  if (!stored) return true
  return (await derive(code, fromB64(stored.salt))) === stored.hash
}
