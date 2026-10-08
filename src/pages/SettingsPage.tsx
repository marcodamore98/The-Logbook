import { confirmDelete } from '../components/Confirm';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { GlyphDownload, GlyphPlus, GlyphTrash, GlyphUpload, IconPeople, IconSettings, IconShift, IconSync } from '../components/icons';
import { Card, Chevron, Empty, Field, uid, useCollapsible } from '../components/ui';
import { listCalendars, type GCalendar } from '../lib/google/calendar';
import { firebaseConfigured, logOut } from '../lib/firebase';
import { CoachCard } from '../components/coach/CoachCard';
import { DuplicateCleaner } from '../components/DuplicateCleaner';
import { Sym } from '../components/icons';
import { myRosterDays, ROSTER_SELF } from '../lib/roster';
import { useStore } from '../lib/store/StoreContext';
import { TimeField } from '../components/WheelPicker';
import { BUILD_TIME, checkForUpdate } from '../lib/update';
import type { Colleague, DayEntry, Settings, ShiftType } from '../lib/types';

/** Sub-list with its own arrow, closed by default (remembered on this device). */
const GROUP_DOTS = ['var(--lime)', 'var(--lavender)', 'var(--terra)', 'var(--sky)', 'var(--sage)', 'var(--plum)'];

function Group({ id, title, count, preview, unit = '', index = 0, children }: { id: string; title: string; count: number; preview?: string; unit?: string; index?: number; children: React.ReactNode }) {
  const [open, toggle] = useCollapsible(id, false);
  return (
    <div className={`group set-group${open ? ' open' : ''}`}>
      <button type="button" className="set-group-head" onClick={toggle} aria-expanded={open}>
        <span className="sg-top">
          <i style={{ background: GROUP_DOTS[index % GROUP_DOTS.length] }} aria-hidden="true" />
          <strong>{title}</strong>
          <span className="sg-count">
            {count}
            {unit ? ` ${unit}` : ''}
          </span>
        </span>
        {!open && preview && <span className="sg-preview">{preview}</span>}
        <Chevron open={open} />
      </button>
      {open && <div className="set-group-body">{children}</div>}
    </div>
  );
}

/** A shift type as one line (colour dot, name, group, times); tap it to edit. */
function ShiftTypeRow({ t, children }: { t: ShiftType; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`st-row${open ? ' open' : ''}`}>
      <button type="button" className="st-line" aria-expanded={open} onClick={() => setOpen(!open)}>
        <i style={{ background: t.color }} aria-hidden="true" />
        <span className="st-name">
          <strong>{t.name || 'Senza nome'}</strong>
          <small>{t.countsAsWork ? 'conta come lavoro' : 'non conta come lavoro'}</small>
        </span>
        <span className="st-time">
          {t.start === t.end && t.start === '00:00' ? 'Tutto il giorno' : `${t.start} – ${t.end}`}
        </span>
      </button>
      {open && <div className="st-edit">{children}</div>}
    </li>
  );
}

