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
  IconNote,
  IconSleep,
  IconSteps,
  IconWater,
  IconShift,
  IconTodo,
  Sym,
} from '../components/icons';
import { RosterCard } from '../components/RosterCard';
import { NutritionBlock, TrainingBlock } from '../components/day/DayBlocks';
import { DiaryEntryView } from '../components/diary/DiaryEntry';
import { TimeField } from '../components/WheelPicker';
import { ShoppingList } from '../components/day/ShoppingList';
import { useUndo } from '../components/Undo';
import { useBlockDrag, useSortableList } from '../components/useBlockDrag';
import { useSwipeNav } from '../components/useSwipeNav';
import { Card, CardDecor, ColleaguePicker, DragGrip, Empty, ShiftTypeSelect, TimeTile, uid } from '../components/ui';
import { PrintButton } from '../components/PrintDialog';
import { openFile, programOf } from '../components/files/FileSlot';
import { mapsUrl, webUrl } from '../lib/links';
import { rangeLabel } from '../components/modules/meta';
import { GlyphClip } from '../components/icons';
import { fmt } from '../components/charts';
import { blockOrder, DAY_BLOCKS, MODULE_BLOCK } from '../lib/dayLayout';
import { CATEGORIES } from '../lib/vocab';
import { codeShort, idsForNames, rosterFor, ROSTER_SELF, shiftFromCodes } from '../lib/roster';
import { addDays, formatLong, isoWeek, today } from '../lib/dates';
import { diaryOf, withDiary } from '../lib/diary';
import { eventLocal } from '../lib/google/calendar';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, FileRef, Module, ModuleKind, ShiftAssignment } from '../lib/types';
import { clinicalTotals, surgeryTotals } from '../lib/worklog';

/** Cards that can be added by hand; training, food and the diary have their own sections. */
/** Small label above each card title, by block. */
const BLOCK_KICKER: Record<string, string> = {
  shift: 'Lavoro',
  guardia: 'Lavoro',
  work: 'Lavoro',
  agenda: 'Agenda',
  todos: 'Agenda',
  training: 'Sport',
  nutrition: 'Salute',
  private: 'Tempo libero',
  diary: 'Personale',
};
const DAY_PRINT = [
  { id: 'lavoro', label: 'Lavoro' },
  { id: 'agenda', label: 'Impegni e promemoria' },
  { id: 'palestra', label: 'Allenamento' },
  { id: 'alimentazione', label: 'Alimentazione' },
  { id: 'privato', label: 'Viaggi e uscite' },
  { id: 'diario', label: 'Diario' },
];
const KIND_KICKER: Partial<Record<ModuleKind, string>> = { study: 'Formazione', course: 'Formazione' };

