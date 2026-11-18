import { useState } from 'react';
import { confirmAction } from './Confirm';
import { IconGarmin, Sym } from './icons';
import { Card } from './ui';
import { useGarminSync } from './useGarminSync';
import { bridgeCode } from '../lib/garmin/bridge';
import { getToken, normalizeBridge, readConfig, useGarmin, writeConfig, GarminError } from '../lib/garmin/client';

/**
 * Impostazioni → Garmin Connect: the personal key (kept only on this phone), the address of the
 * bridge on Cloudflare, and a step-by-step guide to create both.
 */
export function GarminCard() {
  const st = useGarmin();
  const sync = useGarminSync();
  const cfg = readConfig();
  const [key, setKey] = useState('');
  const [bridge, setBridge] = useState(cfg?.bridge ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [guide, setGuide] = useState(!cfg);
  const [copied, setCopied] = useState(false);
  const code = bridgeCode(window.location.origin);

  const connect = async () => {
    const b = normalizeBridge(bridge);
    if (!key.trim() || !b) return;
    setBusy(true);
    setMsg('');
    const next = { key: key.trim(), bridge: b, seen: cfg?.seen, lastDay: cfg?.lastDay };
    try {
      await getToken(next, true); // checks key and bridge before saving
      writeConfig(next);
      setKey('');
      const r = await sync();
      setMsg(`Collegato. ${r.days === 1 ? 'Aggiornato 1 giorno' : `Aggiornati ${r.days} giorni`}${r.runs ? `, ${r.runs === 1 ? '1 corsa aggiunta' : `${r.runs} corse aggiunte`}` : ''}.`);
      setGuide(false);
    } catch (e) {
      setMsg(e instanceof GarminError ? e.message : `Collegamento non riuscito: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setMsg('Copia non riuscita: tieni premuto sul codice e copialo a mano.');
    }
  };

  return (
    <Card
      id="settings.garmin"
      className="set-card"
      icon={<IconGarmin />}
      title="Garmin Connect"
      sub={
        <span className={`set-status${st.configured && !st.error ? ' on' : ''}`}>
          <i aria-hidden="true" /> {st.configured ? (st.error ? 'Da ricontrollare' : 'Collegato') : 'Non collegato'}
        </span>
      }
      defaultOpen={false}
    >
      <p>
        Dal tuo Garmin arrivano da soli passi, calorie attive, sonno, battito a riposo, HRV, stress, Body Battery, peso e le corse registrate con
        l’orologio. Nei giorni con i dati di Garmin le calorie bruciate sono quelle misurate dall’orologio (al posto della stima dell’app).
      </p>

      {st.configured && cfg ? (
        <>
          <dl className="gm-set">
            <div>
              <dt>Ponte</dt>
              <dd>{cfg.bridge.replace(/^https:\/\//, '')}</dd>
            </div>
            <div>
              <dt>Ultimo aggiornamento</dt>
              <dd>{st.lastSync ? new Date(st.lastSync).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</dd>
            </div>
          </dl>
          {st.error && <p className="error small">{st.error}</p>}
          <div className="gcal-actions">
            <button
              className="gcal-btn sync"
              disabled={st.syncing}
              onClick={async () => {
                setMsg('');
                try {
                  const r = await sync();
                  setMsg(r.days || r.runs ? `Aggiornati ${r.days} giorni${r.runs ? `, ${r.runs} corse aggiunte` : ''}.` : 'Tutto già aggiornato.');
                } catch {
                  /* shown above */
                }
              }}
            >
              <Sym name="sync" size={18} /> {st.syncing ? 'Aggiornamento…' : 'Aggiorna ora'}
            </button>
            <button
              className="gcal-btn off"
              onClick={async () => {
                if (!(await confirmAction('Scollegare Garmin da questo telefono?', { detail: 'La chiave viene tolta dal telefono; i dati già arrivati restano nelle giornate.', action: 'Scollega' }))) return;
                writeConfig(null);
                setMsg('Garmin scollegato.');
                setGuide(true);
              }}
            >
              <Sym name="link_off" size={18} /> Scollega
            </button>
          </div>
          <button
            type="button"
            className="gm-reread"
            onClick={async () => {
              setMsg('');
              try {
                const r = await sync({ fromDays: 28 });
                setMsg(`Riletti gli ultimi 28 giorni: ${r.days} aggiornati${r.runs ? `, ${r.runs} corse aggiunte` : ''}.`);
              } catch {
                /* shown above */
              }
            }}
          >
            Rileggi le ultime 4 settimane
          </button>
          <p className="muted small">Per una chiave nuova (quando scade) scollega e ricollega.</p>
        </>
      ) : (
        <div className="gm-form">
          <label className="field">
            <span className="field-label">Chiave personale di Garmin (Personal API Key)</span>
            <input type="password" autoComplete="off" spellCheck={false} value={key} placeholder="Incolla qui la chiave" onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Indirizzo del ponte</span>
            <input type="url" autoComplete="off" spellCheck={false} value={bridge} placeholder="logbook-garmin.nome.workers.dev" onChange={(e) => setBridge(e.target.value)} />
          </label>
          <p className="muted small">
            <Sym name="key" size={14} /> La chiave resta solo su questo telefono: non va sul cloud né su Google. Su un altro dispositivo va inserita di nuovo.
          </p>
          <button className="btn" disabled={busy || !key.trim() || !bridge.trim()} onClick={connect}>
            {busy ? 'Collegamento…' : 'Collega Garmin'}
          </button>
        </div>
      )}
      {msg && <p className="muted small gm-msg">{msg}</p>}

      <button type="button" className="gm-guide-toggle" aria-expanded={guide} onClick={() => setGuide(!guide)}>
        <Sym name="help" size={18} /> Come si collega {guide ? '▴' : '▾'}
      </button>
      {guide && (
        <ol className="gm-guide">
          <li>
            <strong>La chiave.</strong> Da computer (o dal browser del telefono in versione desktop) apri{' '}
            <a href="https://connect.garmin.com/app/settings/personalApiToken" target="_blank" rel="noreferrer">
              Garmin Connect → Impostazioni → Personal API Key
            </a>
            , crea una chiave con durata <em>1 anno</em> e copiala subito: Garmin la mostra una volta sola.
          </li>
          <li>
            <strong>Il ponte (una volta sola).</strong> Garmin non risponde direttamente alle app web, quindi serve un piccolo passaggio gratuito su
            Cloudflare, che non salva nulla:
            <ol>
              <li>
                Crea un account gratuito su{' '}
                <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer">
                  dash.cloudflare.com
                </a>{' '}
                (non serve la carta).
              </li>
              <li>
                Vai su <em>Compute (Workers) → Workers &amp; Pages → Create → Start with Hello World</em>, chiamalo <em>logbook-garmin</em> e premi{' '}
                <em>Deploy</em>.
              </li>
              <li>
                Premi <em>Edit code</em>, cancella tutto, incolla il codice qui sotto e premi <em>Deploy</em>.
              </li>
              <li>
                Copia l’indirizzo che finisce con <em>.workers.dev</em> e incollalo qui sopra in “Indirizzo del ponte”.
              </li>
            </ol>
          </li>
          <li>
            <strong>Collega.</strong> Incolla la chiave e premi “Collega Garmin”: l’app legge le ultime due settimane e poi si aggiorna da sola ogni
            volta che la apri.
          </li>
          <li className="gm-code-li">
            <div className="gm-code-head">
              <span>Codice del ponte</span>
              <button type="button" className="btn-ghost small" onClick={copy}>
                <Sym name="content_copy" size={16} /> {copied ? 'Copiato' : 'Copia'}
              </button>
            </div>
            <pre className="gm-code">{code}</pre>
          </li>
        </ol>
      )}
    </Card>
  );
}
