import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sym } from './icons';

interface Ask {
  what?: string;
  detail?: string;
  action: string;
  resolve: (ok: boolean) => void;
}

let open: ((a: Ask) => void) | null = null;

/**
 * "Sei sicuro di voler eliminare…?" before anything is deleted (cards, workouts, studies, courses,
 * notes, rows swiped away…). Resolves true when the user confirms.
 */
export function confirmDelete(what?: string, opts: { detail?: string; action?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(`Sei sicuro di voler eliminare${what ? ` ${what}` : ''}?`));
    open({ what, detail: opts.detail, action: opts.action ?? 'Elimina', resolve });
  });
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    open = (a) => setAsk(a);
    return () => {
      open = null;
    };
  }, []);
  const answer = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };
  return (
    <>
      {children}
      {ask &&
        createPortal(
          <div className="sheet-backdrop confirm-backdrop" onClick={() => answer(false)}>
            <div className="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
              <span className="confirm-ico" aria-hidden="true">
                <Sym name="delete" size={26} />
              </span>
              <h2 id="confirm-title">Sei sicuro di voler eliminare{ask.what ? ` ${ask.what}` : ''}?</h2>
              {ask.detail && <p>{ask.detail}</p>}
              <div className="confirm-actions">
                <button type="button" className="btn-ghost" autoFocus onClick={() => answer(false)}>
                  Annulla
                </button>
                <button type="button" className="btn confirm-yes" onClick={() => answer(true)}>
                  {ask.action}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
