import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SwipeDelete } from '../SwipeDelete';
import { useStore } from '../../lib/store/StoreContext';
import type { ClinicalCase, ClinicalItem, ClinicalModule, Colleague, Module, ProcedureGroup, SurgeryCase, SurgeryModule, SurgeryProcedure } from '../../lib/types';
import {
  APPROACHES,
  approachesFor,
  CLAVIEN,
  CLINICAL_ACTIVITIES,
  CLINICAL_ROLES,
  defaultApproach,
  labelOf,
  PROCEDURE_COMBOS,
  PROCEDURES,
  procedurePhase,
  SETTINGS_URGENCY,
  SURGICAL_ROLES,
  type VocabItem,
} from '../../lib/vocab';
import { caseTitle, clinicalCases, clinicalLabels, surgeryCases } from '../../lib/worklog';
import { GlyphPlus, GlyphTrash, Sym } from '../icons';
import { useUndo } from '../Undo';
import { useBlockDrag } from '../useBlockDrag';
import { AutoText, ChipChoice, Chevron, DragGrip, NumField, uid, VocabSelect } from '../ui';
import { DurationField } from '../WheelPicker';

// ---------- Shared pieces ----------

/** Lower case without accents, so "linfonodo" finds "Linfonodo" and "piu" finds "più". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Items whose name (or abbreviations, or group) contains every typed word, in any order. */
export function searchVocab(items: VocabItem[], text: string): VocabItem[] {
  const words = norm(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = items.filter((i) => {
    const hay = norm(`${i.label} ${i.kw ?? ''} ${i.group ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
  // Names starting with the first word come first, then names containing it.
  const rank = (i: VocabItem) => (norm(i.label).startsWith(words[0]) ? 0 : norm(i.label).includes(words[0]) ? 1 : 2);
  return hits.sort((a, b) => rank(a) - rank(b));
}

/** Data attribute names must be plain: one per list, from the card's id. */
const attrOf = (prefix: string, id: string) => `${prefix}${id.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase()}`;

/** One choice among a few, as a full-width segmented control. */
function Seg({ items, value, onChange, label, className = '' }: { items: VocabItem[]; value: string | undefined; onChange: (id: string) => void; label: string; className?: string }) {
  return (
    <div className={`segmented op-seg ${className}`} role="radiogroup" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} type="button" role="radio" aria-checked={value === i.id} className={value === i.id ? 'on' : ''} onClick={() => onChange(i.id)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

/** Chips on one line that scroll sideways (long lists like the access routes). */
function ScrollChips(props: { items: VocabItem[]; value: string | undefined; onChange: (id: string) => void; label: string }) {
  return (
    <div className="scroll-x op-scroll">
      <ChipChoice {...props} />
    </div>
  );
}

/** A small section that folds away behind its title (tutor, complications…). */
function Fold({ title, summary, children, defaultOpen = false }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`op-fold${open ? ' open' : ''}`}>
      <button type="button" className="op-fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="op-fold-title">{title}</span>
        {summary !== undefined && <span className="op-fold-sum">{summary}</span>}
        <Chevron open={open} />
      </button>
      {open && <div className="op-fold-body">{children}</div>}
    </div>
  );
}

/** Hold-and-drag for one list of rows (rows shrink to one line while dragging). */
function useRowDrag<T extends { id: string }>(list: T[], onReorder: (l: T[]) => void, attr: string, handle: string) {
  const order = list.map((x) => x.id);
  const d = useBlockDrag(order, (o) => onReorder(o.map((id) => list.find((x) => x.id === id)!)), { attr, handle, compact: true });
  return {
    compact: d.compact,
    dragging: !!d.drag,
    onPointerDown: d.onPointerDown,
    row: (id: string) => {
      const me = d.drag?.id === id;
      const shift = d.drag && !me ? d.drag.shifts[id] ?? 0 : 0;
      return {
        [`data-${attr}`]: id,
        className: ` sortable${me ? ' sort-lifted' : ''}${d.drag && !me ? ' sort-shifting' : ''}${d.settling ? ' sort-settling' : ''}`,
        style: me ? { transform: `translate3d(0, ${d.drag!.dy}px, 0) scale(1.02)` } : shift ? { transform: `translate3d(0, ${shift}px, 0)` } : undefined,
      };
    },
  };
}

/**
 * Search box that adds items: typing any words of a name (in any order, abbreviations too)
 * lists the matches; with an empty box it offers the most used ones. "Sfoglia" opens the
 * whole list by group.
 */
export function VocabSearch({
  items,
  onPick,
  placeholder,
  frequent = [],
  browse,
  autoFocus,
  value,
}: {
  items: VocabItem[];
  onPick: (item: VocabItem) => void;
  placeholder: string;
  frequent?: VocabItem[];
  /** The full list offered by "Sfoglia" (defaults to items). */
  browse?: VocabItem[];
  autoFocus?: boolean;
  /** Current choice, when the box changes one item instead of adding. */
  value?: string;
}) {
  const current = value ? items.find((i) => i.id === value)?.label ?? '' : '';
  const [text, setText] = useState(current);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setText(current), [current]);
  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: false });
  }, [autoFocus]);
  const typed = text.trim() && text !== current ? text : '';
  const hits = open ? (typed ? searchVocab(items, typed).slice(0, 40) : frequent) : [];
  const pick = (i: VocabItem) => {
    onPick(i);
    setText(value ? i.label : '');
    setOpen(false);
    input.current?.blur();
  };
  return (
    <div className="search-pick vocab-search">
      <div className="vs-row">
        <span className="icon-input">
          <Sym name="search" size={18} />
          <input
            ref={input}
            value={text}
            placeholder={placeholder}
            enterKeyHint="search"
            onFocus={(e) => {
              setOpen(true);
              e.target.select();
            }}
            onBlur={() =>
              window.setTimeout(() => {
                setOpen(false);
                setText(current);
              }, 150)
            }
            onChange={(e) => setText(e.target.value)}
          />
        </span>
        <label className="vs-browse" title="Sfoglia l’elenco">
          <span>Elenco</span>
          <select
            value=""
            aria-label="Sfoglia l’elenco"
            onChange={(e) => {
              const i = (browse ?? items).find((x) => x.id === e.target.value);
              if (i) pick(i);
            }}
          >
            <option value="">Sfoglia…</option>
            {groupsOf(browse ?? items).map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {open && (hits.length > 0 || typed) && (
        <ul className="search-hits" role="listbox">
          {!typed && <li className="hits-cap">Suggeriti</li>}
          {hits.map((i) => (
            <li key={i.id}>
              <button type="button" role="option" aria-selected={i.id === value} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
                <span>
                  {i.parts && <span className="combo-tag">{i.parts.length} procedure</span>}
                  {i.label}
                </span>
                {i.group && <small>{i.parts ? i.parts.map((p) => labelOf(PROCEDURES, p)).join(' · ') : i.group}</small>}
              </button>
            </li>
          ))}
          {typed && !hits.length && <li className="hits-cap">Nessun risultato: prova con un’altra parola o con “Elenco”.</li>}
        </ul>
      )}
    </div>
  );
}

function groupsOf(list: VocabItem[]): [string, VocabItem[]][] {
  const map = new Map<string, VocabItem[]>();
  for (const i of list) {
    const g = i.group ?? 'Altro';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(i);
  }
  return [...map.entries()];
}

/** Ids used most often in the loaded days, for the empty search box. */
function useFrequent(collect: (m: Module) => string[], vocab: VocabItem[]) {
  const { allDays } = useStore();
  return useMemo(() => {
    const n = new Map<string, number>();
    for (const d of allDays) for (const m of d.modules) for (const id of collect(m)) n.set(id, (n.get(id) ?? 0) + 1);
    return [...n.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => vocab.find((v) => v.id === id))
      .filter((v): v is VocabItem => !!v);
  }, [allDays]);
}

/** Tutor as a small tile: the name and ›; tapping opens the list of colleagues. */
function TutorTile({ colleagues, value, onChange }: { colleagues: Colleague[]; value?: string; onChange: (id: string | undefined) => void }) {
  const name = colleagues.find((c) => c.id === value)?.name;
  return (
    <label className="op-tile op-tutor">
      <span className="op-tile-label">Tutor</span>
      <span className="op-tile-value">{name ?? (colleagues.length ? 'Nessuno' : 'Aggiungi i colleghi in Impostazioni')}</span>
      <Sym name="chevron_right" size={18} className="op-tile-more" />
      {colleagues.length > 0 && (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Tutor">
          <option value="">Nessuno</option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`);
const CLAVIEN_CHIPS: VocabItem[] = CLAVIEN.map((c) => ({ id: c.id, label: c.id === 'none' ? 'Nessuna' : c.id }));
const ROLE_SHORT: Record<string, string> = { first: 'Primo operatore', 'first-tutored': 'Primo con tutor', second: 'Secondo', assistant: 'Aiuto', observer: 'Osservatore' };
const ROLE_CHIPS: VocabItem[] = SURGICAL_ROLES.map((r) => ({ id: r.id, label: ROLE_SHORT[r.id] ?? r.label }));
const PICKABLE = PROCEDURES.filter((p) => !p.legacy);
const SEARCHABLE = [...PICKABLE, ...PROCEDURE_COMBOS];

// ---------- Saved groups of procedures ----------

const GROUP_PREFIX = 'grp:';
const signature = (ps: Omit<SurgeryProcedure, 'id'>[]) => ps.filter((p) => p.procedureId).map((p) => `${p.procedureId}|${p.role}|${p.approach}`).join(',');
const groupItem = (g: ProcedureGroup): VocabItem => ({ id: GROUP_PREFIX + g.id, label: g.name, group: 'I miei gruppi', parts: g.procedures.map((p) => p.procedureId), kw: 'gruppo' });
/** "Gruppo 3": the first number not used yet. */
const nextGroupName = (groups: ProcedureGroup[]) => {
  let n = 1;
  while (groups.some((g) => g.name.trim().toLowerCase() === `gruppo ${n}`)) n++;
  return `Gruppo ${n}`;
};

/** Save, update or rename the group of a patient's procedures. */
function GroupBar({ c, onChange }: { c: SurgeryCase; onChange: (c: SurgeryCase) => void }) {
  const store = useStore();
  const groups = store.settings.procedureGroups ?? [];
  const saveGroups = (procedureGroups: ProcedureGroup[]) => store.saveSettings({ ...store.settings, procedureGroups });
  const loaded = groups.find((g) => g.id === c.groupId);
  const mine = c.procedures.filter((p) => p.procedureId).map(({ procedureId, role, approach }) => ({ procedureId, role, approach }));
  const changed = loaded && signature(loaded.procedures) !== signature(mine);
  const saveNew = () => {
    const g: ProcedureGroup = { id: uid(), name: nextGroupName(groups), procedures: mine };
    saveGroups([...groups, g]);
    onChange({ ...c, groupId: g.id });
  };
  if (loaded)
    return (
      <div className={`op-group${changed ? ' changed' : ''}`}>
        <label className="op-group-name">
          <span className="op-group-tag">Gruppo</span>
          <input value={loaded.name} aria-label="Nome del gruppo" onChange={(e) => saveGroups(groups.map((g) => (g.id === loaded.id ? { ...g, name: e.target.value } : g)))} />
        </label>
        {changed && (
          <>
            <span className="op-group-note">Hai modificato le procedure del gruppo.</span>
            <div className="op-group-actions">
              <button type="button" className="btn-ghost small" onClick={() => saveGroups(groups.map((g) => (g.id === loaded.id ? { ...g, procedures: mine } : g)))}>
                Aggiorna “{loaded.name || 'gruppo'}”
              </button>
              <button type="button" className="btn-ghost small lime" disabled={!mine.length} onClick={saveNew}>
                Salva come nuovo gruppo
              </button>
            </div>
          </>
        )}
      </div>
    );
  if (mine.length < 2) return null;
  return (
    <button type="button" className="btn-ghost small op-group-save" onClick={saveNew}>
      Salva queste procedure come gruppo
    </button>
  );
}

/** Saved groups: rename, reorder (hold and drag), delete (swipe left). */
function GroupsManager() {
  const store = useStore();
  const offerUndo = useUndo();
  const groups = store.settings.procedureGroups ?? [];
  const save = (procedureGroups: ProcedureGroup[]) => store.saveSettings({ ...store.settings, procedureGroups });
  const drag = useRowDrag(groups, save, 'pgrp', '.pg-row');
  if (!groups.length) return null;
  return (
    <Fold title="I miei gruppi di procedure" summary={`${groups.length}`}>
      <div className={`op-procs${drag.dragging ? ' is-dragging' : ''}${drag.compact ? ' is-compacting' : ''}`} onPointerDown={drag.onPointerDown}>
        {groups.map((g) => {
          const r = drag.row(g.id);
          return (
            <div key={g.id} {...r} className={`op-proc${r.className}`}>
              <SwipeDelete
                onDelete={() => {
                  save(groups.filter((x) => x.id !== g.id));
                  offerUndo(`Gruppo “${g.name}” eliminato`, () => save(groups));
                }}
              >
                <div className="pg-row">
                  <DragGrip />
                  <div className="pg-main">
                    <input value={g.name} aria-label="Nome del gruppo" onChange={(e) => save(groups.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} />
                    <span className="op-proc-meta">{g.procedures.map((p) => labelOf(PROCEDURES, p.procedureId)).join(' · ')}</span>
                  </div>
                </div>
              </SwipeDelete>
            </div>
          );
        })}
      </div>
      <p className="muted small">Scorri a sinistra per eliminare un gruppo, tieni premuto per spostarlo.</p>
    </Fold>
  );
}

// ---------- Surgical activity ----------

export function SurgeryEditor({ value: m, onChange }: { value: SurgeryModule; onChange: (m: SurgeryModule) => void }) {
  const { settings } = useStore();
  const offerUndo = useUndo();
  const cases = surgeryCases(m);
  const save = (next: SurgeryCase[]) =>
    onChange({ kind: 'surgery', id: m.id, cases: next }); // older single-procedure fields go away on the first edit
  const [open, setOpen] = useState<Set<string>>(() => new Set(cases.length === 1 ? [cases[0].id] : []));
  const [fresh, setFresh] = useState<string | null>(null);
  const toggle = (id: string) => {
    setFresh(null);
    setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  };
  const attr = attrOf('opc', m.id);
  const drag = useRowDrag(cases, save, attr, '.op-case-head');
  const frequent = useFrequent((x) => (x.kind === 'surgery' ? surgeryCases(x).flatMap((c) => c.procedures.map((p) => p.procedureId)) : []), PICKABLE);

  const addCase = (copy?: SurgeryCase) => {
    const last = cases[cases.length - 1];
    const c: SurgeryCase = copy
      ? { ...copy, id: uid(), procedures: copy.procedures.map((p) => ({ ...p, id: uid() })), clavien: undefined, complicationNotes: undefined, notes: undefined }
      : { id: uid(), procedures: [], setting: last?.setting ?? 'elective', tutorId: last?.tutorId };
    save([...cases, c]);
    setOpen(new Set([c.id]));
    setFresh(copy ? null : c.id);
  };
  const removeCase = (i: number) => {
    const before = cases;
    save(cases.filter((_, k) => k !== i));
    offerUndo(`Paziente ${i + 1} eliminata`, () => save(before));
  };

  return (
    <div className={`op-list${drag.dragging ? ' is-dragging' : ''}${drag.compact ? ' is-compacting' : ''}`} onPointerDown={drag.onPointerDown}>
      {cases.map((c, i) => {
        const r = drag.row(c.id);
        return (
          <div key={c.id} {...r} className={`op-case${open.has(c.id) ? ' open' : ''}${r.className}`}>
            <CaseView
              c={c}
              n={i + 1}
              open={open.has(c.id)}
              fresh={fresh === c.id}
              colleagues={settings.colleagues}
              frequent={frequent}
              onToggle={() => toggle(c.id)}
              onChange={(nc) => save(cases.map((x, k) => (k === i ? nc : x)))}
              onRemove={() => removeCase(i)}
              onDuplicate={() => addCase(c)}
            />
          </div>
        );
      })}
      <button type="button" className="add-ex op-add" onClick={() => addCase()}>
        <GlyphPlus /> Aggiungi paziente
      </button>
      <GroupsManager />
    </div>
  );
}

function CaseView({
  c,
  n,
  open,
  fresh,
  colleagues,
  frequent,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
}: {
  c: SurgeryCase;
  n: number;
  open: boolean;
  fresh: boolean;
  colleagues: Colleague[];
  frequent: VocabItem[];
  onToggle: () => void;
  onChange: (c: SurgeryCase) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const offerUndo = useUndo();
  const set = (p: Partial<SurgeryCase>) => onChange({ ...c, ...p });
  const [openP, setOpenP] = useState<Set<string>>(() => new Set(c.procedures.length === 1 ? [c.procedures[0].id] : []));
  const toggleP = (id: string) => setOpenP((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const attr = attrOf('opp', c.id);
  const drag = useRowDrag(c.procedures, (procedures) => set({ procedures }), attr, '.op-proc-head');
  const named = c.procedures.filter((p) => p.procedureId);
  const compl = c.clavien && c.clavien !== 'none';
  const meta = [
    named.length > 1 ? `${named.length} procedure` : named[0] ? labelOf(SURGICAL_ROLES, named[0].role) : '',
    c.setting !== 'elective' ? labelOf(SETTINGS_URGENCY, c.setting) : '',
    c.durationMin ? fmtMin(c.durationMin) : '',
  ].filter(Boolean);

  const groups = useStore().settings.procedureGroups ?? [];
  const loadGroup = (g: ProcedureGroup) => {
    const added = g.procedures.map((p) => ({ ...p, id: uid() }));
    // On an empty patient the group is "loaded" (changes can be saved back); otherwise its procedures are just added.
    if (!c.procedures.length) set({ procedures: added, groupId: g.id });
    else set({ procedures: [...c.procedures, ...added] });
    setOpenP(new Set());
  };
  const add = (item: VocabItem) => {
    const g = item.id.startsWith(GROUP_PREFIX) && groups.find((x) => GROUP_PREFIX + x.id === item.id);
    if (g) return loadGroup(g);
    const last = c.procedures[c.procedures.length - 1];
    const ids = item.parts ?? [item.id];
    const added: SurgeryProcedure[] = ids.map((procedureId) => ({
      id: uid(),
      procedureId,
      role: last?.role ?? 'assistant',
      approach: defaultApproach(procedureId) ?? last?.approach ?? 'laparoscopic',
    }));
    set({ procedures: [...c.procedures, ...added] });
    setOpenP(new Set(added.length === 1 ? [added[0].id] : []));
  };
  const removeProc = (k: number) => {
    const before = c;
    set({ procedures: c.procedures.filter((_, j) => j !== k) });
    offerUndo('Procedura eliminata', () => onChange(before));
  };

  return (
    <>
      <SwipeDelete onDelete={onRemove}>
        <div className="op-case-head">
          <button type="button" className="op-case-title" aria-expanded={open} onClick={onToggle}>
            <span className="op-badge">Paziente {n}</span>
            <span className="op-case-name">{caseTitle(c)}</span>
            {(meta.length > 0 || compl) && (
              <span className="op-case-meta">
                {meta.join(' · ')}
                {compl && <span className="compl-pill">Clavien {c.clavien}</span>}
              </span>
            )}
          </button>
          <button type="button" className="icon-btn small chevron-btn" aria-label={open ? 'Riduci' : 'Espandi'} aria-expanded={open} onClick={onToggle}>
            <Chevron open={open} />
          </button>
        </div>
      </SwipeDelete>
      {open && (
        <div className="op-case-body">
          <div className="op-label">Procedure</div>
          {c.procedures.length > 0 && (
            <div className={`op-procs${drag.dragging ? ' is-dragging' : ''}${drag.compact ? ' is-compacting' : ''}`} onPointerDown={drag.onPointerDown}>
              {c.procedures.map((p, k) => {
                const r = drag.row(p.id);
                return (
                  <div key={p.id} {...r} className={`op-proc${openP.has(p.id) ? ' open' : ''}${r.className}`}>
                    <ProcView
                      p={p}
                      open={openP.has(p.id)}
                      onToggle={() => toggleP(p.id)}
                      onChange={(np) => set({ procedures: c.procedures.map((x, j) => (j === k ? np : x)) })}
                      onRemove={() => removeProc(k)}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <GroupBar c={c} onChange={onChange} />
          {!c.procedures.length && groups.length > 0 && (
            <div className="scroll-x op-scroll">
              <div className="chips group-chips">
                {groups.map((g) => (
                  <button key={g.id} type="button" className="chip" onClick={() => loadGroup(g)}>
                    <span className="combo-tag">{g.procedures.length}</span>
                    {g.name || 'Gruppo'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <VocabSearch
            items={[...groups.map(groupItem), ...SEARCHABLE]}
            browse={[...groups.map(groupItem), ...PROCEDURE_COMBOS, ...PICKABLE]}
            frequent={[...groups.map(groupItem), ...frequent].slice(0, 8)}
            autoFocus={fresh}
            placeholder={c.procedures.length ? 'Aggiungi un’altra procedura…' : 'Cerca intervento (es. isterectomia, sentinella, TOT)…'}
            onPick={add}
          />

          <span className="op-label">Regime</span>
          <Seg label="Regime" items={SETTINGS_URGENCY} value={c.setting} onChange={(setting) => set({ setting })} />
          <div className="op-tiles">
            <div className="op-tile op-duration">
              <span className="op-tile-label">Durata intervento</span>
              <DurationField unit="min" label="Durata dell’intervento" value={c.durationMin} onChange={(durationMin) => set({ durationMin: durationMin || undefined })} />
            </div>
            <TutorTile colleagues={colleagues} value={c.tutorId} onChange={(tutorId) => set({ tutorId })} />
          </div>

          <label className="field op-notes">
            <span className="op-label">Note (senza dati identificativi)</span>
            <AutoText value={c.notes ?? ''} placeholder="Tecnica, difficoltà, cosa ho imparato…" onChange={(notes) => set({ notes: notes || undefined })} />
          </label>

          <Fold title="Complicanze" summary={compl ? <span className="warn">Clavien-Dindo {c.clavien}</span> : 'Nessuna'}>
            <ScrollChips label="Grado Clavien-Dindo" items={CLAVIEN_CHIPS} value={c.clavien ?? 'none'} onChange={(clavien) => set({ clavien: clavien === 'none' ? undefined : clavien })} />
            {compl && <AutoText className="op-compl-text" value={c.complicationNotes ?? ''} placeholder="Che cosa è successo (intra o postoperatoria)…" onChange={(v) => set({ complicationNotes: v || undefined })} />}
          </Fold>

          <div className="op-case-actions">
            <button type="button" className="btn-ghost small" onClick={onDuplicate}>
              Duplica paziente
            </button>
            <button type="button" className="btn-ghost small danger" onClick={onRemove}>
              <GlyphTrash /> Elimina
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ProcView({ p, open, onToggle, onChange, onRemove }: { p: SurgeryProcedure; open: boolean; onToggle: () => void; onChange: (p: SurgeryProcedure) => void; onRemove: () => void }) {
  const phase = procedurePhase(p.procedureId);
  const approaches = approachesFor(p.procedureId);
  const shownApproaches = approaches.some((a) => a.id === p.approach) ? approaches : [...approaches, ...APPROACHES.filter((a) => a.id === p.approach)];
  return (
    <>
      <SwipeDelete onDelete={onRemove}>
        <div className="op-proc-head">
          <DragGrip />
          <button type="button" className="op-proc-title" aria-expanded={open} onClick={onToggle}>
            <span className="op-proc-name">
              {phase && <span className={`phase-tag ${phase === 'Demolitivo' ? 'demo' : 'reco'}`}>{phase}</span>}
              {labelOf(PROCEDURES, p.procedureId) || 'Procedura'}
            </span>
            <span className="op-proc-meta">
              <b className={p.role === 'first' || p.role === 'first-tutored' ? 'lead' : undefined}>{labelOf(SURGICAL_ROLES, p.role)}</b> · {labelOf(APPROACHES, p.approach)}
            </span>
          </button>
          <button type="button" className="icon-btn small chevron-btn" aria-label={open ? 'Riduci' : 'Espandi'} aria-expanded={open} onClick={onToggle}>
            <Chevron open={open} />
          </button>
        </div>
      </SwipeDelete>
      {open && (
        <div className="op-proc-body">
          <span className="op-label">Il mio ruolo</span>
          <ChipChoice label="Il mio ruolo" items={ROLE_CHIPS} value={p.role} onChange={(role) => onChange({ ...p, role })} />
          {shownApproaches.length > 1 && (
            <>
              <span className="op-label">Via d’accesso</span>
              <ScrollChips label="Via d’accesso" items={shownApproaches} value={p.approach} onChange={(approach) => onChange({ ...p, approach })} />
            </>
          )}
          <span className="op-label">Cambia procedura</span>
          <VocabSearch
            items={PICKABLE}
            value={p.procedureId}
            placeholder="Cerca procedura…"
            onPick={(i) => onChange({ ...p, procedureId: i.id, approach: defaultApproach(i.id) ?? p.approach })}
          />
        </div>
      )}
    </>
  );
}

// ---------- Clinical activity ----------

export function ClinicalEditor({ value: m, onChange }: { value: ClinicalModule; onChange: (m: ClinicalModule) => void }) {
  const { settings } = useStore();
  const offerUndo = useUndo();
  const cases = clinicalCases(m);
  const save = (next: ClinicalCase[]) => onChange({ kind: 'clinical', id: m.id, cases: next });
  const [open, setOpen] = useState<Set<string>>(() => new Set(cases.length === 1 ? [cases[0].id] : []));
  const [fresh, setFresh] = useState<string | null>(null);
  const toggle = (id: string) => {
    setFresh(null);
    setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  };
  const attr = attrOf('clc', m.id);
  const drag = useRowDrag(cases, save, attr, '.op-case-head');
  const labels = clinicalLabels(cases);
  const frequent = useFrequent((x) => (x.kind === 'clinical' ? clinicalCases(x).flatMap((c) => c.items.map((it) => it.activityId)) : []), CLINICAL_ACTIVITIES);

  const addCase = (copy?: ClinicalCase) => {
    const last = cases[cases.length - 1];
    const c: ClinicalCase = copy
      ? { ...copy, id: uid(), items: copy.items.map((it) => ({ ...it, id: uid() })), notes: undefined }
      : { id: uid(), items: [], tutorId: last?.tutorId };
    save([...cases, c]);
    setOpen(new Set([c.id]));
    setFresh(copy ? null : c.id);
  };
  const removeCase = (i: number) => {
    const before = cases;
    save(cases.filter((_, k) => k !== i));
    offerUndo(`${labels[i]} eliminata`, () => save(before));
  };

  return (
    <div className={`op-list${drag.dragging ? ' is-dragging' : ''}${drag.compact ? ' is-compacting' : ''}`} onPointerDown={drag.onPointerDown}>
      {cases.map((c, i) => {
        const r = drag.row(c.id);
        return (
          <div key={c.id} {...r} className={`op-case${open.has(c.id) ? ' open' : ''}${r.className}`}>
            <ClinicalCaseView
              c={c}
              label={labels[i]}
              open={open.has(c.id)}
              fresh={fresh === c.id}
              colleagues={settings.colleagues}
              frequent={frequent}
              onToggle={() => toggle(c.id)}
              onChange={(nc) => save(cases.map((x, k) => (k === i ? nc : x)))}
              onRemove={() => removeCase(i)}
              onDuplicate={() => addCase(c)}
            />
          </div>
        );
      })}
      <button type="button" className="add-ex op-add" onClick={() => addCase()}>
        <GlyphPlus /> Aggiungi paziente
      </button>
    </div>
  );
}

function ClinicalCaseView({
  c,
  label,
  open,
  fresh,
  colleagues,
  frequent,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
}: {
  c: ClinicalCase;
  label: string;
  open: boolean;
  fresh: boolean;
  colleagues: Colleague[];
  frequent: VocabItem[];
  onToggle: () => void;
  onChange: (c: ClinicalCase) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const offerUndo = useUndo();
  const set = (p: Partial<ClinicalCase>) => onChange({ ...c, ...p });
  const attr = attrOf('cli', c.id);
  const drag = useRowDrag(c.items, (items) => set({ items }), attr, '.cl-item-head');
  const title = c.items.length ? c.items.map((it) => labelOf(CLINICAL_ACTIVITIES, it.activityId)).join(' + ') : 'Nessuna prestazione';
  const add = (i: VocabItem) => {
    const last = c.items[c.items.length - 1];
    set({ items: [...c.items, { id: uid(), activityId: i.id, role: last?.role ?? 'supervised' }] });
  };
  const removeItem = (k: number) => {
    const before = c;
    set({ items: c.items.filter((_, j) => j !== k) });
    offerUndo('Prestazione eliminata', () => onChange(before));
  };
  return (
    <>
      <SwipeDelete onDelete={onRemove}>
        <div className="op-case-head">
          <button type="button" className="op-case-title" aria-expanded={open} onClick={onToggle}>
            <span className="op-badge">{label}</span>
            <span className="op-case-name">{title}</span>
          </button>
          <button type="button" className="icon-btn small chevron-btn" aria-label={open ? 'Riduci' : 'Espandi'} aria-expanded={open} onClick={onToggle}>
            <Chevron open={open} />
          </button>
        </div>
      </SwipeDelete>
      {open && (
        <div className="op-case-body">
          <div className="op-label">Prestazioni</div>
          {c.items.length > 0 && (
            <div className={`op-procs${drag.dragging ? ' is-dragging' : ''}${drag.compact ? ' is-compacting' : ''}`} onPointerDown={drag.onPointerDown}>
              {c.items.map((it, k) => {
                const r = drag.row(it.id);
                return (
                  <div key={it.id} {...r} className={`op-proc cl-item${r.className}`}>
                    <ClinicalItemView it={it} onChange={(ni) => set({ items: c.items.map((x, j) => (j === k ? ni : x)) })} onRemove={() => removeItem(k)} />
                  </div>
                );
              })}
            </div>
          )}
          <VocabSearch items={CLINICAL_ACTIVITIES} frequent={frequent} autoFocus={fresh} placeholder={c.items.length ? 'Aggiungi un’altra prestazione…' : 'Cerca prestazione (es. visita, ecografia, CTG)…'} onPick={add} />

          <div className="op-count">
            <span className="op-label">Pazienti con queste stesse prestazioni</span>
            <div className="stepper">
              <button type="button" className="icon-btn small" aria-label="Una in meno" disabled={(c.count ?? 1) <= 1} onClick={() => set({ count: (c.count ?? 1) - 1 > 1 ? (c.count ?? 1) - 1 : undefined })}>
                −
              </button>
              <NumField value={c.count ?? 1} min={1} max={200} label="Numero di pazienti" className="stepper-num" onChange={(n) => set({ count: n > 1 ? n : undefined })} />
              <button type="button" className="icon-btn small" aria-label="Una in più" onClick={() => set({ count: (c.count ?? 1) + 1 })}>
                +
              </button>
            </div>
          </div>

          <TutorTile colleagues={colleagues} value={c.tutorId} onChange={(tutorId) => set({ tutorId })} />

          <label className="field op-notes">
            <span className="op-label">Note (senza dati identificativi)</span>
            <AutoText value={c.notes ?? ''} placeholder="Caso, diagnosi, cosa ho imparato…" onChange={(notes) => set({ notes: notes || undefined })} />
          </label>

          <div className="op-case-actions">
            <button type="button" className="btn-ghost small" onClick={onDuplicate}>
              Duplica paziente
            </button>
            <button type="button" className="btn-ghost small danger" onClick={onRemove}>
              <GlyphTrash /> Elimina
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ClinicalItemView({ it, onChange, onRemove }: { it: ClinicalItem; onChange: (it: ClinicalItem) => void; onRemove: () => void }) {
  return (
    <SwipeDelete onDelete={onRemove}>
      <div className="cl-item-head">
        <DragGrip />
        <div className="cl-item-main">
          <VocabSelect items={CLINICAL_ACTIVITIES} value={it.activityId} onChange={(activityId) => activityId && onChange({ ...it, activityId })} />
          <Seg label="Ruolo" className="cl-role" items={CLINICAL_ROLES} value={it.role ?? 'supervised'} onChange={(role) => onChange({ ...it, role })} />
        </div>
      </div>
    </SwipeDelete>
  );
}
