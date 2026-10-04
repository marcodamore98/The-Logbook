import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface Offer {
  label: string;
  undo: () => void;
}

const Ctx = createContext<(label: string, undo: () => void) => void>(() => undefined);

/** `offerUndo('Serie eliminata', restore)` shows a snackbar with "Annulla" for a few seconds. */
export const useUndo = () => useContext(Ctx);

/** Snackbar at the bottom, like Gmail or Google Calendar: deletions are reversible instead of asking first. */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [offer, setOffer] = useState<(Offer & { n: number }) | null>(null);
  const timer = useRef(0);
  const n = useRef(0);

  const show = useCallback((label: string, undo: () => void) => {
    window.clearTimeout(timer.current);
    setOffer({ label, undo, n: ++n.current });
    timer.current = window.setTimeout(() => setOffer(null), 5000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {offer && (
        <div key={offer.n} className="snackbar" role="status">
          <i className="snack-dot" aria-hidden="true" />
          <span>{offer.label}</span>
          <button
            type="button"
            onClick={() => {
              window.clearTimeout(timer.current);
              offer.undo();
              setOffer(null);
            }}
          >
            Annulla
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
