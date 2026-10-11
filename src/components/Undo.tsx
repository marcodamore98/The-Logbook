import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface Offer {
  label: string;
  undo: () => void;
}

const Ctx = createContext<(label: string, undo: () => void, ms?: number) => void>(() => undefined);

/** `offerUndo('Serie eliminata', restore)` shows a snackbar with "Annulla" for a few seconds. */
export const useUndo = () => useContext(Ctx);

/** Snackbar at the bottom, like Gmail or Google Calendar: deletions are reversible instead of asking first. */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [offer, setOffer] = useState<(Offer & { n: number; until: number }) | null>(null);
  const [, tick] = useState(0);
  const timer = useRef(0);
  const n = useRef(0);

  const show = useCallback((label: string, undo: () => void, ms = 5000) => {
    window.clearTimeout(timer.current);
    setOffer({ label, undo, n: ++n.current, until: Date.now() + ms });
    timer.current = window.setTimeout(() => setOffer(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // The seconds left on "Annulla" count down.
  useEffect(() => {
    if (!offer) return;
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [offer]);

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
            Annulla <small>({Math.max(1, Math.ceil((offer.until - Date.now()) / 1000))}s)</small>
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
