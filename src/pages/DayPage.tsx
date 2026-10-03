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
  IconShift,
  IconTodo,
} from '../components/icons';
import { RosterCard } from '../components/RosterCard';
import { NutritionBlock, TrainingBlock } from '../components/day/DayBlocks';
import { DiaryEntryView } from '../components/diary/DiaryEntry';
import { useUndo } from '../components/Undo';
import { useBlockDrag } from '../components/useBlockDrag';
import { useSwipeNav } from '../components/useSwipeNav';
import { Card, ColleaguePicker, Empty, Field, ShiftTypeSelect, uid } from '../components/ui';
import { blockOrder, DAY_BLOCKS, MODULE_BLOCK } from '../lib/dayLayout';
import { CATEGORIES } from '../lib/vocab';
import { codeShort, idsForNames, rosterFor, ROSTER_SELF, shiftFromCodes } from '../lib/roster';
import { addDays, formatLong, isoWeek, today } from '../lib/dates';
import { diaryOf, withDiary } from '../lib/diary';
import { eventLocal } from '../lib/google/calendar';
import { useStore } from '../lib/store/StoreContext';
import type { DayEntry, Module, ModuleKind, ShiftAssignment } from '../lib/types';

/** Cards that can be added by hand; training, food and the diary have their own sections. */
const ADDABLE: ModuleKind[] = ['surgery', 'clinical', 'study', 'course', 'travel', 'outing'];

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
        store.repo.deleteFile(m.program?.path);
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
  const shiftName = settings.shiftTypes.find((t) => t.id === day.shift?.shiftTypeId)?.name ?? 'Turno';
  const who = day.shift ? day.shift.colleagueIds.map((c) => settings.colleagues.find((x) => x.id === c)?.name).filter(Boolean).slice(0, 3).join(', ') : '';
  const shiftSummary = day.shift
    ? `${shiftName} · ${day.shift.start}–${day.shift.end}${who ? ` · con ${who}` : ''}`
    : suggestion
      ? `Dal tabellone: ${myCodes.map(codeShort).join(' · ')}`
      : 'Nessun turno';
  const order = blockOrder(settings.dayLayout);

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
          <Card key={`span-${m.id}`} id={`span.${m.id}`} className={`module module-${m.kind}`} icon={<meta.Icon />} title={meta.label} summary={`${m.title || meta.label} · giorno ${n} di ${total}`} defaultOpen={false}>
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
            title={meta.label}
            summary={summarize(m)}
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
        if (!day.shift && !suggestion && !rosterFor(date)) return null;
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
            <div className="grid">
              <Field label="Tipo di turno">
                <ShiftTypeSelect types={settings.shiftTypes.filter((t) => t.group !== 'Guardia medica' || t.id === day.shift?.shiftTypeId)} value={day.shift?.shiftTypeId} onChange={chooseShiftType} />
              </Field>
              {day.shift && (
                <>
                  <Field label="Dalle">
                    <input type="time" value={day.shift.start} onChange={(e) => setShift({ ...day.shift!, start: e.target.value })} />
                  </Field>
                  <Field label="Alle">
                    <input type="time" value={day.shift.end} onChange={(e) => setShift({ ...day.shift!, end: e.target.value })} />
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
              <Field label="Dalle">
                <input type="time" value={day.guardia.start} onChange={(e) => setGuardia({ ...day.guardia!, start: e.target.value })} />
              </Field>
              <Field label="Alle">
                <input type="time" value={day.guardia.end} onChange={(e) => setGuardia({ ...day.guardia!, end: e.target.value })} />
              </Field>
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
            summary={day.todos.length ? `${openTodos} da fare su ${day.todos.length}${openTodos ? ` · ${day.todos.filter((t) => !t.done).slice(0, 2).map((t) => t.text).join(', ')}` : ''}` : 'Niente'}
            actions={
              <button className="icon-btn no-print" aria-label="Aggiungi promemoria" onClick={() => update((d) => ({ ...d, todos: [...d.todos, { id: uid(), text: '', done: false }] }))}>
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
                  <button className="icon-btn small no-print" aria-label="Elimina" onClick={() => update((d) => ({ ...d, todos: d.todos.filter((x) => x.id !== t.id) }))}>
                    <GlyphTrash />
                  </button>
                </li>
              ))}
            </ul>
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
        return cards.length ? <div key={id} className="modules">{cards}</div> : null;
      }
      default:
        return null;
    }
  };

  const hidden = settings.hiddenBlocks ?? [];
  const saveSettings = store.saveSettings;
  const { drag, settling, onPointerDown } = useBlockDrag(order, (o) => saveOrder(o));
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
        {node}
      </div>,
    );
  }

  const swipeRef = useSwipeNav<HTMLDivElement>(() => nav(`/giorno/${addDays(date, -1)}`), () => nav(`/giorno/${addDays(date, 1)}`), date);
  const saveOrder = (o: string[]) => store.saveSettings({ ...settings, dayLayout: o });

  return (
    <div ref={swipeRef} className={`page day-page${drag ? ' is-dragging' : ''}`} onPointerDown={onPointerDown}>
      <header className="page-head">
        <button className="icon-btn no-print" aria-label="Giorno precedente" onClick={() => nav(`/giorno/${addDays(date, -1)}`)}>
          <GlyphPrev />
        </button>
        <div className="page-title">
          <h1>{formatLong(date)}</h1>
          <span className="page-sub">Settimana {isoWeek(date)}</span>
        </div>
        <button className="icon-btn no-print" aria-label="Ordina le sezioni" title="Ordina le sezioni" onClick={() => setOrdering(true)}>
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4v16M4.5 7.5L8 4l3.5 3.5M16 20V4M12.5 16.5L16 20l3.5-3.5" />
          </svg>
        </button>
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

      {rendered}

      {adding ? (
        <div className="palette no-print" role="dialog" aria-label="Aggiungi scheda">
          <div className="palette-head">
            <h2>Aggiungi una scheda</h2>
            <button className="icon-btn" aria-label="Chiudi" onClick={() => setAdding(false)}>
              <GlyphClose />
            </button>
          </div>
          {(!day.shift || !day.guardia) && (
            <div>
              <h3 className="palette-area">Turni</h3>
              <div className="palette-grid">
                {!day.shift && (
                  <button className="palette-item" onClick={() => { addShift(); setAdding(false); }}>
                    <IconShift size={48} />
                    <span className="palette-label">Turno</span>
                    <span className="palette-hint">Turno in ospedale</span>
                  </button>
                )}
                {!day.guardia && guardiaTypes.length > 0 && (
                  <button className="palette-item" onClick={() => { chooseGuardia(guardiaTypes[0].id); setAdding(false); }}>
                    <IconSleep size={48} />
                    <span className="palette-label">Guardia medica</span>
                    <span className="palette-hint">Dalle … alle …</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {(['lavoro', 'personale'] as const).map((area) => (
            <div key={area}>
              <h3 className="palette-area">{area === 'lavoro' ? 'Lavoro' : 'Vita privata'}</h3>
              <div className="palette-grid">
                {MODULES.filter((m) => m.area === area && ADDABLE.includes(m.kind)).map((m) => (
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
        <button className="btn-add no-print" onClick={() => setAdding(true)}>
          <GlyphPlus /> Aggiungi scheda
        </button>
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
            <p className="muted small">Puoi anche spostare una sezione tenendo premuta la sua intestazione e trascinandola col dito. Le nuove schede si inseriscono da sole nella loro sezione.</p>
            <ol className="order-list">
              {order.map((id, i) => (
                <li key={id} className={hidden.includes(id) ? 'is-hidden' : ''}>
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
