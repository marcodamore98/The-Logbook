import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileSlot, openFile, programOf } from '../components/files/FileSlot';
import { mapsUrl, webUrl } from '../lib/links';
import { GlyphClip, GlyphFolder, IconCourse } from '../components/icons';
import { COURSE_TYPES } from '../components/modules/editors';
import { Empty } from '../components/ui';
import { useStore } from '../lib/store/StoreContext';
import type { CourseModule, ISODate } from '../lib/types';

interface Row {
  origin: ISODate;
  m: CourseModule;
}

function useCourses(): Row[] {
  const store = useStore();
  useEffect(() => {
    store.ensureAllLoaded();
  }, [store]);
  return useMemo(
    () =>
      store.allDays
        .flatMap((d) => d.modules.filter((m): m is CourseModule => m.kind === 'course').map((m) => ({ origin: d.date, m })))
        .sort((a, b) => b.m.startDate.localeCompare(a.m.startDate)),
    [store.allDays],
  );
}

const TONE: Record<string, string> = { course: 'sage', congress: 'lav', webinar: 'terra' };
const dateLong = (a: ISODate, b: ISODate) => {
  const f = (d: ISODate, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', o);
  if (a === b) return f(a, { day: 'numeric', month: 'long', year: 'numeric' });
  if (a.slice(0, 7) === b.slice(0, 7)) return `${f(a, { day: 'numeric' })}–${f(b, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return `${f(a, { day: 'numeric', month: 'short' })} – ${f(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
};
const fmtNum = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const kb = (n?: number) => (!n ? '' : n > 1024 * 1024 ? `${fmtNum(n / 1024 / 1024)} MB` : `${Math.round(n / 1024)} KB`);

const IconCal = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const IconBell = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
    {!on && <path d="M4 4l16 16" />}
  </svg>
);

/** All courses and congresses attended, newest first, grouped by year. */
export default function CoursesPage() {
  const rows = useCourses();
  const store = useStore();
  const { sub } = useParams();
  if (sub === 'attestati') return <Archive rows={rows} />;
  const certs = rows.filter((r) => r.m.certificate).length;
  const years = [...new Set(rows.map((r) => r.m.startDate.slice(0, 4)))];

  return (
    <div className="page courses-page">
      <header className="page-head">
        <IconCourse size={44} />
        <div className="page-title">
          <h1>Corsi e congressi</h1>
          <span className="page-sub">{rows.length} in elenco</span>
        </div>
      </header>

      <Link className="folder-banner2" to="/corsi/attestati">
        <span className="fb-ico" aria-hidden="true">
          <GlyphFolder />
        </span>
        <span className="fb-text">
          <strong>
            Archivio attestati <i aria-hidden="true" /> <small>{certs} PDF</small>
          </strong>
          <span>Tutti gli attestati in un posto</span>
        </span>
        <span className="fb-go" aria-hidden="true">›</span>
      </Link>

      {rows.length === 0 && <Empty>Nessun corso o congresso. Aggiungili dalla pagina del giorno con “Aggiungi scheda → Corsi e congressi”.</Empty>}
      {years.map((y) => {
        const list = rows.filter((r) => r.m.startDate.startsWith(y));
        return (
          <section key={y} className="course-year">
            <div className="cy-head">
              <span>
                <i aria-hidden="true" /> Attività formative {y}
              </span>
              <span>{list.length === 1 ? '1 evento' : `${list.length} eventi`}</span>
            </div>
            <ul className="course-list">
              {list.map(({ origin, m }) => {
                const type = m.type ?? 'course';
                return (
                  <li key={m.id} className="course-card">
                    <div className="cc-top">
                      <span className="cc-chips">
                        <span className={`cc-type tone-${TONE[type]}`}>{COURSE_TYPES.find((t) => t.id === type)?.label}</span>
                        {m.ecm ? <span className="cc-ecm">✓ {fmtNum(m.ecm)} crediti ECM</span> : null}
                      </span>
                      {m.startTime && (
                        <span className={`cc-time${m.remind ? ' on' : ''}`}>
                          <IconBell on={!!m.remind} /> {m.startTime}
                        </span>
                      )}
                    </div>
                    <Link className="cc-title" to={`/giorno/${origin}?apri=${m.id}`}>
                      {m.title || 'Senza titolo'}
                    </Link>
                    <span className="cc-date">
                      <IconCal /> {dateLong(m.startDate, m.endDate)}
                      {m.type === 'webinar' ? null : m.place ? (
                        <>
                          {' · '}
                          <a className="cc-place" href={mapsUrl(m.place)} target="_blank" rel="noopener noreferrer">
                            {m.place}
                          </a>
                        </>
                      ) : null}
                    </span>
                    {programOf(m).map((f, i, all) => (
                      <button key={f.id} type="button" className="cc-program" onClick={() => openFile(store.repo, f)}>
                        <GlyphClip /> <span>{all.length > 1 ? `Programma ${i + 1}` : 'Programma'}</span>
                      </button>
                    ))}
                    {m.type === 'webinar' && m.link && (
                      <a className="cc-program" href={webUrl(m.link)} target="_blank" rel="noopener noreferrer">
                        <span>Collegati al webinar ›</span>
                      </a>
                    )}
                    {m.certificate ? (
                      <button type="button" className="lime-banner" onClick={() => openFile(store.repo, m.certificate!)}>
                        <span className="cc-cert"><GlyphClip crown /> Vedi attestato</span>
                        <span aria-hidden="true">›</span>
                      </button>
                    ) : (
                      <div className="cc-add">
                        <FileSlot
                          label="+ Aggiungi l’attestato"
                          crown
                          onChange={(certificate) => {
                            if (certificate) store.updateDay(origin, (d) => ({ ...d, modules: d.modules.map((x) => (x.id === m.id && x.kind === 'course' ? { ...x, certificate } : x)) }));
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const TILE_TONES = ['lime', 'lav', 'sage', 'sky', 'terra', 'plum'];

/** Only the certificate PDFs: search, filter by year, tiles grouped by year. */
function Archive({ rows }: { rows: Row[] }) {
  const store = useStore();
  const [q, setQ] = useState('');
  const [year, setYear] = useState<string | null>(null);
  const all = rows.filter((r) => r.m.certificate);
  const years = [...new Set(all.map((r) => r.m.endDate.slice(0, 4)))];
  const ql = q.trim().toLowerCase();
  const list = all.filter((r) => (!year || r.m.endDate.startsWith(year)) && (!ql || r.m.title.toLowerCase().includes(ql) || (r.m.place ?? '').toLowerCase().includes(ql)));
  const ecm = (xs: Row[]) => xs.reduce((n, r) => n + (r.m.ecm ?? 0), 0);
  return (
    <div className="page courses-page archive-page">
      <Link className="link-quiet" to="/corsi">
        ‹ Corsi e congressi
      </Link>
      <header className="archive-head">
        <div>
          <h1>Archivio attestati</h1>
          <span className="page-sub">
            {all.length === 1 ? '1 attestato' : `${all.length} attestati`}
            {ecm(all) > 0 && (
              <>
                {' · '}
                <b>{fmtNum(ecm(all))} crediti ECM</b>
              </>
            )}
          </span>
        </div>
        <span className="folder-ico">
          <GlyphFolder />
        </span>
      </header>
      {all.length > 0 && (
        <>
          <span className="icon-input">
            <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
            <input type="search" value={q} placeholder="Cerca attestato o corso…" onChange={(e) => setQ(e.target.value)} />
          </span>
          <div className="chips scroll-x">
            <button className={`chip${!year ? ' chip-on' : ''}`} onClick={() => setYear(null)}>
              Tutti ({all.length})
            </button>
            {years.map((y) => (
              <button key={y} className={`chip${year === y ? ' chip-on' : ''}`} onClick={() => setYear(year === y ? null : y)}>
                {y} ({all.filter((r) => r.m.endDate.startsWith(y)).length})
              </button>
            ))}
          </div>
        </>
      )}
      {all.length === 0 && <Empty>Ancora nessun attestato caricato.</Empty>}
      {all.length > 0 && list.length === 0 && <Empty>Nessun attestato trovato.</Empty>}
      {years
        .filter((y) => list.some((r) => r.m.endDate.startsWith(y)))
        .map((y) => {
          const ys = list.filter((r) => r.m.endDate.startsWith(y));
          return (
            <section key={y} className="cert-year">
              <div className="cy-head big">
                <span>
                  <strong>{y}</strong> <i aria-hidden="true" /> {ys.length === 1 ? '1 attestato' : `${ys.length} attestati`}
                </span>
                {ecm(ys) > 0 && <span className="cy-ecm">{fmtNum(ecm(ys))} ECM</span>}
              </div>
              <div className="cert-grid">
                {ys.map(({ m }, k) => (
                  <button key={m.id} type="button" className="cert-tile" onClick={() => openFile(store.repo, m.certificate!)}>
                    <span className="ct-top">
                      <span className={`ct-ico tone-${TILE_TONES[k % TILE_TONES.length]}`} aria-hidden="true">
                        <GlyphClip crown />
                      </span>
                      {m.ecm ? <span className="ct-ecm">{fmtNum(m.ecm)} ECM</span> : null}
                    </span>
                    <strong className="ct-title">{m.title || 'Attestato'}</strong>
                    <span className="ct-date">{new Date(`${m.endDate}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="ct-foot">
                      <span>PDF{m.certificate!.size ? ` · ${kb(m.certificate!.size)}` : ''}</span>
                      <span aria-hidden="true">→</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