export default function SettingsPage({ userEmail }: { userEmail?: string }) {
  const store = useStore();
  const { settings, gcal } = store;
  const save = (p: Partial<Settings>) => store.saveSettings({ ...settings, ...p });
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [msg, setMsg] = useState<string>();
  const [dups, setDups] = useState(false);
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

      <Card id="settings.account" className="set-card" icon={<IconSettings />} title="Account e dati" sub={firebaseConfigured ? 'Sincronizzazione cloud · backup' : 'Solo su questo dispositivo · backup'}>
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
        <Link className="btn-ghost history-link" to="/cronologia">
          <Sym name="history" size={20} /> Cronologia delle modifiche
          <small>versioni precedenti delle giornate, per rimettere ciò che è sparito</small>
        </Link>
        {msg && !msg.startsWith('Turni importati') && <p className="muted small">{msg}</p>}
      </Card>

      <Card
        id="settings.gcal"
        className="set-card"
        icon={<IconSync />}
        title="Google Calendar"
        sub={
          <span className={`set-status${gcal.connected ? ' on' : ''}`}>
            <i aria-hidden="true" /> {gcal.connected ? 'Collegato e sincronizzato' : 'Non collegato'}
          </span>
        }
      >
        {!gcal.configured ? (
          <p className="muted">Manca VITE_GOOGLE_CLIENT_ID: segui la sezione “Google Calendar” del README.</p>
        ) : !gcal.connected ? (
          <>
            <p>Collega il tuo account: turni, guardie, impegni, promemoria con orario, corsi, congressi, viaggi e uscite vanno sul calendario, e le modifiche fatte su Google (orari, durate, date, eliminazioni, nuovi eventi) tornano qui, senza doppioni.</p>
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
            <button className="btn-ghost field-wide dup-open" onClick={() => setDups(true)}>
              <Sym name="search" size={20} /> Cerca e togli i doppioni
            </button>
            {dups && <DuplicateCleaner onClose={() => setDups(false)} />}
          </div>
        )}
        {gcal.error && <p className="error small">{gcal.error}</p>}
      </Card>

      <Card
        id="settings.roster"
        icon={<IconShift />}
        className="set-card"
        title="Tabellone di reparto"
        sub={`${myDays} tuoi turni da importare`}
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
        className="set-card"
        title="Colleghi"
        sub={`${settings.colleagues.length} colleghi · per ruolo`}
        defaultOpen={false}
        actions={
          <button className="icon-btn" aria-label="Aggiungi collega" onClick={() => save({ colleagues: [...settings.colleagues, { id: uid(), name: '' }] })}>
            <GlyphPlus />
          </button>
        }
      >
        {settings.colleagues.length === 0 && <Empty>Nessun collega. Aggiungili uno per uno o incolla un elenco qui sotto.</Empty>}
        {[...new Set(settings.colleagues.map((c) => c.role || 'Altri'))].map((role, gi) => {
          const list = settings.colleagues.filter((c) => (c.role || 'Altri') === role);
          const names = list.map((c) => c.name).filter(Boolean);
          const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
          return (
            <Group key={role} id={`settings.colleagues.${role}`} title={role} count={list.length} unit={list.length === 1 ? 'collega' : 'colleghi'} preview={preview} index={gi}>
              <ul className="list-edit">
                {list.map((c) => (
                  <li key={c.id}>
                    <input className="grow" value={c.name} placeholder="Cognome Nome" onChange={(e) => setColleague({ ...c, name: e.target.value })} />
                    <input value={c.role ?? ''} placeholder="Ruolo" onChange={(e) => setColleague({ ...c, role: e.target.value })} />
                    <button className="icon-btn small" aria-label="Elimina collega" onClick={async () => (await confirmDelete(`“${c.name || 'questo collega'}”`)) && save({ colleagues: settings.colleagues.filter((x) => x.id !== c.id) })}>
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
        className="set-card"
        title="Tipi di turno"
        sub={`${settings.shiftTypes.length} tipi · colori e orari`}
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
        {[...new Set(settings.shiftTypes.map((t) => t.group ?? 'Altri turni'))].map((group, gi) => {
          const list = settings.shiftTypes.filter((t) => (t.group ?? 'Altri turni') === group);
          return (
            <Group key={group} id={`settings.shifttypes.${group}`} title={group} count={list.length} unit={list.length === 1 ? 'tipo' : 'tipi'} preview={list.slice(0, 3).map((t) => t.name).join(', ')} index={gi + 1}>
              <ul className="list-edit shift-types">
                {list.map((t) => (
                  <ShiftTypeRow key={t.id} t={t}>
                    <input type="color" value={t.color} aria-label="Colore" onChange={(e) => setShiftType({ ...t, color: e.target.value })} />
                    <input className="grow" value={t.name} onChange={(e) => setShiftType({ ...t, name: e.target.value })} />
                    <TimeField label={`${t.name}: inizio`} className="compact" value={t.start} onChange={(v) => v && setShiftType({ ...t, start: v })} />
                    <TimeField label={`${t.name}: fine`} className="compact" value={t.end} onChange={(v) => v && setShiftType({ ...t, end: v })} />
                    <select value={t.group ?? 'Altri turni'} aria-label="Gruppo" onChange={(e) => setShiftType({ ...t, group: e.target.value })}>
                      {[...new Set([...settings.shiftTypes.map((x) => x.group ?? 'Altri turni'), 'Guardia medica'])].map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                    <label className="check">
                      <input type="checkbox" checked={t.countsAsWork} onChange={(e) => setShiftType({ ...t, countsAsWork: e.target.checked })} /> lavoro
                    </label>
                    <button className="icon-btn small" aria-label="Elimina tipo di turno" onClick={async () => (await confirmDelete(`il tipo di turno “${t.name}”`)) && save({ shiftTypes: settings.shiftTypes.filter((x) => x.id !== t.id) })}>
                      <GlyphTrash />
                    </button>
                  </ShiftTypeRow>
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
