import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { GlyphDownload, GlyphPlus, GlyphTrash, GlyphUpload, IconPeople, IconSettings, IconShift, IconSync, IconWorkout } from '../components/icons';
import { Empty, Field, uid } from '../components/ui';
import { listCalendars, type GCalendar } from '../lib/google/calendar';
import { firebaseConfigured, logOut } from '../lib/firebase';
import { CoachCard } from '../components/coach/CoachCard';
import { parseHevyCsv } from '../lib/hevy';
import { myRosterDays, ROSTER_SELF } from '../lib/roster';
import { useStore } from '../lib/store/StoreContext';
import type { Colleague, DayEntry, Settings, ShiftType } from '../lib/types';

export default function SettingsPage({ userEmail }: { userEmail?: string }) {
  const store = useStore();
  const { settings, gcal } = store;
  const save = (p: Partial<Settings>) => store.saveSettings({ ...settings, ...p });
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [msg, setMsg] = useState<string>();
  const [bulk, setBulk] = useState('');
  const [importing, setImporting] = useState(false);
  const [hevyMsg, setHevyMsg] = useState<string>();
  const hevyFile = useRef<HTMLInputElement>(null);
  const myDays = myRosterDays().length;
  const file = useRef<HTMLInputElement>(null);

  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loc.hash]);

  useEffect(() => {
    if (gcal.connected) listCalendars().then(setCalendars).catch(() => setCalendars([]));
  }, [gcal.connected]);

  const setColleague = (c: Colleague) => save({ colleagues: settings.colleagues.map((x) => (x.id === c.id ? c : x)) });
  const setShiftType = (t: ShiftType) => save({ shiftTypes: settings.shiftTypes.map((x) => (x.id === t.id ? t : x)) });

  function addBulk() {
    const names = bulk.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
    const existing = new Set(settings.colleagues.map((c) => c.name.toLowerCase()));
    const add = names.filter((n) => !existing.has(n.toLowerCase())).map((name) => ({ id: uid(), name }));
    save({ colleagues: [...settings.colleagues, ...add].sort((a, b) => a.name.localeCompare(b.name, 'it')) });
    setBulk('');
  }

  async function exportJson() {
    const days = await store.loadAll();
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, days }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as { settings?: Settings; days?: DayEntry[] };
      if (data.settings) store.saveSettings(data.settings);
      for (const d of data.days ?? []) await store.repo.saveDay(d);
      setMsg(`Importati ${data.days?.length ?? 0} giorni.`);
    } catch (e) {
      setMsg(`Import non riuscito: ${e}`);
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div className="page-title">
          <h1>Impostazioni</h1>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <IconSettings />
          <h2>Account e dati</h2>
        </div>
        {firebaseConfigured ? (
          <p>
            Sincronizzazione cloud attiva{userEmail ? ` come ${userEmail}` : ''}. I dati restano disponibili offline e si sincronizzano appena torni online.{' '}
            <button className="btn-ghost small" onClick={() => logOut()}>
              Esci
            </button>
          </p>
        ) : (
          <p className="muted">
            Modalità locale: i dati sono salvati solo su questo dispositivo. Configura Firebase (vedi README) per sincronizzarli tra telefono e computer.
          </p>
        )}
        <div className="row">
          <button className="btn-ghost" onClick={exportJson}>
            <GlyphDownload /> Esporta backup
          </button>
          <button className="btn-ghost" onClick={() => file.current?.click()}>
            <GlyphUpload /> Importa backup
          </button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
        </div>
        {msg && !msg.startsWith('Turni importati') && <p className="muted small">{msg}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <IconSync />
          <h2>Google Calendar</h2>
          {gcal.connected && <span className="badge badge-sync">collegato</span>}
        </div>
        {!gcal.configured ? (
          <p className="muted">Manca VITE_GOOGLE_CLIENT_ID: segui la sezione “Google Calendar” del README.</p>
        ) : !gcal.connected ? (
          <>
            <p>Collega il tuo account per vedere gli eventi di Google nel logbook e salvare turni, impegni e promemoria con orario sul calendario.</p>
            <button className="btn" onClick={store.connectGoogle}>
              Collega Google Calendar
            </button>
          </>
        ) : (
          <div className="grid">
            <Field label="Calendario su cui scrivere turni e impegni" wide>
              <select value={settings.gcal.calendarId} onChange={(e) => save({ gcal: { ...settings.gcal, calendarId: e.target.value } })}>
                <option value="primary">Principale</option>
                {calendars
                  .filter((c) => !c.primary && ['owner', 'writer'].includes(c.accessRole))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="field field-wide">
              <span className="field-label">Calendari da mostrare</span>
              <div className="chips">
                {calendars.map((c) => {
                  const id = c.primary ? 'primary' : c.id;
                  const on = settings.gcal.readCalendarIds.includes(id);
                  return (
                    <button
                      key={c.id}
                      className={`chip${on ? ' chip-on' : ''}`}
                      aria-pressed={on}
                      onClick={() =>
                        save({
                          gcal: {
                            ...settings.gcal,
                            readCalendarIds: on ? settings.gcal.readCalendarIds.filter((x) => x !== id) : [...settings.gcal.readCalendarIds, id],
                          },
                        })
                      }
                    >
                      <span className="dot" style={{ background: c.backgroundColor }} /> {c.primary ? 'Principale' : c.summary}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="row field-wide">
              <button
                className="btn-ghost"
                disabled={gcal.syncing}
                onClick={async () => setMsg(`Sincronizzati ${await store.syncAll()} giorni con Google Calendar.`)}
              >
                <IconSync size={22} /> Sincronizza elementi in sospeso
              </button>
              <button className="btn-ghost" onClick={store.disconnectGoogle}>
                Scollega
              </button>
            </div>
          </div>
        )}
        {gcal.error && <p className="error small">{gcal.error}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <IconShift />
          <h2>Tabellone di reparto</h2>
        </div>
        <p>
          Contiene i turni di ottobre 2026 di specializzandi e strutturati. Ogni pagina giorno mostra chi fa cosa; qui puoi copiare i tuoi turni
          ({ROSTER_SELF}, {myDays} giorni) nel logbook, con i colleghi che fanno la stessa attività. I giorni in cui hai già inserito un turno non
          vengono toccati{gcal.connected ? ' e i nuovi turni vengono aggiunti a Google Calendar' : ''}.
        </p>
        <div className="row">
          <button
            className="btn"
            disabled={importing}
            onClick={async () => {
              setImporting(true);
              const r = await store.importRoster();
              setImporting(false);
              setMsg(`Turni importati: ${r.added}. Giorni lasciati invariati: ${r.kept}.`);
            }}
          >
            {importing ? 'Importazione…' : 'Importa i miei turni'}
          </button>
        </div>
        {msg?.startsWith('Turni importati') && <p className="muted small">{msg}</p>}
      </section>

      <CoachCard />

      <section className="card">
        <div className="card-head">
          <IconWorkout />
          <h2>Allenamenti da Hevy</h2>
        </div>
        <p>
          In Hevy apri <strong>Profilo → ⚙ Impostazioni → Esporta e importa dati → Esporta allenamenti</strong> e carica qui il file CSV. Ogni allenamento
          diventa una scheda nel giorno giusto, con esercizi, serie e carichi; il tipo (Push / Pull / Legs) è ricavato dal nome della routine. Puoi
          reimportare quando vuoi: gli allenamenti già presenti vengono aggiornati, non duplicati.
        </p>
        <div className="row">
          <button className="btn" disabled={importing} onClick={() => hevyFile.current?.click()}>
            Carica CSV di Hevy
          </button>
          <input
            ref={hevyFile}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setImporting(true);
              try {
                const list = parseHevyCsv(await f.text());
                const r = await store.importWorkouts(list);
                setHevyMsg(`Allenamenti importati: ${r.added} nuovi, ${r.updated} aggiornati.`);
              } catch (err) {
                setHevyMsg(String(err instanceof Error ? err.message : err));
              } finally {
                setImporting(false);
              }
            }}
          />
        </div>
        {hevyMsg && <p className="muted small">{hevyMsg}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <IconPeople />
          <h2>Colleghi</h2>
          <button className="icon-btn" aria-label="Aggiungi collega" onClick={() => save({ colleagues: [...settings.colleagues, { id: uid(), name: '' }] })}>
            <GlyphPlus />
          </button>
        </div>
        {settings.colleagues.length === 0 && <Empty>Nessun collega. Aggiungili uno per uno o incolla un elenco qui sotto.</Empty>}
        <ul className="list-edit">
          {settings.colleagues.map((c) => (
            <li key={c.id}>
              <input className="grow" value={c.name} placeholder="Cognome Nome" onChange={(e) => setColleague({ ...c, name: e.target.value })} />
              <input value={c.role ?? ''} placeholder="Ruolo" onChange={(e) => setColleague({ ...c, role: e.target.value })} />
              <button className="icon-btn small" aria-label="Elimina collega" onClick={() => save({ colleagues: settings.colleagues.filter((x) => x.id !== c.id) })}>
                <GlyphTrash />
              </button>
            </li>
          ))}
        </ul>
        <Field label="Aggiungi più colleghi (uno per riga o separati da virgola)" wide>
          <textarea rows={2} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        </Field>
        <button className="btn-ghost" disabled={!bulk.trim()} onClick={addBulk}>
          <GlyphPlus /> Aggiungi elenco
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <IconShift />
          <h2>Tipi di turno</h2>
          <button
            className="icon-btn"
            aria-label="Aggiungi tipo di turno"
            onClick={() => save({ shiftTypes: [...settings.shiftTypes, { id: uid(), name: 'Nuovo turno', start: '08:00', end: '14:00', color: '#b8b2a7', countsAsWork: true }] })}
          >
            <GlyphPlus />
          </button>
        </div>
        <ul className="list-edit shift-types">
          {settings.shiftTypes.map((t) => (
            <li key={t.id}>
              <input type="color" value={t.color} aria-label="Colore" onChange={(e) => setShiftType({ ...t, color: e.target.value })} />
              <input className="grow" value={t.name} onChange={(e) => setShiftType({ ...t, name: e.target.value })} />
              <input type="time" value={t.start} aria-label="Inizio" onChange={(e) => setShiftType({ ...t, start: e.target.value })} />
              <input type="time" value={t.end} aria-label="Fine" onChange={(e) => setShiftType({ ...t, end: e.target.value })} />
              <label className="check">
                <input type="checkbox" checked={t.countsAsWork} onChange={(e) => setShiftType({ ...t, countsAsWork: e.target.checked })} /> lavoro
              </label>
              <button className="icon-btn small" aria-label="Elimina tipo di turno" onClick={() => save({ shiftTypes: settings.shiftTypes.filter((x) => x.id !== t.id) })}>
                <GlyphTrash />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
