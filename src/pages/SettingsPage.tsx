import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { GlyphDownload, GlyphPlus, GlyphTrash, GlyphUpload, IconPeople, IconSettings, IconShift, IconSync } from '../components/icons';
import { Card, Chevron, Empty, Field, uid, useCollapsible } from '../components/ui';
import { listCalendars, type GCalendar } from '../lib/google/calendar';
import { firebaseConfigured, logOut } from '../lib/firebase';
import { CoachCard } from '../components/coach/CoachCard';
import { myRosterDays, ROSTER_SELF } from '../lib/roster';
import { useStore } from '../lib/store/StoreContext';
import { BUILD_TIME, checkForUpdate } from '../lib/update';
import type { Colleague, DayEntry, Settings, ShiftType } from '../lib/types';

/** Sub-list with its own arrow, closed by default (remembered on this device). */
function Group({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const [open, toggle] = useCollapsible(id, false);
  return (
    <div className="group">
      <button type="button" className="side-toggle group-toggle" onClick={toggle} aria-expanded={open}>
        <h3 className="sub">
          {title} <span className="muted">· {count}</span>
        </h3>
        <Chevron open={open} />
      </button>
      {open && children}
    </div>
  );
}

export default function SettingsPage({ userEmail }: { userEmail?: string }) {
  const store = useStore();
  const { settings, gcal } = store;
  const save = (p: Partial<Settings>) => store.saveSettings({ ...settings, ...p });
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [msg, setMsg] = useState<string>();
  const [bulk, setBulk] = useState('');
  const [importing, setImporting] = useState(false);
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

      <Card
        id="settings.roster"
        icon={<IconShift />}
        title="Tabellone di reparto"
        summary={`${myDays} tuoi turni da importare`}
        defaultOpen={false}
      >
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
      </Card>

      <CoachCard />

      <Card
        id="settings.colleagues"
        icon={<IconPeople />}
        title="Colleghi"
        summary={`${settings.colleagues.length} colleghi`}
        defaultOpen={false}
        actions={
          <button className="icon-btn" aria-label="Aggiungi collega" onClick={() => save({ colleagues: [...settings.colleagues, { id: uid(), name: '' }] })}>
            <GlyphPlus />
          </button>
        }
      >
        {settings.colleagues.length === 0 && <Empty>Nessun collega. Aggiungili uno per uno o incolla un elenco qui sotto.</Empty>}
        {[...new Set(settings.colleagues.map((c) => c.role || 'Altri'))].map((role) => {
          const list = settings.colleagues.filter((c) => (c.role || 'Altri') === role);
          return (
            <Group key={role} id={`settings.colleagues.${role}`} title={role} count={list.length}>
              <ul className="list-edit">
                {list.map((c) => (
                  <li key={c.id}>
                    <input className="grow" value={c.name} placeholder="Cognome Nome" onChange={(e) => setColleague({ ...c, name: e.target.value })} />
                    <input value={c.role ?? ''} placeholder="Ruolo" onChange={(e) => setColleague({ ...c, role: e.target.value })} />
                    <button className="icon-btn small" aria-label="Elimina collega" onClick={() => save({ colleagues: settings.colleagues.filter((x) => x.id !== c.id) })}>
                      <GlyphTrash />
                    </button>
                  </li>
                ))}
              </ul>
            </Group>
          );
        })}
        <Field label="Aggiungi più colleghi (uno per riga o separati da virgola)" wide>
          <textarea rows={2} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        </Field>
        <button className="btn-ghost" disabled={!bulk.trim()} onClick={addBulk}>
          <GlyphPlus /> Aggiungi elenco
        </button>
      </Card>

      <Card
        id="settings.shifttypes"
        icon={<IconShift />}
        title="Tipi di turno"
        summary={`${settings.shiftTypes.length} tipi`}
        defaultOpen={false}
        actions={
          <button
            className="icon-btn"
            aria-label="Aggiungi tipo di turno"
            onClick={() => save({ shiftTypes: [...settings.shiftTypes, { id: uid(), name: 'Nuovo turno', start: '08:00', end: '14:00', color: '#b8b2a7', countsAsWork: true, group: 'Altri turni' }] })}
          >
            <GlyphPlus />
          </button>
        }
      >
        <p className="muted small">I tipi del gruppo “Guardia medica” compaiono nella sezione Guardia medica del giorno, gli altri nel turno principale.</p>
        {[...new Set(settings.shiftTypes.map((t) => t.group ?? 'Altri turni'))].map((group) => {
          const list = settings.shiftTypes.filter((t) => (t.group ?? 'Altri turni') === group);
          return (
            <Group key={group} id={`settings.shifttypes.${group}`} title={group} count={list.length}>
              <ul className="list-edit shift-types">
                {list.map((t) => (
                  <li key={t.id}>
                    <input type="color" value={t.color} aria-label="Colore" onChange={(e) => setShiftType({ ...t, color: e.target.value })} />
                    <input className="grow" value={t.name} onChange={(e) => setShiftType({ ...t, name: e.target.value })} />
                    <input type="time" value={t.start} aria-label="Inizio" onChange={(e) => setShiftType({ ...t, start: e.target.value })} />
                    <input type="time" value={t.end} aria-label="Fine" onChange={(e) => setShiftType({ ...t, end: e.target.value })} />
                    <select value={t.group ?? 'Altri turni'} aria-label="Gruppo" onChange={(e) => setShiftType({ ...t, group: e.target.value })}>
                      {[...new Set([...settings.shiftTypes.map((x) => x.group ?? 'Altri turni'), 'Guardia medica'])].map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                    <label className="check">
                      <input type="checkbox" checked={t.countsAsWork} onChange={(e) => setShiftType({ ...t, countsAsWork: e.target.checked })} /> lavoro
                    </label>
                    <button className="icon-btn small" aria-label="Elimina tipo di turno" onClick={() => save({ shiftTypes: settings.shiftTypes.filter((x) => x.id !== t.id) })}>
                      <GlyphTrash />
                    </button>
                  </li>
                ))}
              </ul>
            </Group>
          );
        })}
      </Card>
      <AppVersion />
    </div>
  );
}

/** Version of the app on this device, and a button to fetch the latest one. */
function AppVersion() {
  const [msg, setMsg] = useState<string>();
  return (
    <section className="card app-version">
      <p className="muted small">
        Versione del {BUILD_TIME.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}, ore{' '}
        {BUILD_TIME.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <button
        className="btn-ghost small"
        onClick={async () => {
          setMsg('Controllo…');
          try {
            setMsg((await checkForUpdate()) ? 'Nuova versione trovata: l’app si riavvia da sola tra un attimo.' : 'Hai già l’ultima versione.');
          } catch {
            setMsg('Nessuna connessione: riprova quando sei online.');
          }
        }}
      >
        Cerca aggiornamenti
      </button>
      {msg && <p className="small">{msg}</p>}
      <p className="muted small">
        Dati nutrizionali: CIQUAL 2025 (ANSES, Licence Ouverte Etalab), Open Food Facts (ODbL) e stime per i piatti di mensa e ristorante.
      </p>
    </section>
  );
}
