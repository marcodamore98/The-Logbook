import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MODULES, metaOf, summarize } from '../components/modules/meta';
import { ModuleEditor } from '../components/modules/editors';
import {
  GlyphClose,
  GlyphNext,
  GlyphPlus,
  GlyphPrev,
  GlyphTrash,
  IconAppointment,
  IconMood,
  IconShift,
  IconTodo,
} from '../components/icons';
import { RosterCard } from '../components/RosterCard';
import { Card, ColleaguePicker, Empty, Field, ShiftTypeSelect, uid } from '../components/ui';
import { CATEGORIES, labelOf } from '../lib/vocab';
import { codeShort, idsForNames, rosterFor, ROSTER_SELF, shiftFromCodes } from '../lib/roster';
import { addDays, formatLong, shiftMinutes, today } from '../lib/dates';
import { eventLocal } from '../lib/google/calendar';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, Module, ModuleKind, ShiftAssignment } from '../lib/types';

const MOODS = ['😣', '😕', '😐', '🙂', '😄'];

export default function DayPage() {
  const params = useParams();
  const date = params.date ?? today();
  const nav = useNavigate();
  const store = useStore();
  const { settings } = store;
  const day = store.day(date);
  const dayRef = useRef(day);
  dayRef.current = day;
  const [adding, setAdding] = useState(false);
  const [search] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(search.get('apri'));

  useEffect(() => {
    store.loadRange(date, date);
  }, [date, store.gcal.connected]);

  const update = (fn: (d: DayEntry) => DayEntry) => store.saveDay(fn(structuredClone(dayRef.current)));

  // ---- Shift ----
  const setShift = (s: ShiftAssignment | undefined) => update((d) => ({ ...d, shift: s }));
  const chooseShiftType = (id: string) => {
    if (!id) return setShift(undefined);
    const t = settings.shiftTypes.find((x) => x.id === id)!;
    setShift({ colleagueIds: [], ...day.shift, shiftTypeId: id, start: t.start, end: t.end });
  };
  const shiftType = settings.shiftTypes.find((t) => t.id === day.shift?.shiftTypeId);
  const myCodes = rosterFor(date)?.residents[ROSTER_SELF] ?? [];
  const suggestion = !day.shift && myCodes.length ? shiftFromCodes(myCodes, date, settings.colleagues) : null;

  // ---- Agenda (appuntamenti + eventi Google) ----
  const gEvents = store.eventsOn(date);
  const agenda = [
    ...day.appointments.map((a) => ({ key: a.id, time: a.start, a })),
    ...gEvents.map((e) => ({ key: e.id, time: eventLocal(e.start).time ?? '00:00', e })),
  ].sort((x, y) => x.time.localeCompare(y.time));

  // ---- Modules ----
  const addModule = (k: ModuleKind) => {
    const m = metaOf(k).create();
    update((d) => ({ ...d, modules: [...d.modules, m] }));
    setOpenId(m.id);
    setAdding(false);
  };
  const setModule = (m: Module) => update((d) => ({ ...d, modules: d.modules.map((x) => (x.id === m.id ? m : x)) }));
  const removeModule = (m: Module) => {
    if (m.kind === 'photos') m.items.forEach((p) => store.repo.deletePhoto(p.path));
    update((d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }));
  };

  const catSelect = (value: string | undefined, onChange: (v: string | undefined) => void) => (
    <select className="cat-select" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Categoria">
      <option value="">Categoria</option>
      {CATEGORIES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
  const openTodos = day.todos.filter((t) => !t.done).length;
  const hours = day.shift && shiftType?.countsAsWork ? Math.round(shiftMinutes(day.shift.start, day.shift.end) / 6) / 10 : 0;

  return (
    <div className="page day-page">
      <header className="page-head">
        <button className="icon-btn" aria-label="Giorno precedente" onClick={() => nav(`/giorno/${addDays(date, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1>{formatLong(date)}</h1>
          {date !== today() && (
            <Link to={`/giorno/${today()}`} className="link-quiet">
              vai a oggi
            </Link>
          )}
        </div>
        <button className="icon-btn" aria-label="Giorno successivo" onClick={() => nav(`/giorno/${addDays(date, 1)}`)}>
          <GlyphNext />
        </button>
      </header>

      <Card
        id="day.shift"
        icon={<IconShift />}
        title="Turno"
        style={shiftType ? ({ '--tint': shiftType.color } as React.CSSProperties) : undefined}
        summary={day.shift ? `${shiftType?.name ?? 'Turno'} · ${day.shift.start}–${day.shift.end}${day.shift.colleagueIds.length ? ` · ${day.shift.colleagueIds.length} colleghi` : ''}` : 'Nessun turno'}
        actions={
          <>
            {hours > 0 && <span className="badge">{hours} h</span>}
            {day.shift?.gcalEventId && (
              <span className="badge badge-sync" title="Sincronizzato con Google Calendar">
                G
              </span>
            )}
          </>
        }
      >
        {suggestion && (
          <div className="suggest">
            <span>
              Dal tabellone: <strong>{myCodes.map(codeShort).join(' · ')}</strong> ({suggestion.start}–{suggestion.end})
            </span>
            <button className="btn small" onClick={() => setShift(suggestion)}>
              Usa
            </button>
          </div>
        )}
        <div className="grid">
          <Field label="Tipo di turno">
            <ShiftTypeSelect types={settings.shiftTypes} value={day.shift?.shiftTypeId} onChange={chooseShiftType} />
          </Field>
          {day.shift && (
            <>
              <Field label="Dalle">
                <input type="time" value={day.shift.start} onChange={(e) => setShift({ ...day.shift!, start: e.target.value })} />
              </Field>
              <Field label="Alle">
                <input type="time" value={day.shift.end} onChange={(e) => setShift({ ...day.shift!, end: e.target.value })} />
              </Field>
              <Field label="Reparto / sede">
                <input value={day.shift.place ?? ''} onChange={(e) => setShift({ ...day.shift!, place: e.target.value })} />
              </Field>
              <div className="field field-wide">
                <span className="field-label">In turno con</span>
                <ColleaguePicker colleagues={settings.colleagues} selected={day.shift.colleagueIds} onChange={(colleagueIds) => setShift({ ...day.shift!, colleagueIds })} />
              </div>
              <Field label="Note sul turno" wide>
                <input value={day.shift.note ?? ''} onChange={(e) => setShift({ ...day.shift!, note: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      </Card>

      <RosterCard
        date={date}
        onJoin={(names) => {
          const base = dayRef.current.shift ?? (myCodes.length ? shiftFromCodes(myCodes, date, settings.colleagues) : null);
          if (!base) return;
          const ids = idsForNames(names, settings.colleagues);
          setShift({ ...base, colleagueIds: [...new Set([...base.colleagueIds, ...ids])] });
        }}
      />

      <div className="two-col">
        <Card
          id="day.agenda"
          icon={<IconAppointment />}
          title="Impegni"
          summary={agenda.length ? `${agenda.length} impegni` : 'Nessuno'}
          actions={
            <button
              className="icon-btn"
              aria-label="Aggiungi impegno"
              onClick={() => update((d) => ({ ...d, appointments: [...d.appointments, { id: uid(), title: '', start: '09:00', end: '10:00' }] }))}
            >
              <GlyphPlus />
            </button>
          }
        >
          {agenda.length === 0 && <Empty>Nessun impegno.</Empty>}
          <ul className="agenda">
            {agenda.map((item) =>
              'a' in item && item.a ? (
                <li key={item.key} className="agenda-row">
                  <input type="time" value={item.a.start} onChange={(e) => update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === item.a!.id ? { ...x, start: e.target.value } : x)) }))} />
                  <input type="time" value={item.a.end} onChange={(e) => update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === item.a!.id ? { ...x, end: e.target.value } : x)) }))} />
                  <input
                    className="grow"
                    value={item.a.title}
                    placeholder="Impegno"
                    onChange={(e) => update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === item.a!.id ? { ...x, title: e.target.value } : x)) }))}
                  />
                  {catSelect(item.a.category, (category) => update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === item.a!.id ? { ...x, category } : x)) })))}
                  {item.a.gcalEventId && (
                    <span className="badge badge-sync" title="Su Google Calendar">
                      G
                    </span>
                  )}
                  <button className="icon-btn small" aria-label="Elimina impegno" onClick={() => update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== item.a!.id) }))}>
                    <GlyphTrash />
                  </button>
                </li>
              ) : (
                <li key={item.key} className="agenda-row gcal">
                  <span className="time">{'e' in item && item.e && (eventLocal(item.e.start).time ?? 'tutto il giorno')}</span>
                  <span className="grow">{'e' in item && item.e?.summary}</span>
                  <span className="badge badge-sync" title="Evento di Google Calendar">
                    G
                  </span>
                </li>
              ),
            )}
          </ul>
        </Card>

        <Card
          id="day.todos"
          icon={<IconTodo />}
          title="Da ricordare"
          summary={day.todos.length ? `${openTodos} da fare su ${day.todos.length}` : 'Niente'}
          actions={
            <button className="icon-btn" aria-label="Aggiungi promemoria" onClick={() => update((d) => ({ ...d, todos: [...d.todos, { id: uid(), text: '', done: false }] }))}>
              <GlyphPlus />
            </button>
          }
        >
          {day.todos.length === 0 && <Empty>Niente da ricordare.</Empty>}
          <ul className="todos">
            {day.todos.map((t) => (
              <li key={t.id} className={`todo${t.done ? ' done' : ''}`}>
                <input type="checkbox" checked={t.done} aria-label="Fatto" onChange={(e) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)) }))} />
                <input className="grow" value={t.text} placeholder="Cosa ricordare…" onChange={(e) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)) }))} />
                {catSelect(t.category, (category) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, category } : x)) })))}
                <input
                  type="time"
                  value={t.time ?? ''}
                  title="Con orario viene aggiunto a Google Calendar"
                  onChange={(e) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, time: e.target.value || undefined } : x)) }))}
                />
                <button className="icon-btn small" aria-label="Elimina" onClick={() => update((d) => ({ ...d, todos: d.todos.filter((x) => x.id !== t.id) }))}>
                  <GlyphTrash />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="modules">
        {day.modules.map((m) => {
          const meta = metaOf(m.kind);
          const open = openId === m.id;
          return (
            <Card
              key={m.id}
              id={`module.${m.id}`}
              className={`module module-${m.kind}`}
              icon={<meta.Icon />}
              title={meta.label}
              summary={summarize(m)}
              open={open}
              onToggle={() => setOpenId(open ? null : m.id)}
              actions={
                <>
                  {m.kind === 'note' && !open && m.category && <span className="badge">{labelOf(CATEGORIES, m.category)}</span>}
                  <button className="icon-btn small" aria-label="Elimina scheda" onClick={() => window.confirm(`Eliminare la scheda “${meta.label}”?`) && removeModule(m)}>
                    <GlyphTrash />
                  </button>
                </>
              }
            >
              <ModuleEditor value={m} onChange={setModule} date={date} />
            </Card>
          );
        })}
      </div>

      <Card
        id="day.mood"
        className="mood-card"
        icon={<IconMood />}
        title="Com’è andata"
        summary={day.mood ? MOODS[day.mood - 1] : undefined}
      >
        <div className="moods" role="radiogroup" aria-label="Umore della giornata">
          {MOODS.map((e, i) => (
            <button key={i} role="radio" aria-checked={day.mood === i + 1} className={`mood${day.mood === i + 1 ? ' on' : ''}`} onClick={() => update((d) => ({ ...d, mood: d.mood === i + 1 ? undefined : i + 1 }))}>
              {e}
            </button>
          ))}
        </div>
      </Card>

      {adding ? (
        <div className="palette" role="dialog" aria-label="Aggiungi scheda">
          <div className="palette-head">
            <h2>Aggiungi una scheda</h2>
            <button className="icon-btn" aria-label="Chiudi" onClick={() => setAdding(false)}>
              <GlyphClose />
            </button>
          </div>
          {(['lavoro', 'personale'] as const).map((area) => (
            <div key={area}>
              <h3 className="palette-area">{area === 'lavoro' ? 'Lavoro' : 'Vita privata'}</h3>
              <div className="palette-grid">
                {MODULES.filter((m) => m.area === area).map((m) => (
                  <button key={m.kind} className="palette-item" onClick={() => addModule(m.kind)}>
                    <m.Icon size={48} />
                    <span className="palette-label">{m.label}</span>
                    <span className="palette-hint">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button className="btn-add" onClick={() => setAdding(true)}>
          <GlyphPlus /> Aggiungi scheda
        </button>
      )}
    </div>
  );
}
