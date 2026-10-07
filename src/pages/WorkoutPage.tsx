import { confirmDelete } from '../components/Confirm';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GlyphCheck, GlyphPrev, GlyphTrash } from '../components/icons';
import { WorkoutLogger } from '../components/training/WorkoutLogger';
import { Empty } from '../components/ui';
import { formatLong } from '../lib/dates';
import { useStore } from '../lib/store/StoreContext';
import type { WorkoutModule } from '../lib/types';

/** Full workout logging lives here; the day page only shows a summary. */
export default function WorkoutPage() {
  const { date = '', id = '' } = useParams();
  const store = useStore();
  const nav = useNavigate();
  const day = store.day(date);
  const w = day.modules.find((m): m is WorkoutModule => m.kind === 'workout' && m.id === id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const setTitle = (title: string) => store.updateDay(date, (d) => ({ ...d, modules: d.modules.map((m) => (m.id === id && m.kind === 'workout' ? { ...m, title: title.trim() || undefined } : m)) }));

  useEffect(() => {
    store.loadRange(date, date);
    store.ensureAllLoaded();
  }, [date]);

  return (
    <div className="page workout-page">
      <header className="page-head">
        <button className="icon-btn" aria-label="Torna alla giornata" onClick={() => nav(`/giorno/${date}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          {editing ? (
            <form
              className="title-edit"
              onSubmit={(e) => {
                e.preventDefault();
                setTitle(draft);
                setEditing(false);
              }}
            >
              <input autoFocus value={draft} placeholder="Nome dell’allenamento" onChange={(e) => setDraft(e.target.value)} aria-label="Nome dell’allenamento" />
              <button type="submit" className="icon-btn confirm" aria-label="Conferma il nome">
                <GlyphCheck />
              </button>
            </form>
          ) : (
            <h1>
              <button
                type="button"
                className="title-btn"
                disabled={!w}
                aria-label="Modifica il nome dell’allenamento"
                onClick={() => {
                  setDraft(w?.title ?? '');
                  setEditing(true);
                }}
              >
                {w?.title || 'Allenamento'}
              </button>
            </h1>
          )}
          <Link className="link-quiet capitalize" to={`/giorno/${date}`}>
            {formatLong(date)}
          </Link>
        </div>
        {w && (
          <button
            className="icon-btn"
            aria-label="Elimina allenamento"
            onClick={async () => {
              if (!(await confirmDelete('questo allenamento'))) return;
              store.updateDay(date, (d) => ({ ...d, modules: d.modules.filter((m) => m.id !== id) }));
              nav(`/giorno/${date}`);
            }}
          >
            <GlyphTrash />
          </button>
        )}
      </header>
      {w ? (
        <section className="card">
          <WorkoutLogger value={w} date={date} onAbandon={() => { store.updateDay(date, (d) => ({ ...d, modules: d.modules.filter((m) => m.id !== id) })); nav(`/giorno/${date}`); }} onChange={(nw) => store.updateDay(date, (d) => ({ ...d, modules: d.modules.map((m) => (m.id === nw.id ? nw : m)) }))} />
        </section>
      ) : (
        <Empty>Allenamento non trovato (forse è ancora in caricamento).</Empty>
      )}
    </div>
  );
}
