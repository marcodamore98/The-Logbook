import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DiaryEntryView } from '../components/diary/DiaryEntry';
import { ExplorerPrint, printWhenReady } from '../components/diary/ExplorerPrint';
import { GlyphClose, GlyphNext, GlyphPrev, GlyphPrint } from '../components/icons';
import { useSwipeNav } from '../components/useSwipeNav';
import { Card, TimeTile } from '../components/ui';
import { addDays, formatLong, fromISO, today } from '../lib/dates';
import { hasDiary, withDiary } from '../lib/diary';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, ISODate } from '../lib/types';

export default function DiaryPage() {
  const params = useParams();
  const date = params.date ?? today();
  const nav = useNavigate();
  const store = useStore();
  const day = store.day(date);
  const [printOpen, setPrintOpen] = useState(false);
  const [printing, setPrinting] = useState<{ days: DayEntry[]; from: ISODate; to: ISODate; photos: boolean } | null>(null);

  useEffect(() => {
    store.loadRange(date, date);
  }, [date]);
  useEffect(() => store.ensureAllLoaded(), []);

  const written = useMemo(() => store.allDays.filter(hasDiary).sort((a, b) => a.date.localeCompare(b.date)), [store.allDays]);
  const prev = [...written].reverse().find((d) => d.date < date)?.date;
  const next = written.find((d) => d.date > date)?.date;
  const go = (d: ISODate) => nav(`/diario/${d}`);
  const pageNo = hasDiary(day) ? written.filter((d) => d.date <= date).length : 0;
  const [indexOpen, setIndexOpen] = useState(false);

  const swipeRef = useSwipeNav<HTMLDivElement>(() => go(addDays(date, -1)), () => go(addDays(date, 1)), date);

  return (
    <div ref={swipeRef} className="page diary-page">
      <div className="diary-screen">
        <header className="page-head diary-strip">
          <button className="icon-btn" aria-label="Giorno precedente" onClick={() => go(addDays(date, -1))}>
            <GlyphPrev />
          </button>
          <div className="page-title">
            <h1 className="capitalize">
              <svg viewBox="0 0 24 24" width={17} height={17} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" />
              </svg>
              {formatLong(date).charAt(0).toUpperCase() + formatLong(date).slice(1)}
            </h1>
            <span className="page-sub">{pageNo ? `Pagina ${pageNo}` : `Pagina non scritta · ${written.length} scritte`}</span>
          </div>
          <button className="icon-btn" aria-label="Giorno successivo" onClick={() => go(addDays(date, 1))}>
            <GlyphNext />
          </button>
        </header>

        <div className="diary-tools">
          <button className="lime-banner diary-jump" onClick={() => { setIndexOpen(true); setTimeout(() => document.getElementById('diary-index')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}>
            <span>Salta alle pagine scritte</span>
            <b className="dj-count">{written.length === 1 ? '1 pagina' : `${written.length} pagine`} ›</b>
          </button>
          <button className="icon-btn" aria-label="Stampa il diario" title="Stampa il diario" onClick={() => setPrintOpen(true)}>
            <GlyphPrint />
          </button>
        </div>

        <div className="diary-nav">
          <button className="btn-ghost small" aria-label="Pagina scritta precedente" disabled={!prev} onClick={() => prev && go(prev)}>
            <GlyphPrev /> Prec.
          </button>
          <input type="date" value={date} aria-label="Vai al giorno" onChange={(e) => e.target.value && go(e.target.value)} />
          <button className="btn-ghost small" aria-label="Pagina scritta successiva" disabled={!next} onClick={() => next && go(next)}>
            Succ. <GlyphNext />
          </button>
        </div>

        <section className="card diary-sheet">
          <DiaryEntryView key={date} photoCard day={day} onSave={(diary) => store.updateDay(date, (d) => withDiary(d, diary))} />
        </section>

        <div id="diary-index" />
        <Card id="diary.index" icon={null} title="Tutte le pagine" summary={`${written.length} scritte`} open={indexOpen} onToggle={() => setIndexOpen(!indexOpen)}>
          {written.length === 0 ? (
            <p className="muted small">Ancora nessuna pagina scritta.</p>
          ) : (
            <ul className="diary-index">
              {[...written].reverse().map((d) => (
                <li key={d.date}>
                  <button className={d.date === date ? 'on' : ''} onClick={() => go(d.date)}>
                    <strong>{fromISO(d.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    <span>{(d.diary?.text ?? '').slice(0, 70) || 'Foto'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {printOpen && (
        <PrintSheet
          written={written}
          onClose={() => setPrintOpen(false)}
          onPrint={async (from, to, photos) => {
            setPrintOpen(false);
            const days = await store.repo.getRange(from, to);
            const sel = days.filter(hasDiary).sort((a, b) => a.date.localeCompare(b.date));
            setPrinting({ days: sel, from, to, photos });
            document.body.dataset.printDoc = 'diary';
            const prevTitle = document.title;
            document.title = `Diario ${from} – ${to}`;
            const done = () => {
              delete document.body.dataset.printDoc;
              document.title = prevTitle;
              setPrinting(null);
              window.removeEventListener('afterprint', done);
            };
            window.addEventListener('afterprint', done);
            setTimeout(printWhenReady, 150);
          }}
        />
      )}
      {printing && <ExplorerPrint {...printing} />}
    </div>
  );
}

function PrintSheet({ written, onClose, onPrint }: { written: DayEntry[]; onClose: () => void; onPrint: (from: ISODate, to: ISODate, photos: boolean) => void }) {
  const first = written[0]?.date ?? today();
  const last = written[written.length - 1]?.date ?? today();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [photos, setPhotos] = useState(true);
  const count = written.filter((d) => d.date >= from && d.date <= to).length;
  const t = today();
  const presets: [string, ISODate, ISODate][] = [
    ['Questo mese', `${t.slice(0, 7)}-01`, t],
    ['Ultimi 30 giorni', addDays(t, -29), t],
    ['Quest’anno', `${t.slice(0, 4)}-01-01`, t],
    ['Tutto', first, last],
  ];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet diary-print" role="dialog" aria-label="Stampa il diario" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <div>
            <h2>Stampa il diario</h2>
            <p className="muted small">Una pagina per giornata scritta · “Salva come PDF” nella finestra di stampa</p>
          </div>
          <button className="icon-btn small" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        <div className="chips scroll-x">
          {presets.map(([label, a, b]) => (
            <button key={label} className={`chip${from === a && to === b ? ' chip-on' : ''}`} onClick={() => { setFrom(a); setTo(b); }}>
              {label}
            </button>
          ))}
        </div>
        <div className="tile-grid">
          <TimeTile type="date" label="Dal" value={from} onChange={(v) => v && setFrom(v)} />
          <TimeTile type="date" label="Al" value={to} min={from} onChange={(v) => v && setTo(v)} />
        </div>
        <label className="routine-check">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
          <span className="rc-box" aria-hidden="true">✓</span>
          <span>
            <strong>Includi le foto della giornata</strong>
            <small>{count} {count === 1 ? 'pagina' : 'pagine'} nel periodo scelto</small>
          </span>
        </label>
        <button className="lime-banner" disabled={!count} onClick={() => onPrint(from, to, photos)}>
          <span>Genera l’anteprima di stampa (PDF)</span>
          <span aria-hidden="true">›</span>
        </button>
        <button className="btn-ghost cancel-banner" onClick={onClose}>
          Annulla
        </button>
      </div>
    </div>
  );
}
