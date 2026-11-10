import { ChartPicture } from '../components/ChartPicture'
import { MoonDrawing } from '../components/MoonDrawing'
import { TransitList } from '../components/TransitList'
import { BigThree, NatalTable, ordinal } from '../components/NatalSummary'
import type { MoonInfo } from '../lib/useMoon'
import type { Natal } from '../lib/natal'
import { fmtDayTime } from '../lib/useProfile'
import { formatDeg, lonOf } from '../lib/astro'
import { noTimeNote } from '../lib/transits'

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

export function MoonTab({ now, info, natal }: { now: Date; info: MoonInfo; natal: Natal | null }) {
  const { moon, ingress, voc, nextVoid, lunations, transits, house, lunarReturn } = info
  const moonLon = lonOf('Moon', now)
  const returnToday = lunarReturn && lunarReturn >= info.dayStart && lunarReturn < info.dayEnd
  return (
    <div className="screen">
      <header className="glass card moon-hero">
        <MoonDrawing angle={moon.angle} size={132} />
        <div>
          <h1 className="serif">{moon.phaseName}</h1>
          <p className="serif moon-sign">Moon in {moon.sign} {formatDeg(moonLon)}</p>
          <p className="small muted">
            {Math.round(moon.illumination * 100)}% lit, {moon.ageDays.toFixed(1)} days since the New Moon
          </p>
        </div>
      </header>

      <section className="glass card">
        <h2 className="serif">Sign and void</h2>
        <dl className="facts">
          <div><dt>Enters {ingress.sign}</dt><dd>{cap(fmtDayTime(ingress.time, now))}</dd></div>
          {voc.isVoid ? (
            <div><dt>Void of course</dt><dd>Now, until {fmtDayTime(voc.end, now)}</dd></div>
          ) : (
            <div><dt>Next void</dt><dd>From {fmtDayTime(nextVoid.start, now)} until {fmtDayTime(nextVoid.end, now)}</dd></div>
          )}
        </dl>
        {voc.isVoid && (
          <p className="small muted">
            While the Moon is void she has said everything she came to say in {moon.sign}. These are good hours for rest,
            tidying and finishing what's already begun. Save fresh starts for when she enters {voc.nextSign}.
          </p>
        )}
      </section>

      <section className="glass card">
        <h2 className="serif">Coming lunations</h2>
        <ul className="lunations">
          {lunations.map((l) => (
            <li key={l.time.getTime()}>
              <strong>{l.kind} in {l.sign}</strong>
              <p className="small muted">{cap(fmtDayTime(l.time, now))}</p>
              <div className="chips">
                {l.house && <span className="chip">your {ordinal(l.house)} house</span>}
                {l.eclipse && <span className="chip warm">{l.eclipse}</span>}
                {l.supermoon && <span className="chip warm">Supermoon</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass card">
        <h2 className="serif">Through your chart today</h2>
        {!natal && <p className="muted">Add your birth details in Settings to see how the Moon moves through your chart.</p>}
        {natal && (
          <>
            {house ? <p>{house.text}</p> : <p className="muted small">{noTimeNote}</p>}
            {returnToday && <p className="chip warm big">Your lunar return is today</p>}
            {transits.length ? <TransitList transits={transits} now={now} /> : <p className="muted">No exact Moon aspects to your chart today.</p>}
            {lunarReturn && !returnToday && (
              <p className="small muted">Next lunar return: {fmtDayTime(lunarReturn, now)}</p>
            )}
          </>
        )}
      </section>

      <section className="glass card">
        <h2 className="serif">Your natal chart</h2>
        <ChartPicture />
        {natal && <BigThree natal={natal} />}
        {natal && <NatalTable natal={natal} />}
      </section>
    </div>
  )
}
