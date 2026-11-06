/** Draws the Moon's lit shape for a phase angle (0 new, 180 full), as seen from the north. */
export function MoonDrawing({ angle, size = 72 }: { angle: number; size?: number }) {
  const r = 40
  const c = 50
  const rx = Math.abs(Math.cos((angle * Math.PI) / 180)) * r
  const waxing = angle < 180
  const crescent = angle < 90 || angle > 270
  const top = `${c} ${c - r}`
  const bottom = `${c} ${c + r}`
  const limbSweep = waxing ? 1 : 0
  const termSweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0
  const lit = `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} A ${rx} ${r} 0 0 ${termSweep} ${top} Z`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="moon-drawing">
      <defs>
        <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#F7E7CF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#F7E7CF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={49} fill="url(#moonGlow)" />
      <circle cx={c} cy={c} r={r} fill="#2B2546" stroke="#F7E7CF" strokeOpacity="0.35" strokeWidth="1" />
      <path d={lit} fill="#F7E7CF" />
    </svg>
  )
}
