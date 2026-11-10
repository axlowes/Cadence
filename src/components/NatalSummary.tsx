import { formatDeg, signOf, SIGN_GLYPH, norm } from '../lib/astro'
import type { Natal } from '../lib/natal'
import { noTimeNote } from '../lib/transits'

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
const glyph = (lon: number) => SIGN_GLYPH[Math.floor(norm(lon) / 30)]

export function BigThree({ natal }: { natal: Natal }) {
  const get = (n: string) => natal.points.find((p) => p.name === n)
  const sun = get('Sun')!
  const moon = get('Moon')!
  const asc = get('Ascendant')
  return (
    <div className="big-three">
      <div><span className="eyebrow">Sun</span><strong className="serif">{signOf(sun.lon)}</strong></div>
      <div><span className="eyebrow">Moon</span><strong className="serif">{signOf(moon.lon)}</strong></div>
      <div><span className="eyebrow">Rising</span><strong className="serif">{asc ? signOf(asc.lon) : 'Unknown'}</strong></div>
    </div>
  )
}

export function NatalTable({ natal }: { natal: Natal }) {
  return (
    <>
      <table className="natal">
        <thead>
          <tr><th scope="col">Point</th><th scope="col">Sign</th><th scope="col">Degree</th>{natal.cusps && <th scope="col">House</th>}</tr>
        </thead>
        <tbody>
          {natal.points.map((p) => (
            <tr key={p.name}>
              <th scope="row">{p.name}{p.retro ? <span className="retro" title="retrograde"> ℞</span> : null}</th>
              <td><span className="glyph" aria-hidden="true">{glyph(p.lon)}</span> {signOf(p.lon)}</td>
              <td className="num">{formatDeg(p.lon)}</td>
              {natal.cusps && <td className="num">{p.house ? ordinal(p.house) : ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!natal.timeKnown && <p className="muted small">{noTimeNote}</p>}
      {natal.cusps && (
        <p className="muted small">Houses: {natal.system === 'whole' ? 'Whole Sign' : 'Placidus'}. You can switch in Settings.</p>
      )}
    </>
  )
}

export { ordinal }
