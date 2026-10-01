import { StoredImage } from '../modules/editors';
import { diaryOf } from '../../lib/diary';
import { fromISO } from '../../lib/dates';
import type { DayEntry, ISODate } from '../../lib/types';

const Compass = () => (
  <svg viewBox="0 0 120 120" width="96" height="96" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="60" cy="60" r="52" />
    <circle cx="60" cy="60" r="46" strokeWidth="0.7" />
    <path d="M60 8v14M60 98v14M8 60h14M98 60h14" strokeWidth="2" />
    <path d="M60 22l9 29 29 9-29 9-9 29-9-29-29-9 29-9z" fill="currentColor" fillOpacity="0.12" />
    <path d="M60 22l9 29-9 9-9-9z" fill="currentColor" fillOpacity="0.55" />
    <circle cx="60" cy="60" r="3" fill="currentColor" />
  </svg>
);

const long = (d: ISODate) => fromISO(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const short = (d: ISODate) => fromISO(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** The whole diary laid out like an explorer's field journal. Only visible when printing. */
export function ExplorerPrint({ days, from, to, photos = true }: { days: DayEntry[]; from: ISODate; to: ISODate; photos?: boolean }) {
  return (
    <div className="diary-print explorer">
      <section className="ex-cover">
        <Compass />
        <p className="ex-kicker">Annotazioni di viaggio</p>
        <h1>Il diario di bordo</h1>
        <div className="ex-rule" />
        <p className="ex-range">
          dal {short(from)}
          <br />al {short(to)}
        </p>
        <p className="ex-count">{days.length} {days.length === 1 ? 'giornata annotata' : 'giornate annotate'}</p>
      </section>

      {days.map((d, i) => {
        const e = diaryOf(d);
        return (
          <article className="ex-day" key={d.date}>
            <header>
              <span className="ex-num">{i + 1}</span>
              <h2>{long(d.date)}</h2>
            </header>
            {e.text.trim() && <p className="ex-text">{e.text}</p>}
            {photos && e.photos.length > 0 && (
              <div className="ex-photos">
                {e.photos.map((p, k) => (
                  <figure key={p.id} className={`ex-photo r${k % 4}`}>
                    <span className="ex-tape" />
                    <StoredImage src={p.src} alt={p.caption ?? ''} />
                    {p.caption && <figcaption>{p.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </article>
        );
      })}
      <p className="ex-end">— fine delle annotazioni —</p>
    </div>
  );
}

/** Waits for every image in the print layout, then opens the print dialog. */
export async function printWhenReady() {
  const deadline = Date.now() + 8000;
  const pending = () => Array.from(document.querySelectorAll<HTMLImageElement>('.diary-print img')).some((i) => !i.complete) || !!document.querySelector('.diary-print .photo-loading');
  while (pending() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 150));
  window.print();
}
