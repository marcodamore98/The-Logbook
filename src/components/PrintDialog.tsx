import { useState } from 'react';
import { GlyphClose, GlyphPrint } from './icons';

/**
 * Lets the user pick which sections to include, then opens the browser's print
 * dialog (choose "Salva come PDF"). Sections are elements with data-print="<id>".
 */
export function PrintButton({ sections, title }: { sections: { id: string; label: string }[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(sections.map((s) => s.id));

  function print() {
    setOpen(false);
    document.body.dataset.print = sel.join(' ');
    const prev = document.title;
    document.title = title;
    const done = () => {
      delete document.body.dataset.print;
      document.title = prev;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }

  return (
    <>
      <button className="icon-btn no-print" aria-label="Stampa o salva in PDF" title="Stampa / PDF" onClick={() => setOpen(true)}>
        <GlyphPrint />
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet print-sheet" role="dialog" aria-label="Stampa" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Stampa / PDF</h2>
              <button className="icon-btn" aria-label="Chiudi" onClick={() => setOpen(false)}>
                <GlyphClose />
              </button>
            </div>
            <p className="muted small">Scegli le sezioni da includere. Nella finestra di stampa seleziona “Salva come PDF”.</p>
            <ul className="print-list">
              {sections.map((s) => (
                <li key={s.id}>
                  <label className="check">
                    <input type="checkbox" checked={sel.includes(s.id)} onChange={() => setSel((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))} />
                    {s.label}
                  </label>
                </li>
              ))}
            </ul>
            <div className="sheet-foot">
              <div className="row">
                <button className="btn-ghost small" onClick={() => setSel(sections.map((s) => s.id))}>
                  Tutte
                </button>
                <button className="btn-ghost small" onClick={() => setSel([])}>
                  Nessuna
                </button>
              </div>
              <button className="btn" disabled={!sel.length} onClick={print}>
                <GlyphPrint /> Stampa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