const ADDABLE: ModuleKind[] = ['surgery', 'study', 'travel'];
/** Entries that stand for two kinds of card: you pick the exact one inside the card. */
const MERGED: Partial<Record<ModuleKind, { label: string; hint: string }>> = {
  surgery: { label: 'Attività chirurgica e clinica', hint: 'Interventi, ambulatorio, ecografie, PS, sala parto' },
  study: { label: 'Studio, corsi e congressi', hint: 'Articoli, linee guida, corsi, congressi, webinar' },
  travel: { label: 'Viaggi e uscite', hint: 'Viaggi di più giorni, gite, cene, eventi' },
};

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
  const [ordering, setOrdering] = useState(false);
  const [search] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(search.get('apri'));

  useEffect(() => {
    store.loadRange(date, date);
  }, [date, store.gcal.connected]);

  const update = (fn: (d: DayEntry) => DayEntry) => store.saveDay(fn(structuredClone(dayRef.current)));

  // ---- Shift ----
  const setShift = (s: ShiftAssignment | undefined) => update((d) => ({ ...d, shift: s }));
  const setGuardia = (s: ShiftAssignment | undefined) => update((d) => ({ ...d, guardia: s }));
  const guardiaTypes = settings.shiftTypes.filter((t) => t.group === 'Guardia medica');
  const chooseGuardia = (id: string) => {
    if (!id) return setGuardia(undefined);
    const t = settings.shiftTypes.find((x) => x.id === id)!;
    setGuardia({ colleagueIds: [], ...day.guardia, shiftTypeId: id, start: t.start, end: t.end });
  };
  const chooseShiftType = (id: string) => {
    if (!id) return setShift(undefined);
    const t = settings.shiftTypes.find((x) => x.id === id)!;
    setShift({ colleagueIds: [], ...day.shift, shiftTypeId: id, start: t.start, end: t.end });
  };
  const addShift = () => {
    const t = settings.shiftTypes.find((x) => x.group !== 'Guardia medica');
    if (suggestion) setShift(suggestion);
    else if (t) chooseShiftType(t.id);
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
    const m = metaOf(k).create(date);
    update((d) => ({ ...d, modules: [...d.modules, m] }));
    setAdding(false);
    // Workouts are logged on their own page; the day keeps a summary.
    if (k === 'workout') nav(`/palestra/allenamento/${date}/${m.id}`);
    else setOpenId(m.id);
  };
  const setModule = (m: Module) => update((d) => ({ ...d, modules: d.modules.map((x) => (x.id === m.id ? m : x)) }));
  const offerUndo = useUndo();
  /** Removes a card; "Annulla" in the snackbar puts it back. Attached files go only once that chance is over. */
  const removeModule = (m: Module) => {
    const index = dayRef.current.modules.findIndex((x) => x.id === m.id);
    update((d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }));
    let undone = false;
    offerUndo(`Eliminata: ${metaOf(m.kind).label}`, () => {
      undone = true;
      update((d) => ({ ...d, modules: [...d.modules.slice(0, index), m, ...d.modules.slice(index)] }));
    });
    window.setTimeout(() => {
      if (undone) return;
      if (m.kind === 'photos') m.items.forEach((p) => store.repo.deletePhoto(p.path));
      if (m.kind === 'course') {
        programOf(m).forEach((f) => store.repo.deleteFile(f.path));
        store.repo.deleteFile(m.certificate?.path);
      }
    }, 6500);
  };
  const removeShift = (which: 'shift' | 'guardia') => {
    const before = dayRef.current[which];
    update((d) => ({ ...d, [which]: undefined }));
    offerUndo(which === 'shift' ? 'Turno eliminato' : 'Guardia medica eliminata', () => update((d) => ({ ...d, [which]: before })));
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
  const toBuy = (settings.shopping ?? []).filter((i) => !i.done);
  // "Da ricordare" shows either the day's reminders or the shopping list; the choice is remembered.
  const [todoTab, setTodoTab] = useState<'todos' | 'shop'>(() => {
    try {
      return localStorage.getItem('logbook:todo-tab') === 'shop' ? 'shop' : 'todos';
    } catch {
      return 'todos';
    }
  });
  const pickTodoTab = (t: 'todos' | 'shop') => {
    setTodoTab(t);
    try {
      localStorage.setItem('logbook:todo-tab', t);
    } catch {
      /* private mode */
    }
  };
  const [shopAdd, setShopAdd] = useState(0);

  // Hold and drag: reminders in "Da ricordare" and the sections in "Ordina le sezioni".
  const todoSort = useSortableList(day.todos, (todos) => update((d) => ({ ...d, todos })), { attr: 'todo', handle: '.todo' });
  const shiftName = settings.shiftTypes.find((t) => t.id === day.shift?.shiftTypeId)?.name ?? 'Turno';
  const who = day.shift ? day.shift.colleagueIds.map((c) => settings.colleagues.find((x) => x.id === c)?.name).filter(Boolean).slice(0, 3).join(', ') : '';
  const shiftSummary = day.shift
    ? `${shiftName} · ${day.shift.start}–${day.shift.end}${who ? ` · con ${who}` : ''}`
    : suggestion
      ? `Dal tabellone: ${myCodes.map(codeShort).join(' · ')}`
      : 'Nessun turno';
  const order = blockOrder(settings.dayLayout);
  const orderSort = useSortableList(order, (o) => store.saveSettings({ ...settings, dayLayout: o }), { attr: 'ord', handle: '.order-list li' });
  // "Domenica 4 ottobre": the year only when it isn't the current one.
  const longDate = formatLong(date).replace(new RegExp(` ${today().slice(0, 4)}$`), '');
  const dayTitle = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const dayShifts = [day.shift && `${shiftName} ${day.shift.start}–${day.shift.end}`, day.guardia && `Guardia ${day.guardia.start}–${day.guardia.end}`].filter((x): x is string => !!x);

  // Courses and trips that began on another day but cover this one.
  // Loading the whole archive is not urgent: do it once the page is idle.
  useEffect(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = ric ? ric(() => store.ensureAllLoaded()) : window.setTimeout(() => store.ensureAllLoaded(), 1200);
    return () => {
      if (!ric) window.clearTimeout(id);
    };
  }, []);
  const spanning = store.allDays
    .filter((d) => d.date !== date)
    .flatMap((d) => d.modules.filter((m): m is Extract<Module, { kind: 'course' | 'travel' }> => (m.kind === 'course' || m.kind === 'travel') && m.startDate <= date && date <= m.endDate).map((m) => ({ origin: d.date, m })));
  const spanCards = (block: string) =>
    spanning
      .filter(({ m }) => MODULE_BLOCK[m.kind] === block)
      .map(({ origin, m }) => {
        const meta = metaOf(m.kind);
        const n = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${m.startDate}T12:00:00`).getTime()) / 864e5) + 1;
        const total = Math.round((new Date(`${m.endDate}T12:00:00`).getTime() - new Date(`${m.startDate}T12:00:00`).getTime()) / 864e5) + 1;
        return (
          <Card key={`span-${m.id}`} id={`span.${m.id}`} className={`module module-${m.kind}`} icon={<meta.Icon />} kicker={KIND_KICKER[m.kind]} peek={<SpanPeek m={m} />} title={meta.label} summary={`${m.title || meta.label} · giorno ${n} di ${total}`} defaultOpen={false}>
            <p>
              <strong>{m.title || meta.label}</strong> · giorno {n} di {total}
            </p>
            <Link className="lime-banner no-print" to={`/giorno/${origin}?apri=${m.id}`}>
              <span>Modifica nel giorno di inizio</span>
              <span aria-hidden="true">›</span>
            </Link>
          </Card>
        );
      });

  const moduleCards = (block: string) =>
    day.modules
      .filter((m) => (block === 'work' || block === 'private') && MODULE_BLOCK[m.kind] === block)
      .map((m) => {
        const meta = metaOf(m.kind);
        const open = openId === m.id;
        return (
          <Card
            key={m.id}
            id={`module.${m.id}`}
            print={DAY_BLOCKS.find((b) => b.id === block)!.print}
            className={`module module-${m.kind}`}
            icon={<meta.Icon />}
            kicker={KIND_KICKER[m.kind]}
            peek={m.kind === 'course' || m.kind === 'travel' ? <SpanPeek m={m} /> : undefined}
            title={meta.label}
            summary={m.kind === 'course' || m.kind === 'travel' ? undefined : summarize(m)}
            open={open}
            onToggle={() => setOpenId(open ? null : m.id)}
            actions={
              <>
                <button className="icon-btn small no-print" aria-label="Elimina scheda" onClick={() => removeModule(m)}>
                  <GlyphTrash />
                </button>
              </>
            }
          >
            <ModuleEditor value={m} onChange={setModule} date={date} />
          </Card>
        );
      });

  const renderBlock = (id: string): React.ReactNode => {
    switch (id) {
      case 'shift': {
        // The card shows when there is a shift, or a roster/suggestion to start from; otherwise add it with "Aggiungi scheda".
        if (!day.shift) return null;
        return (
          <Card
            key="shift"
            id="day.shift"
            print="lavoro"
            icon={<IconShift />}
            title="Turno"
            style={shiftType ? ({ '--tint': shiftType.color } as React.CSSProperties) : undefined}
            summary={shiftSummary}
            actions={
              day.shift && (
                <button type="button" className="icon-btn small no-print" aria-label="Elimina il turno" onClick={() => removeShift('shift')}>
                  <GlyphTrash />
                </button>
              )
            }
          >
            {suggestion && (
              <div className="suggest no-print">
                <span>
                  Dal tabellone: <strong>{myCodes.map(codeShort).join(' · ')}</strong> ({suggestion.start}–{suggestion.end})
                </span>
                <button className="btn small" onClick={() => setShift(suggestion)}>
                  Usa
                </button>
              </div>
            )}
            <div className="shift-form">
              <div className="field">
                <span className="mini-label">Tipo turno</span>
                <ShiftTypeSelect pill types={settings.shiftTypes.filter((t) => t.group !== 'Guardia medica' || t.id === day.shift?.shiftTypeId)} value={day.shift?.shiftTypeId} onChange={chooseShiftType} />
              </div>
              {day.shift && (
                <>
                  <div className="time-pair">
                    <TimeTile label="Dalle" value={day.shift.start} onChange={(start) => setShift({ ...day.shift!, start })} />
                    <TimeTile label="Alle" value={day.shift.end} onChange={(end) => setShift({ ...day.shift!, end })} />
                  </div>
                  <div className="field">
                    <span className="mini-label">In turno con</span>
                    <ColleaguePicker colleagues={settings.colleagues} selected={day.shift.colleagueIds} onChange={(colleagueIds) => setShift({ ...day.shift!, colleagueIds })} />
                  </div>
                  <label className="note-line">
                    <Sym name="edit_note" size={18} />
                    <input aria-label="Note sul turno" placeholder="Aggiungi una nota al turno…" value={day.shift.note ?? ''} onChange={(e) => setShift({ ...day.shift!, note: e.target.value })} />
                  </label>
                </>
              )}
            </div>
            <RosterCard
              date={date}
              onJoin={(names) => {
                const base = dayRef.current.shift ?? (myCodes.length ? shiftFromCodes(myCodes, date, settings.colleagues) : null);
                if (!base) return;
                const ids = idsForNames(names, settings.colleagues);
                setShift({ ...base, colleagueIds: [...new Set([...base.colleagueIds, ...ids])] });
              }}
            />
          </Card>
        );
      }
      case 'guardia':
        if (!day.guardia) return null;
        return (
          <Card
            key="guardia"
            id="day.guardia"
            print="lavoro"
            icon={<IconSleep />}
            title="Guardia medica"
            summary={`${day.guardia.start}–${day.guardia.end}`}
            actions={
              <button type="button" className="icon-btn small no-print" aria-label="Elimina la guardia medica" onClick={() => removeShift('guardia')}>
                <GlyphTrash />
              </button>
            }
          >
            <div className="time-pair">
              <TimeTile label="Dalle" value={day.guardia.start} onChange={(start) => setGuardia({ ...day.guardia!, start })} />
              <TimeTile label="Alle" value={day.guardia.end} onChange={(end) => setGuardia({ ...day.guardia!, end })} />
            </div>
          </Card>
        );
      case 'agenda':
        return (
          <Card
            key="agenda"
            id="day.agenda"
            defaultOpen={false}
            print="agenda"
            icon={<IconAppointment />}
            title="Impegni"
            summary={agenda.length ? agenda.slice(0, 3).map((x) => `${x.time} ${'a' in x && x.a ? x.a.title || 'Impegno' : 'e' in x && x.e ? x.e.summary ?? '' : ''}`).join(' · ') + (agenda.length > 3 ? ' …' : '') : 'Nessuno'}
            actions={
              <button
                className="icon-btn no-print"
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
                    <TimeField label="Inizio" className="compact" value={item.a.start} onChange={(v) => v && update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === item.a!.id ? { ...x, start: v } : x)) }))} />
                    <TimeField label="Fine" className="compact" value={item.a.end} onChange={(v) => v && update((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === item.a!.id ? { ...x, end: v } : x)) }))} />
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
                    <button className="icon-btn small no-print" aria-label="Elimina impegno" onClick={() => update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== item.a!.id) }))}>
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
        );
      case 'todos':
        return (
          <Card
            key="todos"
            id="day.todos"
            defaultOpen={false}
            print="agenda"
            icon={<IconTodo />}
            title="Da ricordare"
            summary={
              todoTab === 'shop'
                ? toBuy.length
                  ? `Spesa · ${toBuy.length} da comprare · ${toBuy.slice(0, 3).map((i) => i.text).join(', ')}`
                  : 'Spesa · lista vuota'
                : day.todos.length
                  ? `${openTodos} da fare su ${day.todos.length}${openTodos ? ` · ${day.todos.filter((t) => !t.done).slice(0, 2).map((t) => t.text).join(', ')}` : ''}`
                  : 'Niente'
            }
            actions={
              <button
                className="icon-btn no-print"
                aria-label={todoTab === 'shop' ? 'Aggiungi alla spesa' : 'Aggiungi promemoria'}
                onClick={() => (todoTab === 'shop' ? setShopAdd((n) => n + 1) : update((d) => ({ ...d, todos: [...d.todos, { id: uid(), text: '', done: false }] })))}
              >
                <GlyphPlus />
              </button>
            }
          >
            <div className="segmented kind-switch todo-switch no-print" role="tablist" aria-label="Tipo di elenco">
              <button role="tab" aria-selected={todoTab === 'todos'} className={todoTab === 'todos' ? 'on' : ''} onClick={() => pickTodoTab('todos')}>
                Promemoria
              </button>
              <button role="tab" aria-selected={todoTab === 'shop'} className={todoTab === 'shop' ? 'on' : ''} onClick={() => pickTodoTab('shop')}>
                Spesa{toBuy.length ? ` · ${toBuy.length}` : ''}
              </button>
            </div>
            {todoTab === 'shop' ? (
              <ShoppingList addSignal={shopAdd} />
            ) : (
            <>
            {day.todos.length === 0 && <Empty>Niente da ricordare.</Empty>}
            <ul className="todos" {...todoSort.container}>
              {day.todos.map((t, ti) => (
                <li key={t.id} {...todoSort.item(ti)} className={`todo${t.done ? ' done' : ''} ${todoSort.item(ti).className}`}>
                  <DragGrip />
                  <input type="checkbox" checked={t.done} aria-label="Fatto" onChange={(e) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)) }))} />
                  <input className="grow" value={t.text} placeholder="Cosa ricordare…" onChange={(e) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)) }))} />
                  {catSelect(t.category, (category) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, category } : x)) })))}
                  <TimeField
                    label="Orario (va su Google Calendar)"
                    className="compact"
                    clearable
                    value={t.time}
                    onChange={(v) => update((d) => ({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, time: v, end: undefined } : x)) }))}
                  />
                  <button className="icon-btn small no-print" aria-label="Elimina" onClick={() => update((d) => ({ ...d, todos: d.todos.filter((x) => x.id !== t.id) }))}>
                    <GlyphTrash />
                  </button>
                </li>
              ))}
            </ul>
            </>
            )}
          </Card>
        );
      case 'training':
        return <TrainingBlock key="training" day={day} />;
      case 'nutrition':
        return <NutritionBlock key="nutrition" day={day} />;
      case 'diary': {
        const d = diaryOf(day);
        const preview = d.text.trim().split('\n')[0].slice(0, 90);
        return (
          <Card
            key="diary"
            id="day.diary"
            print="diario"
            icon={<IconNote />}
            title="Diario"
            summary={preview || (d.photos.length ? `${d.photos.length} foto` : 'Ancora nessuna pagina')}
          >
            <DiaryEntryView day={day} onSave={(diary) => update((x) => withDiary(x, diary))} />
          </Card>
        );
      }
      case 'work':
      case 'private': {
        const cards = [...moduleCards(id), ...spanCards(id)];
        return cards.length ? (
          <div key={id} className="modules">
            {id === 'work' && <WorkTiles day={day} />}
            {cards}
          </div>
        ) : null;
      }
      default:
        return null;
    }
  };

  const hidden = settings.hiddenBlocks ?? [];
  const saveSettings = store.saveSettings;
  const { drag, settling, compact, onPointerDown } = useBlockDrag(order, (o) => saveOrder(o), { compact: true });
  const rendered: React.ReactNode[] = [];
  for (const id of order) {
    if (hidden.includes(id)) continue;
    const node = renderBlock(id);
    if (!node) continue;
    const me = drag?.id === id;
    const shift = drag && !me ? drag.shifts[id] ?? 0 : 0;
    rendered.push(
      <div
        key={id}
        data-block={id}
        className={`blk${me ? ' dragging' : ''}${drag && !me ? ' shifting' : ''}${settling ? ' settling' : ''}`}
        style={me ? { transform: `translate3d(0, ${drag!.dy}px, 0) scale(1.02)` } : shift ? { transform: `translate3d(0, ${shift}px, 0)` } : undefined}
      >
        <CardDecor.Provider value={{ kicker: BLOCK_KICKER[id], handle: true }}>{node}</CardDecor.Provider>
      </div>,
    );
  }

  const swipeRef = useSwipeNav<HTMLDivElement>(() => nav(`/giorno/${addDays(date, -1)}`), () => nav(`/giorno/${addDays(date, 1)}`), date);
  const saveOrder = (o: string[]) => store.saveSettings({ ...settings, dayLayout: o });

  return (
    <div ref={swipeRef} className={`page day-page${drag ? ' is-dragging' : ''}${compact ? ' is-compacting' : ''}`} onPointerDown={onPointerDown}>
      <header className="page-head">
        <button className="icon-btn no-print" aria-label="Giorno precedente" onClick={() => nav(`/giorno/${addDays(date, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title day-title">
          <h1>
            <span className="dt-text">{dayTitle}</span>
            {date === today() && <span className="today-badge">Oggi</span>}
          </h1>
          <span className="page-sub">{[...dayShifts, `Settimana ${isoWeek(date)}`].join(' · ')}</span>
        </div>
        <button className="icon-btn no-print" aria-label="Ordina le sezioni" title="Ordina le sezioni" onClick={() => setOrdering(true)}>
          <Sym name="swap_vert" size={20} />
        </button>
        <div className="day-jump no-print" role="group" aria-label="Vai al giorno">
          <button onClick={() => nav(`/giorno/${addDays(today(), -1)}`)} className={date === addDays(today(), -1) ? 'on' : ''}>Ieri</button>
          <button onClick={() => nav(`/giorno/${today()}`)} className={date === today() ? 'on' : ''}>Oggi</button>
          <button onClick={() => nav(`/giorno/${addDays(today(), 1)}`)} className={date === addDays(today(), 1) ? 'on' : ''}>Domani</button>
        </div>
        <PrintButton title={`The Logbook · ${formatLong(date)}`} sections={DAY_PRINT} />
        <button className="icon-btn no-print" aria-label="Giorno successivo" onClick={() => nav(`/giorno/${addDays(date, 1)}`)}>
          <GlyphNext />
        </button>
      </header>

      {date !== today() && (
        <Link to={`/giorno/${today()}`} className="lime-banner no-print">
          <span>Vai a oggi</span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      <BodyPills day={day} />

      {rendered}

      <button className="btn-add no-print" onClick={() => setAdding(true)}>
        <GlyphPlus /> Aggiungi scheda
      </button>
      {adding && (
        <div className="sheet-backdrop no-print" onClick={() => setAdding(false)}>
          <div className="sheet add-sheet" role="dialog" aria-label="Aggiungi una scheda" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <div className="add-sheet-head">
              <h2 className="sheet-title">Aggiungi una scheda</h2>
              <button className="icon-btn small" aria-label="Chiudi" onClick={() => setAdding(false)}>
                <GlyphClose />
              </button>
            </div>
            {(!day.shift || (!day.guardia && guardiaTypes.length > 0)) && (
              <section>
                <h3 className="palette-area">Turni</h3>
                <div className="add-tiles">
                  {!day.shift && (
                    <button className="add-tile" onClick={() => { addShift(); setAdding(false); }}>
                      <IconShift size={38} />
                      <span>
                        <strong>Turno</strong>
                        <small>Turno in ospedale</small>
                      </span>
                    </button>
                  )}
                  {!day.guardia && guardiaTypes.length > 0 && (
                    <button className="add-tile" onClick={() => { chooseGuardia(guardiaTypes[0].id); setAdding(false); }}>
                      <IconSleep size={38} />
                      <span>
                        <strong>Guardia medica</strong>
                        <small>Dalle … alle …</small>
                      </span>
                    </button>
                  )}
                </div>
              </section>
            )}
            <section>
              <h3 className="palette-area">Attività</h3>
              <div className="add-rows">
                {(['lavoro', 'personale'] as const).flatMap((area) =>
                  MODULES.filter((m) => m.area === area && ADDABLE.includes(m.kind)).map((m) => (
                    <button key={m.kind} className="add-row" onClick={() => addModule(m.kind)}>
                      <m.Icon size={42} />
                      <span>
                        <strong>{MERGED[m.kind]?.label ?? m.label}</strong>
                        <small>{MERGED[m.kind]?.hint ?? m.hint}</small>
                      </span>
                      <span className="add-plus" aria-hidden="true">
                        <GlyphPlus />
                      </span>
                    </button>
                  )),
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {ordering && (
        <div className="sheet-backdrop" onClick={() => setOrdering(false)}>
          <div className="sheet" role="dialog" aria-label="Ordine delle sezioni" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Ordine delle sezioni</h2>
              <button className="icon-btn" aria-label="Chiudi" onClick={() => setOrdering(false)}>
                <GlyphClose />
              </button>
            </div>
            <p className="muted small">Tieni premuta una riga (o l’intestazione di una sezione nella pagina) e trascinala per spostarla. Le nuove schede si inseriscono da sole nella loro sezione.</p>
            <ol className="order-list" {...orderSort.container}>
              {order.map((id, i) => (
                <li key={id} {...orderSort.item(i)} className={`${hidden.includes(id) ? 'is-hidden' : ''} ${orderSort.item(i).className}`}>
                  <DragGrip />
                  <span>{DAY_BLOCKS.find((b) => b.id === id)?.label}{hidden.includes(id) && ' (eliminato)'}</span>
                  {hidden.includes(id) && (
                    <button className="btn-ghost small" onClick={() => saveSettings({ ...settings, hiddenBlocks: hidden.filter((x) => x !== id) })}>
                      Ripristina
                    </button>
                  )}
                  <button className="icon-btn small" aria-label="Sposta su" disabled={i === 0} onClick={() => saveOrder(order.map((x, k) => (k === i - 1 ? id : k === i ? order[i - 1] : x)))}>
                    <GlyphPrev />
                  </button>
                  <button className="icon-btn small" aria-label="Sposta giù" disabled={i === order.length - 1} onClick={() => saveOrder(order.map((x, k) => (k === i + 1 ? id : k === i ? order[i + 1] : x)))}>
                    <GlyphNext />
                  </button>
                </li>
              ))}
            </ol>
            <div className="sheet-foot">
              <button className="btn-ghost small" onClick={() => saveOrder(DAY_BLOCKS.map((b) => b.id))}>
                Ripristina ordine
              </button>
              <button className="btn" onClick={() => setOrdering(false)}>
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Key numbers of the day's clinical work, above the surgery/clinical cards. */
function WorkTiles({ day }: { day: DayEntry }) {
  const s = surgeryTotals(day.modules);
  const c = clinicalTotals(day.modules);
  if (!s.patients && !c.patients) return null;
  const minutes = s.minutes;
  const tiles: [string, string, boolean?][] = [];
  if (s.patients) tiles.push(['Interventi', String(s.patients), true]);
  if (s.procedures > s.patients) tiles.push(['Procedure', String(s.procedures)]);
  if (c.patients) tiles.push(['Pazienti in clinica', String(c.patients), !s.patients]);
  if (c.activities > c.patients) tiles.push(['Prestazioni', String(c.activities)]);
  if (minutes) tiles.push(['Tempo operatorio', minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`]);
  if (s.patients) tiles.push(['Complicanze', String(s.complications)]);
  return (
    <div className="stat-tiles work-tiles-row scroll-x">
      {tiles.map(([label, value, hi]) => (
        <div key={label} className="stat-tile">
          <span className="stat-label">{label}</span>
          <strong className={hi ? 'hi' : undefined}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

/** Sleep, water and steps of the day; tapping one opens the day summary panel to fill it in. */
function BodyPills({ day }: { day: DayEntry }) {
  const goals = useStore().settings.goals ?? {};
  const b = day.body ?? {};
  const open = () => window.dispatchEvent(new Event('logbook:open-body'));
  const pills: { key: string; Icon: (p: { size?: number }) => React.ReactElement; label: string; value?: string; goal?: string }[] = [
    { key: 'sleep', Icon: IconSleep, label: 'Sonno', value: b.sleepH !== undefined ? `${fmt(b.sleepH, 1)} h` : undefined },
    { key: 'water', Icon: IconWater, label: 'Acqua', value: b.waterL !== undefined ? `${fmt(b.waterL, 2)} L` : undefined, goal: goals.waterL ? `${fmt(goals.waterL, 1)} L` : undefined },
    { key: 'steps', Icon: IconSteps, label: 'Passi', value: b.steps !== undefined ? fmt(b.steps) : undefined, goal: goals.steps ? fmt(goals.steps) : undefined },
  ];
  return (
    <div className="body-pills no-print">
      {pills.map((p) => (
        <button key={p.key} type="button" className={`body-pill pill-${p.key}`} onClick={open}>
          <p.Icon size={22} />
          <span className="bp-label">{p.label}</span>
          <strong>{p.value ?? '–'}</strong>
          {p.value && p.goal && <span className="bp-goal">/ {p.goal}</span>}
        </button>
      ))}
    </div>
  );
}

/** Course or trip while its card is closed: title, dates and the attached PDFs. */
function SpanPeek({ m }: { m: Extract<Module, { kind: 'course' | 'travel' }> }) {
  const { repo } = useStore();
  const files: [string, FileRef | undefined, boolean][] =
    m.kind === 'course' ? [...programOf(m).map((f, i, all): [string, FileRef, boolean] => [all.length > 1 ? `Programma ${i + 1}` : 'Programma', f, false]), ['Attestato', m.certificate, true]] : [];
  const link = m.kind === 'course' && m.type === 'webinar' ? m.link?.trim() : undefined;
  const place = m.kind === 'course' && m.type !== 'webinar' ? m.place?.trim() : undefined;
  return (
    <div className="span-peek">
      <div className="sp-head">
        <i className={`sp-dot sp-${m.kind}`} aria-hidden="true" />
        <strong>{m.title || (m.kind === 'course' ? 'Corso / congresso' : 'Viaggio')}</strong>
        <span className="sp-dates">{rangeLabel(m.startDate, m.endDate)}</span>
      </div>
      {(files.some(([, f]) => f) || link || place) && (
        <div className="sp-files no-print">
          {place && (
            <a className="file-chip link-chip" href={mapsUrl(place)} target="_blank" rel="noopener noreferrer">
              📍 {place}
            </a>
          )}
          {link && (
            <a className="file-chip link-chip" href={webUrl(link)} target="_blank" rel="noopener noreferrer">
              Collegati al webinar ›
            </a>
          )}
          {files.map(([label, f, crown]) =>
            f ? (
              <button key={label} type="button" className="file-chip" onClick={() => openFile(repo, f)}>
                <GlyphClip crown={crown} /> {label}
              </button>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
