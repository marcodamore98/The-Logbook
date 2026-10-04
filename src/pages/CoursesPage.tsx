import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileSlot, openFile } from '../components/files/FileSlot';
import { GlyphClip, GlyphFolder, IconCourse } from '../components/icons';
import { COURSE_TYPES } from '../components/modules/editors';
import { rangeLabel } from '../components/modules/meta';
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

/** All courses and congresses attended, newest first. */
export default function CoursesPage() {
  const rows = useCourses();
  const store = useStore();
  const { sub } = useParams();
  if (sub === 'attestati') return <Archive rows={rows} />;

  return (
    <div className="page courses-page">
      <header className="page-head">
        <IconCourse size={44} />
        <div className="page-title">
          <h1>Corsi e congressi</h1>
          <span className="page-sub">{rows.length} in elenco</span>
        </div>
      </header>

      <Link className="folder-banner" to="/corsi/attestati">
        <GlyphFolder />
        <span>Archivio attestati</span>
        <span aria-hidden="true">›</span>
      </Link>

      {rows.length === 0 && <Empty>Nessun corso o congresso. Aggiungili dalla pagina del giorno con “Aggiungi scheda → Corsi e congressi”.</Empty>}
      <ul className="course-list">
        {rows.map(({ origin, m }) => (
          <li key={m.id} className="course-row">
            <div className="course-head">
              <strong>{m.title || 'Senza titolo'}</strong>
              <span className="muted small">
                {COURSE_TYPES.find((t) => t.id === (m.type ?? 'course'))?.label} · {rangeLabel(m.startDate, m.endDate)} {m.startDate.slice(0, 4)}
                {m.startTime ? ` · ore ${m.startTime}` : ''}
              </span>
            </div>
            {m.program && (
              <button type="button" className="program-link" onClick={() => openFile(store.repo, m.program!)}>
                <GlyphClip /> Programma
              </button>
            )}
            {m.certificate ? (
              <button type="button" className="lime-banner" onClick={() => openFile(store.repo, m.certificate!)}>
                <span>Vedi attestato</span>
                <span aria-hidden="true">›</span>
              </button>
            ) : (
              <FileSlot
                label="Aggiungi l’attestato"
                crown
                onChange={(certificate) => {
                  if (certificate) store.updateDay(origin, (d) => ({ ...d, modules: d.modules.map((x) => (x.id === m.id && x.kind === 'course' ? { ...x, certificate } : x)) }));
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Only the certificate PDFs. */
function Archive({ rows }: { rows: Row[] }) {
  const store = useStore();
  const list = rows.filter((r) => r.m.certificate);
  return (
    <div className="page courses-page">
      <header className="page-head">
        <span className="folder-ico"><GlyphFolder /></span>
        <div className="page-title">
          <h1>Archivio attestati</h1>
          <Link className="link-quiet" to="/corsi">
            Corsi e congressi
          </Link>
        </div>
      </header>
      {list.length === 0 && <Empty>Ancora nessun attestato caricato.</Empty>}
      <ul className="course-list">
        {list.map(({ m }) => (
          <li key={m.id}>
            <button type="button" className="cert-file" onClick={() => openFile(store.repo, m.certificate!)}>
              <GlyphClip crown />
              <span className="file-text">
                <strong>{m.title || 'Attestato'}</strong>
                <span className="muted small">{m.certificate!.name} · {rangeLabel(m.startDate, m.endDate)} {m.startDate.slice(0, 4)}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
