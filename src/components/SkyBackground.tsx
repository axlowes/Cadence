import { useEffect, useMemo, useRef } from 'react'
import type { SkyState } from '../lib/sky'

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
}

function makeStars(n: number): Star[] {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: n }, () => ({
    x: rand(),
    y: Math.pow(rand(), 1.6), // denser near the top of the sky
    r: 0.4 + rand() * 1.1,
    phase: rand() * Math.PI * 2,
    speed: 0.4 + rand() * 1.2,
  }))
}

export function SkyBackground({ sky }: { sky: SkyState }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stars = useMemo(() => makeStars(140), [])
  const opacity = useRef(sky.stars)
  opacity.current = sky.stars

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = 0

    const size = () => {
      const dpr = window.devicePixelRatio || 1
      el.width = window.innerWidth * dpr
      el.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (t: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      const o = opacity.current
      if (o > 0.01) {
        for (const s of stars) {
          const twinkle = reduce.matches ? 1 : 0.65 + 0.35 * Math.sin(t / 1000 * s.speed + s.phase)
          ctx.globalAlpha = o * twinkle * (1 - s.y * 0.6)
          ctx.fillStyle = '#FFF6E8'
          ctx.beginPath()
          ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (reduce.matches || opacity.current < 0.01) {
        if (t - last < 1000) return
      } else if (t - last < 66) return // about 15 frames a second is plenty for a twinkle
      last = t
      draw(t)
    }
    size()
    window.addEventListener('resize', size)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [stars])

  const [a, b, c] = sky.stops
  return (
    <div className="sky" style={{ background: `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)` }}>
      <canvas ref={canvas} className="stars" />
    </div>
  )
}
