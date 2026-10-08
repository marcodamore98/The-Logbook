import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { confirmAction } from '../components/Confirm';
import { Sym } from '../components/icons';
import { Empty } from '../components/ui';
import { fromISO } from '../lib/dates';
import { changedDays, versionsOf, type Version } from '../lib/store/history';
import { diffWith, restoreItem, restoreMissing } from '../lib/store/restore';
import { useStore } from '../lib/store/StoreContext';
import type { ISODate } from '../lib/types';

const dayName = (d: ISODate) => fromISO(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const when = (ts: number) => {
  const d = new Date(ts);
  const t = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `oggi alle ${t}`;
  return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${t}`;
};
const SOURCE: Record<string, string> = { app: 'Modifica su questo dispositivo', cloud: 'Arrivata dal cloud (altro dispositivo)', google: 'Arrivata da Google Calendar' };

/** "Cronologia delle modifiche": the earlier versions kept on this device, to put back what was lost. */
export default function HistoryPage() {
  const { date } = useParams();
  return date ? <DayHistory date={date} /> : <AllDays />;
}

function AllDays() {
  const [days, setDays] = useState<Awaited<ReturnType<typeof changedDays>> | null>(null);
  useEffect(() => {
    changedDays().then(setDays);
  }, []);
  return (
    <div className="page history-page">
      <header className="page-head">
        <span className="hist-ico" aria-hidden="true">
          <Sym name="history" size={26} />
        </span>
        <div className="page-title">
          <h1>Cronologia delle modifiche</h1>
          <span className="page-sub">Versioni precedenti delle giornate, salvate su questo dispositivo per 60 giorni</span>
        </div>
      </header>
      <p className="hist-intro">
        Ogni volta che una giornata cambia, il telefono ne tiene una copia. Se qualcosa sparisce — per un errore, per Google Calendar o perché un altro dispositivo ha salvato una copia vecchia — qui la ritrovi e la rimetti al suo posto.
      </p>
      {!days && <p className="muted">Carico…</p>}
      {days && days.length === 0 && <Empty>Ancora nessuna versione salvata: compariranno dalle prossime modifiche.</Empty>}
      <ul className="hist-days">
        {days?.map((d) => (
          <li key={d.date}>
            <Link to={`/cronologia/${d.date}`} className="hist-day">
              <span className="hd-text">
                <strong>{dayName(d.date)}</strong>
                <small>
                  {d.versions === 1 ? '1 versione' : `${d.versions} versioni`} · ultima {when(d.last)}
                </small>
              </span>
              {d.losses > 0 && <span className="hd-lost">{d.losses === 1 ? '1 con elementi tolti' : `${d.losses} con elementi tolti`}</span>}
              <Sym name="chevron_right" size={20} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayHistory({ date }: { date: ISODate }) {
  const store = useStore();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const reload = useCallback(() => {
    versionsOf(date).then(setVersions);
  }, [date]);
  useEffect(() => {
    store.loadRange(date, date);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  const current = store.day(date);
  const flash = (t: string) => {
    setDone(t);
    window.setTimeout(() => setDone((x) => (x === t ? null : x)), 3000);
  };

  const putBack = async (v: Version, id: string, label: string, changed: boolean) => {
    if (changed && !(await confirmAction(`Rimettere ${label} com’era ${when(v.at)}?`, { detail: 'La versione di adesso viene sostituita (resta comunque nella cronologia).', action: 'Ripristina' }))) return;
    await store.updateDay(date, (d) => restoreItem(d, v.day, id));
    flash(`${label} ripristinato`);
    window.setTimeout(reload, 900);
  };
  const putBackAll = async (v: Version, n: number) => {
    if (!(await confirmAction(n === 1 ? 'Rimettere l’elemento che manca?' : `Rimettere i ${n} elementi che mancano?`, { detail: 'Quello che c’è adesso resta: vengono solo aggiunti gli elementi tolti.', action: 'Ripristina' }))) return;
    await store.updateDay(date, (d) => restoreMissing(d, v.day));
    flash(n === 1 ? '1 elemento ripristinato' : `${n} elementi ripristinati`);
    window.setTimeout(reload, 900);
  };

  return (
    <div className="page history-page">
      <Link className="link-quiet" to="/cronologia">
        ‹ Tutte le giornate
      </Link>
      <header className="page-head">
        <span className="hist-ico" aria-hidden="true">
          <Sym name="history" size={26} />
        </span>
        <div className="page-title">
          <h1>Versioni precedenti</h1>
          <span className="page-sub hist-date">{dayName(date)}</span>
        </div>
      </header>
      <Link className="btn-ghost hist-goto" to={`/giorno/${date}`}>
        Apri la giornata ›
      </Link>
      {!versions && <p className="muted">Carico…</p>}
      {versions && versions.length === 0 && <Empty>Nessuna versione precedente salvata per questa giornata.</Empty>}
      <ol className="hist-versions">
        {versions?.map((v, i) => {
          const diff = diffWith(v.day, current);
          const missing = diff.filter((x) => x.kind === 'missing');
          const isOpen = open === v.at;
          return (
            <li key={v.at} className={`hist-v${v.lost?.length ? ' lost' : ''}${isOpen ? ' open' : ''}`}>
              <button type="button" className="hv-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.at)}>
                <span className="hv-dot" aria-hidden="true" />
                <span className="hv-text">
                  <strong>{i === 0 ? `Ultima versione · ${when(v.at)}` : when(v.at)}</strong>
                  <small>{SOURCE[v.source ?? 'app']}</small>
                  {v.lost?.length ? <span className="hv-lost">Tolto: {v.lost.join(', ')}</span> : null}
                  {diff.length > 0 ? (
                    <span className="hv-diff">
                      {missing.length > 0 && `${missing.length === 1 ? '1 elemento che oggi manca' : `${missing.length} elementi che oggi mancano`}`}
                      {missing.length > 0 && diff.length > missing.length && ' · '}
                      {diff.length > missing.length && `${diff.length - missing.length === 1 ? '1 modificato' : `${diff.length - missing.length} modificati`} da allora`}
                    </span>
                  ) : (
                    <span className="hv-same">Uguale alla giornata di adesso</span>
                  )}
                </span>
                {diff.length > 0 && <Sym name="chevron_right" size={20} className={`chevron${isOpen ? ' open' : ''}`} />}
              </button>
              {isOpen && diff.length > 0 && (
                <div className="hv-body">
                  <ul className="hv-items">
                    {diff.map((x) => (
                      <li key={x.id}>
                        <span className={`hv-tag ${x.kind}`}>{x.kind === 'missing' ? 'manca' : 'diverso'}</span>
                        <span className="hv-label">{x.label}</span>
                        <button type="button" className="btn-ghost small" onClick={() => putBack(v, x.id, x.label, x.kind === 'changed')}>
                          <Sym name="history" size={16} /> Ripristina
                        </button>
                      </li>
                    ))}
                  </ul>
                  {missing.length > 1 && (
                    <button type="button" className="btn hv-all" onClick={() => putBackAll(v, missing.length)}>
                      Rimetti tutti gli elementi che mancano ({missing.length})
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {done && (
        <div className="snackbar note-toast" role="status">
          ✓ {done}
        </div>
      )}
    </div>
  );
}
