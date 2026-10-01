import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import instructions from '../../../docs/personal-trainer-claude.md?raw';
import { applyProgram, exportForCoach, extractJson } from '../../lib/coach';
import { useStore } from '../../lib/store/StoreContext';
import { GlyphDownload, GlyphUpload, IconWorkout } from '../icons';
import { Card, uid } from '../ui';

const projectText = instructions.split('\n---\n').slice(1).join('\n---\n').trim();

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Import programs written by a Claude Project and export data for it. */
export function CoachCard() {
  const store = useStore();
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ summary: string[]; warnings: string[] } | null>(null);
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const loc = useLocation();
  const [open, setOpen] = useState(loc.hash === '#personal-trainer');

  function importText(t: string) {
    setErr(undefined);
    setResult(null);
    try {
      const r = applyProgram(extractJson(t), store.settings, uid);
      store.saveSettings(r.settings);
      setResult(r);
      setText('');
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    store.ensureAllLoaded();
  }, [store]);

  return (
    <div id="personal-trainer">
    <Card
      id="settings.coach"
      className="coach"
      icon={<IconWorkout />}
      title="Personal trainer (Progetto Claude)"
      summary="Importa programmi di allenamento e dieta"
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <ol className="steps">
        <li>
          Su claude.ai crea un <strong>Progetto</strong> (es. “Personal trainer”) e incolla nelle sue istruzioni il testo qui sotto.
          <div className="row">
            <button className="btn-ghost small" onClick={async () => setMsg((await copy(projectText)) ? 'Istruzioni copiate: incollale nel Progetto.' : 'Copia non riuscita: seleziona il testo a mano.')}>
              Copia istruzioni
            </button>
          </div>
          <details>
            <summary className="muted small">Mostra il testo</summary>
            <textarea className="mono" rows={8} readOnly value={projectText} onFocus={(e) => e.currentTarget.select()} />
          </details>
        </li>
        <li>
          Ogni tanto esporta i tuoi dati e incollali (o allega il file) nella chat del Progetto, così il trainer vede allenamenti, pasti, peso e turni.
          <div className="row">
            <button
              className="btn-ghost small"
              onClick={async () => {
                const data = JSON.stringify(exportForCoach(store.allDays, store.settings), null, 1);
                const ok = await copy(data);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
                a.download = `logbook-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
                setMsg(ok ? 'Dati delle ultime 4 settimane copiati e scaricati.' : 'File scaricato: allegalo nella chat del Progetto.');
              }}
            >
              <GlyphDownload /> Esporta i miei dati (4 settimane)
            </button>
          </div>
        </li>
        <li>
          Quando il trainer ti risponde con un programma, copia la sua risposta (anche intera) e incollala qui.
          <textarea rows={5} value={text} placeholder="Incolla qui la risposta di Claude con il blocco JSON…" onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <button className="btn" disabled={!text.trim()} onClick={() => importText(text)}>
              <GlyphUpload /> Importa programma
            </button>
            <button className="btn-ghost small" onClick={() => file.current?.click()}>
              oppure carica un file .json
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,.txt,application/json,text/plain"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) importText(await f.text());
              }}
            />
          </div>
        </li>
      </ol>
      {msg && <p className="muted small">{msg}</p>}
      {err && <p className="error small">{err}</p>}
      {result && (
        <div className="import-result">
          <strong>Importato:</strong>
          <ul>
            {result.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {result.warnings.length > 0 && (
            <>
              <strong>Da controllare:</strong>
              <ul className="muted">
                {result.warnings.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <p className="small">Le schede sono in Palestra → Schede; i piani alimentari si applicano dalla pagina Alimentazione.</p>
        </div>
      )}
    </Card>
    </div>
  );
}
