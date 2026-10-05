import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { allFoods, entryFor, FOOD_CATEGORIES, MEALS } from '../../lib/nutrition/foods';
import { useLibrary } from '../../lib/nutrition/library';
import { barcodeDetector, hasTorch, openBackCamera, productByBarcode, searchOff, setFocus, setTorch, validBarcode } from '../../lib/nutrition/off';
import type { Food, FoodEntry, MealId } from '../../lib/types';
import { GlyphClose, GlyphPlus } from '../icons';
import { Field, NumberInput, uid } from '../ui';

type Tab = 'search' | 'recent' | 'favorites' | 'barcode' | 'create' | 'quick';

const TABS: [Tab, string][] = [
  ['search', 'Cerca'],
  ['recent', 'Recenti'],
  ['favorites', 'Preferiti'],
  ['barcode', 'Codice a barre'],
  ['create', 'Nuovo alimento'],
  ['quick', 'Aggiunta rapida'],
];

const TAB_ICON: Record<Tab, string> = {
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l4.5 4.5',
  recent: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  favorites: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z',
  barcode: 'M4 5v14M7 5v14M10.5 5v14M14 5v14M16.5 5v14M20 5v14',
  create: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8v8M8 12h8',
  quick: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
};
const TONES = ['lime', 'lav', 'sage', 'sky', 'terra'];

