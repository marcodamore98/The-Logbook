import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sym } from './icons';

interface Ask {
  title: string;
  icon: 'delete' | 'history';
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
    open({ title: `Sei sicuro di voler eliminare${what ? ` ${what}` : ''}?`, icon: 'delete', what, detail: opts.detail, action: opts.action ?? 'Elimina', resolve });
  });
}

/** Same dialog for other actions that change saved data (e.g. "Ripristinare…?"). */
export function confirmAction(title: string, opts: { detail?: string; action: string }): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(title));
    open({ title, icon: 'history', detail: opts.detail, action: opts.action, resolve });
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
              <span className={`confirm-ico ${ask.icon}`} aria-hidden="true">
                <Sym name={ask.icon} size={26} />
              </span>
              <h2 id="confirm-title">{ask.title}</h2>
              {ask.detail && <p>{ask.detail}</p>}
              <div className="confirm-actions">
                <button type="button" className="btn-ghost" autoFocus onClick={() => answer(false)}>
                  Annulla
                </button>
                <button type="button" className={`btn confirm-yes ${ask.icon}`} onClick={() => answer(true)}>
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
