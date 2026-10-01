import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DiaryEntryView } from '../components/diary/DiaryEntry';
import { ExplorerPrint, printWhenReady } from '../components/diary/ExplorerPrint';
import { GlyphClose, GlyphNext, GlyphPrev, GlyphPrint } from '../components/icons';
import { Card } from '../components/ui';
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
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    store.loadRange(date, date);
  }, [date]);
  useEffect(() => store.ensureAllLoaded(), []);

  const written = useMemo(() => store.allDays.filter(hasDiary).sort((a, b) => a.date.localeCompare(b.date)), [store.allDays]);
  const prev = [...written].reverse().find((d) => d.date < date)?.date;
  const next = written.find((d) => d.date > date)?.date;
  const go = (d: ISODate) => nav(`/diario/${d}`);

  // Swipe sideways to turn the page.
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('textarea, input') || e.touches[0].clientX <= 40) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(addDays(date, dx < 0 ? 1 : -1));
  };

  return (
    <div className="page diary-page" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="diary-screen">
        <header className="page-head">
          <button className="icon-btn" aria-label="Giorno precedente" onClick={() => go(addDays(date, -1))}>
            <GlyphPrev />
          </button>
          <div className="page-title">
            <h1 className="capitalize">{formatLong(date)}</h1>
            <span className="page-sub">Diario · salta alle pagine scritte</span>
          </div>
          <button className="icon-btn" aria-label="Stampa il diario" title="Stampa il diario" onClick={() => setPrintOpen(true)}>
            <GlyphPrint />
          </button>
          <button className="icon-btn" aria-label="Giorno successivo" onClick={() => go(addDays(date, 1))}>
            <GlyphNext />
          </button>
        </header>

        <div className="diary-nav">
          <button className="btn-ghost small" disabled={!prev} onClick={() => prev && go(prev)}>
            <GlyphPrev /> Precedente
          </button>
          <input type="date" value={date} aria-label="Vai al giorno" onChange={(e) => e.target.value && go(e.target.value)} />
          <button className="btn-ghost small" disabled={!next} onClick={() => next && go(next)}>
            Successiva <GlyphNext />
          </button>
        </div>

        <section className="card diary-sheet">
          <DiaryEntryView key={date} day={day} onSave={(diary) => store.updateDay(date, (d) => withDiary(d, diary))} />
        </section>

        <Card id="diary.index" icon={null} title="Tutte le pagine" summary={`${written.length} scritte`} defaultOpen={false}>
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
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Stampa il diario" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Stampa il diario</h2>
          <button className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        <p className="muted small">Genera il diario completo, una pagina per giornata scritta. Nella finestra di stampa scegli “Salva come PDF”.</p>
        <div className="grid">
          <label className="field">
            <span className="field-label">Dal</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Al</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} /> Includi le foto
        </label>
        <p className="muted small">{count} {count === 1 ? 'pagina' : 'pagine'} nel periodo scelto.</p>
        <div className="sheet-foot">
          <span />
          <button className="btn" disabled={!count} onClick={() => onPrint(from, to, photos)}>
            <GlyphPrint /> Stampa
          </button>
        </div>
      </div>
    </div>
  );
}