/** Lower case without accents, so "ragu" finds "ragù". */
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Best first: name starts with the query as whole words, then the whole words anywhere, then word starts, then anything else. */
function rankOf(name: string, text: string, words: string[]) {
  const parts = name.split(/[\s,'(/-]+/);
  const whole = words.every((w) => parts.includes(w));
  if (name.startsWith(words.join(' '))) return whole ? 0 : 1;
  if (whole) return 2;
  if (words.every((w) => parts.some((x) => x.startsWith(w)))) return 3;
  return text.startsWith(words[0]) ? 4 : 5;
}

function FoodRow({ food, onPick, fav, onFav, picked }: { food: Food; onPick: () => void; fav: boolean; onFav: () => void; picked?: boolean }) {
  return (
    <li className={`food-row${picked ? ' picked' : ''}`}>
      <span className={`food-disc tone-${TONES[(food.name.charCodeAt(0) || 0) % TONES.length]}`} aria-hidden="true">
        {food.name.charAt(0).toUpperCase()}
      </span>
      <button className="ex-item" onClick={onPick}>
        <span className="ex-name">
          {food.name}
          {food.brand && <span className="muted"> · {food.brand}</span>}
        </span>
        <span className="ex-meta">
          <b>{food.kcal} kcal</b> / 100 g · P {food.protein} · C {food.carbs} · G {food.fat}{food.source === 'off' ? ' · Open Food Facts' : food.origin ? ` · ${food.origin}` : ''}
        </span>
      </button>
      <button className={`fav${fav ? ' on' : ''}`} aria-label={fav ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} aria-pressed={fav} onClick={onFav}>
        ★
      </button>
    </li>
  );
}

/** Quantity step: quick portions, grams with − / +, live macros, meal choice. */
function Quantity({ food, meal, onMeal, onAdd, onBack, inline }: { food: Food; meal: MealId; onMeal: (m: MealId) => void; onAdd: (e: FoodEntry) => void; onBack: () => void; inline?: boolean }) {
  const [grams, setGrams] = useState<number | undefined>(food.portionG ?? 100);
  const e = entryFor(food, grams ?? 0, uid());
  const unit = (food.portionName ?? 'porzione').replace(/^1\s+/, '');
  const portions: [string, number][] = [
    ...(food.portionG
      ? ([
          [`½ ${unit}`, Math.round(food.portionG / 2)],
          [`${food.portionName ?? '1 porzione'} (${food.portionG} g)`, food.portionG],
          [`2 × ${unit}`, food.portionG * 2],
        ] as [string, number][])
      : []),
    ['100 g', 100],
  ];
  const step = (grams ?? 0) >= 100 ? 10 : 5;
  const mealLabel = MEALS.find((m) => m.id === meal)?.label ?? '';
  return (
    <div className={`quantity${inline ? ' inline' : ''}`}>
      {!inline && (
        <h3 className="q-name">
          {food.name}
          {food.brand && <span className="muted"> · {food.brand}</span>}
        </h3>
      )}
      <span className="q-label">Porzione rapida</span>
      <div className="q-portions">
        {portions.map(([label, g]) => (
          <button key={label} type="button" className={grams === g ? 'on' : ''} onClick={() => setGrams(g)}>
            {label}
          </button>
        ))}
      </div>
      <div className="q-stepper">
        <span>Grammi</span>
        <button type="button" aria-label="Meno" onClick={() => setGrams(Math.max(step, (grams ?? 0) - step))}>
          −
        </button>
        <span className="q-grams">
          <NumberInput value={grams} step={5} onChange={setGrams} />
          <small>g</small>
        </span>
        <button type="button" aria-label="Più" onClick={() => setGrams((grams ?? 0) + step)}>
          +
        </button>
      </div>
      <div className="q-summary">
        <strong>
          <i aria-hidden="true" /> {e.kcal} kcal
        </strong>
        <span>
          Proteine <b>{e.protein} g</b> · Carboidrati <b>{e.carbs} g</b> · Grassi <b>{e.fat} g</b>
        </span>
      </div>
      <label className="q-meal">
        <span>Pasto</span>
        <select value={meal} onChange={(ev) => onMeal(ev.target.value as MealId)}>
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <button className="lime-banner q-add" disabled={!grams} onClick={() => onAdd(e)}>
        <span>Aggiungi a {mealLabel}</span>
        <span aria-hidden="true">›</span>
      </button>
      <button type="button" className="q-back" onClick={onBack}>
        Annulla o scegli un altro alimento
      </button>
    </div>
  );
}

export function FoodSheet({ meal: initialMeal, onAdd, onClose }: { meal: MealId; onAdd: (meal: MealId, e: FoodEntry) => void; onClose: () => void }) {
  const store = useStore();
  const { settings } = store;
  const custom = settings.foods ?? [];
  const favs = settings.favoriteFoods ?? [];
  const [tab, setTab] = useState<Tab>('search');
  const [meal, setMeal] = useState<MealId>(initialMeal);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [online, setOnline] = useState<Food[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [torch, setTorchOn] = useState<boolean | null>(null); // null: the camera has no torch
  const [draft, setDraft] = useState<Food>({ id: '', name: '', kcal: 0, protein: 0, carbs: 0, fat: 0, source: 'custom', category: 'Piatti pronti' });
  const [quick, setQuick] = useState({ name: '', kcal: undefined as number | undefined, protein: undefined as number | undefined, carbs: undefined as number | undefined, fat: undefined as number | undefined });

  useEffect(() => {
    store.ensureAllLoaded();
  }, [store]);

  const library = useLibrary();
  const foods = useMemo(() => [...allFoods(custom), ...library], [custom, library]);
  // Normalised once per list (over 3,000 foods), not on every keystroke.
  const index = useMemo(() => foods.map((f) => ({ f, name: norm(f.name), text: norm(`${f.name} ${f.brand ?? ''} ${f.category ?? ''}`) })), [foods]);
  const local = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return foods.slice(0, 40);
    return index
      .filter(({ text }) => words.every((w) => text.includes(w)))
      .map(({ f, name, text }) => ({ f, rank: rankOf(name, text, words) }))
      .sort((a, b) => a.rank - b.rank || a.f.name.length - b.f.name.length)
      .slice(0, 60)
      .map(({ f }) => f);
  }, [q, foods, index]);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    const days = [...store.allDays].sort((a, b) => b.date.localeCompare(a.date));
    for (const d of days) {
      for (const list of Object.values(d.food?.meals ?? {})) {
        for (const e of list ?? []) {
          if (!e.foodId || seen.has(e.foodId)) continue;
          const f = foods.find((x) => x.id === e.foodId);
          if (f) {
            seen.add(e.foodId);
            out.push(f);
          }
        }
      }
      if (out.length >= 30) break;
    }
    return out;
  }, [store.allDays, foods]);

  const toggleFav = (id: string) =>
    store.saveSettings({ ...settings, favoriteFoods: favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id] });

  /** Products from Open Food Facts are saved locally the first time they are used. */
  const remember = (f: Food) => {
    if (f.source === 'off' && !custom.some((c) => c.id === f.id)) store.saveSettings({ ...settings, foods: [...custom, f] });
  };

  async function lookup(c: string) {
    setBusy(true);
    setErr(undefined);
    try {
      const f = custom.find((x) => x.barcode === c) ?? (await productByBarcode(c));
      if (f) setPicked(f);
      else setErr('Prodotto non trovato su Open Food Facts: puoi crearlo in “Nuovo alimento”.');
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const stopScan = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
    setTorchOn(null);
  };
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  async function startScan() {
    const det = barcodeDetector();
    if (!det) {
      setErr('Questo browser non legge i codici a barre dalla fotocamera: inserisci il numero sotto il codice.');
      return;
    }
    setErr(undefined);
    try {
      const s = await openBackCamera();
      stream.current = s;
      setTorchOn(hasTorch(s) ? false : null);
      setScanning(true);
      await new Promise((r) => setTimeout(r, 50));
      if (!video.current || stream.current !== s) return;
      video.current.srcObject = s;
      await video.current.play();
      // A code counts only when its check digit is right and the same code is read in
      // three frames in a row: blurred frames give wrong or changing numbers.
      let last = '';
      let same = 0;
      const loop = async () => {
        if (stream.current !== s || !video.current || video.current.paused) return;
        const found = await det.detect(video.current).catch(() => []);
        const hit = found.find((f) => validBarcode(f.rawValue, f.format));
        if (hit) {
          same = hit.rawValue === last ? same + 1 : 1;
          last = hit.rawValue;
          if (same >= 3) {
            navigator.vibrate?.(30);
            stopScan();
            setCode(hit.rawValue);
            lookup(hit.rawValue);
            return;
          }
        } else same = 0;
        window.setTimeout(loop, 90);
      };
      loop();
    } catch {
      stopScan();
      setErr('Fotocamera non disponibile.');
    }
  }

  // The chosen food opens right under its row; foods picked elsewhere (barcode, new) open on top.
  let shownInline = false;
  const add = (e: FoodEntry) => {
    if (!picked) return;
    remember(picked);
    onAdd(meal, e);
    setPicked(null);
  };
  const list = (items: Food[], empty: string) =>
    items.length ? (
      <ul className="ex-list">
        {items.map((f) => {
          const open = picked?.id === f.id;
          if (open) shownInline = true;
          return (
            <Fragment key={f.id}>
              <FoodRow food={f} picked={open} fav={favs.includes(f.id)} onFav={() => toggleFav(f.id)} onPick={() => setPicked(open ? null : f)} />
              {open && (
                <li className="q-inline">
                  <Quantity inline food={f} meal={meal} onMeal={setMeal} onBack={() => setPicked(null)} onAdd={add} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>
    ) : (
      <p className="empty">{empty}</p>
    );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet food-sheet" role="dialog" aria-label="Aggiungi alimento" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Aggiungi a {MEALS.find((m) => m.id === meal)?.label}</h2>
          <button className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        {(
          <>
            <div className="tabs-scroll" role="tablist">
              {TABS.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={`chip${tab === id ? ' chip-on' : ''}`} onClick={() => { setTab(id); setPicked(null); }}>
                  <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={TAB_ICON[id]} />
                  </svg>
                  {label}
                </button>
              ))}
            </div>
            {err && <p className="error small">{err}</p>}

            {tab === 'search' && (
              <>
                <div className="picker-tools">
                  <span className="icon-input food-search">
                    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d={TAB_ICON.search} />
                    </svg>
                    <input
                      type="search"
                      autoFocus
                      placeholder="Cerca alimento, piatto o marca…"
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setOnline(null);
                      }}
                    />
                    {q && (
                      <button type="button" className="clear-q" aria-label="Cancella" onClick={() => { setQ(''); setOnline(null); }}>
                        ×
                      </button>
                    )}
                  </span>
                  <button
                    className="btn-ghost small"
                    disabled={q.trim().length < 3 || busy}
                    onClick={async () => {
                      setBusy(true);
                      setErr(undefined);
                      try {
                        setOnline(await searchOff(q.trim()));
                      } catch (e) {
                        setErr(`Ricerca online non riuscita: ${e instanceof Error ? e.message : e}`);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? 'Cerco…' : 'Cerca prodotti online'}
                  </button>
                </div>
                {online ? list(online, 'Nessun prodotto trovato online.') : list(local, 'Nessun alimento trovato: prova “Cerca prodotti online” o creane uno nuovo.')}
              </>
            )}
            {tab === 'recent' && list(recent, 'Gli alimenti che registri compariranno qui.')}
            {tab === 'favorites' && list(foods.filter((f) => favs.includes(f.id)), 'Tocca ★ su un alimento per aggiungerlo ai preferiti.')}

            {tab === 'barcode' && (
              <div className="barcode">
                {scanning ? (
                  <div className="scanner-wrap">
                    {/* Tapping the preview refocuses, like the camera app. */}
                    <div className="scanner-box">
                      <video ref={video} className="scanner" playsInline muted onClick={() => stream.current && setFocus(stream.current, 'single-shot').then(() => window.setTimeout(() => stream.current && setFocus(stream.current, 'continuous'), 1200))} />
                      <span className="scan-frame" aria-hidden="true" />
                    </div>
                    <span className="scan-hint">Avvicina il codice dentro il riquadro · tocca per mettere a fuoco</span>
                    <div className="scan-actions">
                      {torch !== null && (
                        <button
                          type="button"
                          className={`btn-ghost small${torch ? ' on' : ''}`}
                          onClick={() => {
                            if (!stream.current) return;
                            setTorch(stream.current, !torch);
                            setTorchOn(!torch);
                          }}
                        >
                          {torch ? 'Spegni torcia' : 'Torcia'}
                        </button>
                      )}
                      <button type="button" className="btn-ghost small" onClick={stopScan}>
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn" onClick={startScan}>
                    Scansiona con la fotocamera
                  </button>
                )}
                <div className="picker-tools">
                  <input inputMode="numeric" placeholder="oppure scrivi il codice (EAN)" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                  <button className="btn-ghost small" disabled={code.length < 8 || busy} onClick={() => lookup(code)}>
                    {busy ? 'Cerco…' : 'Cerca'}
                  </button>
                </div>
                <p className="muted small">I dati dei prodotti confezionati provengono da Open Food Facts, database libero e collaborativo.</p>
              </div>
            )}

            {tab === 'create' && (
              <div className="grid">
                <Field label="Nome" wide>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <Field label="Marca">
                  <input value={draft.brand ?? ''} onChange={(e) => setDraft({ ...draft, brand: e.target.value || undefined })} />
                </Field>
                <Field label="Categoria">
                  <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    {FOOD_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                {(
                  [
                    ['kcal', 'kcal / 100 g'],
                    ['protein', 'Proteine g'],
                    ['carbs', 'Carboidrati g'],
                    ['fat', 'Grassi g'],
                    ['fiber', 'Fibre g'],
                    ['portionG', 'Porzione (g)'],
                  ] as [keyof Food, string][]
                ).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <NumberInput value={draft[k] as number | undefined} step={0.1} onChange={(v) => setDraft({ ...draft, [k]: v ?? (k === 'fiber' || k === 'portionG' ? undefined : 0) })} />
                  </Field>
                ))}
                <Field label="Nome porzione">
                  <input value={draft.portionName ?? ''} placeholder="es. 1 vasetto" onChange={(e) => setDraft({ ...draft, portionName: e.target.value || undefined })} />
                </Field>
                <Field label="Codice a barre">
                  <input inputMode="numeric" value={draft.barcode ?? ''} onChange={(e) => setDraft({ ...draft, barcode: e.target.value || undefined })} />
                </Field>
                <div className="row field-wide">
                  <button
                    className="btn"
                    disabled={!draft.name.trim()}
                    onClick={() => {
                      const f = { ...draft, id: `food-${uid()}`, name: draft.name.trim() };
                      store.saveSettings({ ...settings, foods: [...custom, f] });
                      setPicked(f);
                    }}
                  >
                    Salva e aggiungi
                  </button>
                </div>
              </div>
            )}

            {tab === 'quick' && (
              <div className="grid">
                <Field label="Descrizione" wide>
                  <input value={quick.name} placeholder="es. Pranzo in mensa" onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
                </Field>
                <Field label="kcal">
                  <NumberInput value={quick.kcal} step={10} onChange={(kcal) => setQuick({ ...quick, kcal })} />
                </Field>
                <Field label="Proteine g">
                  <NumberInput value={quick.protein} onChange={(protein) => setQuick({ ...quick, protein })} />
                </Field>
                <Field label="Carboidrati g">
                  <NumberInput value={quick.carbs} onChange={(carbs) => setQuick({ ...quick, carbs })} />
                </Field>
                <Field label="Grassi g">
                  <NumberInput value={quick.fat} onChange={(fat) => setQuick({ ...quick, fat })} />
                </Field>
                <Field label="Pasto">
                  <select value={meal} onChange={(e) => setMeal(e.target.value as MealId)}>
                    {MEALS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="row field-wide">
                  <button
                    className="btn"
                    disabled={!quick.kcal}
                    onClick={() =>
                      onAdd(meal, {
                        id: uid(),
                        name: quick.name || 'Aggiunta rapida',
                        grams: 0,
                        kcal: quick.kcal ?? 0,
                        protein: quick.protein ?? 0,
                        carbs: quick.carbs ?? 0,
                        fat: quick.fat ?? 0,
                      })
                    }
                  >
                    <GlyphPlus /> Aggiungi
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {picked && !shownInline && <Quantity food={picked} meal={meal} onMeal={setMeal} onBack={() => setPicked(null)} onAdd={add} />}
      </div>
    </div>
  );
}
