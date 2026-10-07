import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../../lib/store/StoreContext';
import { allFoods, entryFor, FOOD_CATEGORIES, MEALS } from '../../lib/nutrition/foods';
import { useLibrary } from '../../lib/nutrition/library';
import { barcodeDetector, hasTorch, openBackCamera, productByBarcode, searchOff, setFocus, setTorch, validBarcode } from '../../lib/nutrition/off';
import type { Food, FoodEntry, MealId } from '../../lib/types';
import { GlyphPlus, IconBreakfast, IconDinner, IconLunch, IconSnack, Sym } from '../icons';
import { SwipeDelete } from '../SwipeDelete';
import { useUndo } from '../Undo';
import { today } from '../../lib/dates';
import type { SymName } from '../ms';
import { Field, NumberInput, uid } from '../ui';

type Tab = 'search' | 'recent' | 'favorites' | 'barcode' | 'create' | 'quick';

/** The icon tabs under the search (search and barcode open from the search row). */
const TABS: [Tab, string][] = [
  ['recent', 'Recenti'],
  ['favorites', 'Preferiti'],
  ['create', 'Nuovo alimento'],
  ['quick', 'Aggiunta rapida'],
];

const ICON: Record<Tab | 'heart' | 'back', SymName> = {
  search: 'search',
  recent: 'history',
  favorites: 'favorite',
  heart: 'favorite',
  barcode: 'barcode_scanner',
  create: 'post_add',
  quick: 'bolt',
  back: 'arrow_back',
};
const Icon = ({ d, size = 22, fill }: { d: SymName; size?: number; fill?: boolean }) => <Sym name={d} size={size} fill={fill} />;

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

/** Usual portion of a food: its own portion, or 100 g. */
const usual = (f: Food) => f.portionG ?? 100;

/** A food as a card: name, usual portion with kcal and ♥, macro badges, round + that adds the usual portion. */
const MEAL_ICON: Record<MealId, (p: { size?: number }) => ReactNode> = { breakfast: IconBreakfast, lunch: IconLunch, dinner: IconDinner, snack: IconSnack };

function FoodRow({ food, onPick, fav, onFav, onQuick, picked, onSwipe, children }: { food: Food; onPick: () => void; fav: boolean; onFav: () => void; onQuick: () => void; picked?: boolean; /** Swiping the row left removes it from this list. */ onSwipe?: () => void; children?: ReactNode }) {
  const g = usual(food);
  const e = entryFor(food, g, '');
  const portion = food.portionG ? `${(food.portionName ?? '1 porzione').replace(/^1\s+/, '1 ')} (${g} g)` : '100 g';
  return (
    <li className={`food-card${picked ? ' picked' : ''}`}>
      <Swipeable onSwipe={onSwipe}>
      <div className="fc-row">
      <button type="button" className="fc-main" onClick={onPick} aria-expanded={picked}>
        <span className="fc-name">
          {food.name}
          {food.brand && <span className="muted"> · {food.brand}</span>}
        </span>
        <span className="fc-portion">
          {portion} · <b>{e.kcal} kcal</b>
          {food.source === 'off' ? <span className="fc-src"> · Open Food Facts</span> : food.origin ? <span className="fc-src"> · {food.origin}</span> : null}
        </span>
        <span className="fc-macros">
          <span className="mp c"><b>C</b> {fmtG(e.carbs)}</span>
          <span className="mp p"><b>P</b> {fmtG(e.protein)}</span>
          <span className="mp g"><b>G</b> {fmtG(e.fat)}</span>
        </span>
      </button>
      <button type="button" className={`fc-fav${fav ? ' on' : ''}`} aria-label={fav ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} aria-pressed={fav} onClick={onFav}>
        <Icon d={ICON.heart} size={20} fill={fav} />
      </button>
      <button type="button" className="fc-add" aria-label={`Aggiungi ${food.name} (${g} g)`} onClick={onQuick}>
        <Icon d="add" size={22} />
      </button>
      </div>
      </Swipeable>
      {children}
    </li>
  );
}

function Swipeable({ onSwipe, children }: { onSwipe?: () => void; children: ReactNode }) {
  return onSwipe ? <SwipeDelete onDelete={onSwipe}>{children}</SwipeDelete> : <>{children}</>;
}

const fmtG = (n: number) => `${Math.round(n * 10) / 10}`.replace('.', ',') + ' g';

/** Quantity step: quick portions, grams with − / +, live macros, meal choice. */
function Quantity({ food, meal, onMeal, onAdd, onBack, inline, fav, onFav }: { food: Food; meal: MealId; onMeal: (m: MealId) => void; onAdd: (e: FoodEntry) => void; onBack: () => void; inline?: boolean; fav?: boolean; onFav?: () => void }) {
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
  const box = useRef<HTMLDivElement>(null);
  const free = !portions.some(([, g]) => g === grams);
  return (
    <div ref={box} className={`quantity${inline ? ' inline' : ''}`}>
      {!inline && (
        <div className="q-head">
          <h3 className="q-name">
            {food.name}
            {food.brand && <span className="muted"> · {food.brand}</span>}
          </h3>
          {onFav && (
            <button type="button" className={`fc-fav${fav ? ' on' : ''}`} aria-label={fav ? 'Preferiti: scegli i pasti' : 'Aggiungi ai preferiti'} aria-pressed={!!fav} onClick={onFav}>
              <Icon d={ICON.heart} size={22} fill={!!fav} />
            </button>
          )}
        </div>
      )}
      <span className="q-label">Porzione rapida</span>
      <div className="q-portions">
        {portions.map(([label, g]) => (
          <button key={label} type="button" className={grams === g ? 'on' : ''} onClick={() => setGrams(g)}>
            {label}
          </button>
        ))}
        <button type="button" className={free ? 'on' : ''} onClick={() => box.current?.querySelector<HTMLInputElement>('.q-grams input')?.focus()}>
          Porzione libera
        </button>
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

export function FoodSheet({
  meal: initialMeal,
  onAdd,
  onClose,
  eaten,
  goals,
}: {
  meal: MealId;
  onAdd: (meal: MealId, e: FoodEntry) => void;
  onClose: () => void;
  /** What the day already has, to show the daily intake at the top. */
  eaten: { kcal: number; protein: number; carbs: number; fat: number };
  goals: { kcalIn?: number; proteinG?: number; carbsG?: number; fatG?: number };
}) {
  const store = useStore();
  const { settings } = store;
  const custom = settings.foods ?? [];
  const legacyFavs = settings.favoriteFoods ?? [];
  const folders = settings.favoriteFolders ?? {};
  const hidden = settings.hiddenRecentFoods ?? {};
  const isFav = (id: string) => legacyFavs.includes(id) || MEALS.some((m) => folders[m.id]?.includes(id));
  const offerUndo = useUndo();
  const [tab, setTab] = useState<Tab>('recent');
  const [added, setAdded] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealId>(initialMeal);
  const [folder, setFolder] = useState<MealId>(initialMeal);
  const [favFor, setFavFor] = useState<Food | null>(null);
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
  const [lastFound, setLastFound] = useState<{ food: Food; code: string } | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
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
          if (hidden[e.foodId] && d.date <= hidden[e.foodId]) continue;
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
  }, [store.allDays, foods, hidden]);

  /** Puts a food in (or takes it out of) the favourites folder of a meal; old folder-less favourites move into folders. */
  const setInFolder = (id: string, m: MealId, on: boolean) => {
    const cur = folders[m] ?? [];
    const next = { ...folders, [m]: on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id) };
    store.saveSettings({ ...settings, favoriteFolders: next, favoriteFoods: legacyFavs.filter((x) => x !== id) });
  };
  const unfavourite = (id: string) => {
    const next = Object.fromEntries(Object.entries(folders).map(([k, v]) => [k, (v ?? []).filter((x) => x !== id)]));
    store.saveSettings({ ...settings, favoriteFolders: next, favoriteFoods: legacyFavs.filter((x) => x !== id) });
  };
  /** Heart: a food that is not a favourite yet goes straight into the folder of the meal being filled; then the folders can be picked. */
  const onHeart = (f: Food) => {
    if (!isFav(f.id)) {
      // A scanned product (Open Food Facts) is saved locally too, so it stays among the favourites.
      const keep = f.source === 'off' && !custom.some((c) => c.id === f.id);
      const cur = folders[meal] ?? [];
      store.saveSettings({
        ...settings,
        ...(keep ? { foods: [...custom, f] } : {}),
        favoriteFolders: { ...folders, [meal]: [...cur, f.id] },
        favoriteFoods: legacyFavs.filter((x) => x !== f.id),
      });
    }
    setFavFor(f);
  };
  const hideRecent = (f: Food) => {
    const before = settings;
    store.saveSettings({ ...settings, hiddenRecentFoods: { ...hidden, [f.id]: today() } });
    offerUndo(`${f.name} tolto dai recenti`, () => store.saveSettings(before));
  };
  const removeFromFolder = (f: Food, m: MealId) => {
    const before = settings;
    setInFolder(f.id, m, false);
    offerUndo(`${f.name} tolto da ${MEALS.find((x) => x.id === m)!.label}`, () => store.saveSettings(before));
  };

  /** Products from Open Food Facts are saved locally the first time they are used; a food used again comes back among the recents. */
  const remember = (f: Food) => {
    const keep = f.source === 'off' && !custom.some((c) => c.id === f.id);
    const shown = f.id in hidden;
    if (!keep && !shown) return;
    const { [f.id]: _gone, ...rest } = hidden;
    void _gone;
    store.saveSettings({ ...settings, ...(keep ? { foods: [...custom, f] } : {}), ...(shown ? { hiddenRecentFoods: rest } : {}) });
  };

  async function lookup(c: string) {
    setBusy(true);
    setErr(undefined);
    try {
      const f = custom.find((x) => x.barcode === c) ?? (await productByBarcode(c));
      if (f) {
        setPicked(f);
        setLastFound({ food: f, code: c });
        window.setTimeout(() => document.querySelector('.fs-body > .quantity')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      } else setErr('Prodotto non trovato su Open Food Facts: puoi crearlo in “Nuovo alimento”.');
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  /** Reads the code from a photo (for a label the camera can't focus on). */
  async function fromPhoto(file: File | undefined) {
    if (gallery.current) gallery.current.value = '';
    const det = barcodeDetector();
    if (!file) return;
    if (!det) return setErr('Questo browser non legge i codici a barre dalle foto: scrivi il numero sotto il codice.');
    try {
      const found = await det.detect(await createImageBitmap(file));
      const hit = found.find((f) => validBarcode(f.rawValue, f.format));
      if (!hit) return setErr('Nessun codice leggibile nella foto: prova con una foto più vicina e a fuoco.');
      stopScan();
      setCode(hit.rawValue);
      lookup(hit.rawValue);
    } catch {
      setErr('Non riesco a leggere questa foto.');
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

  // The chosen food opens right under its card; foods picked elsewhere (barcode, new) open on top.
  // The screen stays open after adding, to add more foods to the same meal.
  let shownInline = false;
  const flash = (name: string) => {
    setAdded(name);
    window.setTimeout(() => setAdded((x) => (x === name ? null : x)), 1800);
  };
  const add = (e: FoodEntry) => {
    if (!picked) return;
    remember(picked);
    onAdd(meal, e);
    flash(picked.name);
    setPicked(null);
  };
  const quickAdd = (f: Food) => {
    remember(f);
    onAdd(meal, entryFor(f, usual(f), uid()));
    navigator.vibrate?.(10);
    flash(f.name);
  };
  const list = (items: Food[], empty: string, title?: string, onSwipe?: (f: Food) => void) =>
    items.length ? (
      <>
        {title && <h3 className="fs-kicker">{title}</h3>}
        <ul className="food-cards">
          {items.map((f) => {
            const open = picked?.id === f.id;
            if (open) shownInline = true;
            return (
              <Fragment key={f.id}>
                <FoodRow food={f} picked={open} fav={isFav(f.id)} onFav={() => onHeart(f)} onPick={() => setPicked(open ? null : f)} onQuick={() => quickAdd(f)} onSwipe={onSwipe && (() => onSwipe(f))}>
                  {open && <Quantity inline food={f} meal={meal} onMeal={setMeal} onBack={() => setPicked(null)} onAdd={add} />}
                </FoodRow>
              </Fragment>
            );
          })}
        </ul>
      </>
    ) : (
      <p className="fs-empty">{empty}</p>
    );

  const searching = tab === 'search';
  const bar = (label: string, v: number, goal: number | undefined, tone: string) => (
    <div className={`fs-macro tone-${tone}`}>
      <span>{label}</span>
      <span className="fs-track">
        <span style={{ width: `${goal ? Math.min(100, (v / goal) * 100) : 0}%` }} />
      </span>
      <small>
        {Math.round(v)} g{goal ? ` / ${goal} g` : ''}
      </small>
    </div>
  );

  return (
    <div className="sheet-backdrop food-screen">
      <div className="fs-page" role="dialog" aria-label={`Aggiungi a ${MEALS.find((m) => m.id === meal)?.label}`}>
        <header className="fs-head">
          <button type="button" className="icon-btn fs-back" aria-label="Indietro" data-back onClick={onClose}>
            <Icon d={ICON.back} />
          </button>
          <label className="fs-meal fs-meal-pill">
            <span className="sr-only">Pasto</span>
            <select value={meal} onChange={(e) => setMeal(e.target.value as MealId)}>
              {MEALS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="icon-btn fs-close" aria-label="Chiudi" onClick={onClose}>
            <Icon d="close" />
          </button>
        </header>
        <div className="fs-search">
          <span className="icon-input food-search">
            <Icon d={ICON.search} size={18} />
            <input
              type="search"
              placeholder="Cibo, piatto o marca"
              value={q}
              onFocus={() => setTab('search')}
              onChange={(e) => {
                setQ(e.target.value);
                setOnline(null);
                setTab('search');
              }}
            />
            {q && (
              <button type="button" className="clear-q" aria-label="Cancella" onClick={() => { setQ(''); setOnline(null); }}>
                ×
              </button>
            )}
          </span>
          <button type="button" className={`fs-scan${tab === 'barcode' ? ' on' : ''}`} aria-label="Codice a barre" onClick={() => { setTab('barcode'); setPicked(null); if (!scanning) startScan(); }}>
            <Icon d={ICON.barcode} size={28} />
          </button>
        </div>

        <div className="fs-body">
          {!searching && tab !== 'barcode' && (
            <section className="fs-intake">
              <div className="fs-intake-head">
                <strong>
                  Assunzione giornaliera
                  {goals.kcalIn ? <span className="fs-pct">{Math.round((eaten.kcal / goals.kcalIn) * 100)}%</span> : null}
                </strong>
                <strong>
                  {Math.round(eaten.kcal)}
                  {goals.kcalIn ? ` / ${goals.kcalIn}` : ''} kcal
                </strong>
              </div>
              <span className="fs-track big">
                <span style={{ width: `${goals.kcalIn ? Math.min(100, (eaten.kcal / goals.kcalIn) * 100) : 0}%` }} />
              </span>
              <div className="fs-macros">
                {bar('Carboidrati', eaten.carbs, goals.carbsG, 'lime')}
                {bar('Proteine', eaten.protein, goals.proteinG, 'lav')}
                {bar('Grassi', eaten.fat, goals.fatG, 'sky')}
              </div>
            </section>
          )}

          {!searching && tab !== 'barcode' && (
            <div className="fs-tabs" role="tablist">
              {TABS.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} aria-label={label} title={label} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setPicked(null); }}>
                  <Icon d={ICON[id]} size={24} />
                  <small>{label}</small>
                </button>
              ))}
            </div>
          )}
          {err && <p className="error small">{err}</p>}

          {searching && (
            <>
              <button
                type="button"
                className="btn-ghost small fs-online"
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
                {busy ? 'Cerco…' : 'Cerca anche tra i prodotti online'}
              </button>
              {online
                ? list(online, 'Nessun prodotto trovato online.', 'Prodotti online')
                : q.trim()
                  ? list(local, 'Nessun alimento trovato: prova la ricerca online o crea un nuovo alimento.', 'Alimenti')
                  : list(recent.length ? recent : local, 'Scrivi il nome di un alimento.', recent.length ? 'Recenti' : 'Alimenti')}
              <button type="button" className="q-back" onClick={() => { setQ(''); setOnline(null); setTab('recent'); }}>
                Chiudi la ricerca
              </button>
            </>
          )}
            {tab === 'recent' && list(recent, 'Qui troverai i cibi registrati di recente, per aggiungerli al volo.', 'Recenti', hideRecent)}
            {tab === 'favorites' && (
              <>
                <div className="fav-folders" role="tablist" aria-label="Cartelle dei preferiti">
                  {MEALS.map((m) => {
                    const I = MEAL_ICON[m.id];
                    const n = (folders[m.id] ?? []).length;
                    return (
                      <button key={m.id} type="button" role="tab" aria-selected={folder === m.id} className={`fav-folder${folder === m.id ? ' on' : ''}`} onClick={() => { setFolder(m.id); setPicked(null); }}>
                        <I size={40} />
                        <span className="ff-name">{m.label}</span>
                        <span className="ff-count">{n === 1 ? '1 alimento' : `${n} alimenti`}</span>
                      </button>
                    );
                  })}
                </div>
                {list(
                  (folders[folder] ?? []).map((id) => foods.find((f) => f.id === id)).filter((f): f is Food => !!f),
                  `Nessun preferito in ${MEALS.find((m) => m.id === folder)!.label}. Tocca ♡ su un alimento e scegli la cartella.`,
                  MEALS.find((m) => m.id === folder)!.label,
                  (f) => removeFromFolder(f, folder),
                )}
                {legacyFavs.length > 0 && list(foods.filter((f) => legacyFavs.includes(f.id)), '', 'Da mettere in una cartella')}
              </>
            )}

            {tab === 'barcode' && (
              <div className="barcode scan-page">
                <button type="button" className="q-back" onClick={() => { stopScan(); setTab('recent'); }}>
                  ‹ Torna agli alimenti
                </button>
                <div className="scan-title">
                  <h3>Scanner codice</h3>
                  <p>Inquadra la confezione o scrivi il numero sotto il codice</p>
                </div>
                <div className="scan-view">
                  {scanning ? (
                    // Tapping the preview refocuses, like the camera app.
                    <video ref={video} className="scanner" playsInline muted onClick={() => stream.current && setFocus(stream.current, 'single-shot').then(() => window.setTimeout(() => stream.current && setFocus(stream.current, 'continuous'), 1200))} />
                  ) : (
                    <button type="button" className="scan-start" onClick={startScan}>
                      <Icon d={ICON.barcode} size={30} />
                      Avvia la fotocamera
                    </button>
                  )}
                  {scanning && (
                    <span className="scan-guide" aria-hidden="true">
                      <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
                      <i className="laser" />
                    </span>
                  )}
                  {scanning && <span className="scan-hint2">Avvicina il codice dentro il riquadro · tocca per mettere a fuoco</span>}
                </div>
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
                      {torch ? 'Torcia accesa' : 'Torcia'}
                    </button>
                  )}
                  <button type="button" className="btn-ghost small" onClick={() => gallery.current?.click()}>
                    Galleria
                  </button>
                  <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => fromPhoto(e.target.files?.[0])} />
                  {scanning && (
                    <button type="button" className="btn-ghost small" onClick={stopScan}>
                      Annulla
                    </button>
                  )}
                </div>
                <section className="scan-manual">
                  <div className="scan-manual-head">
                    <span>Oppure scrivi il codice (EAN / UPC)</span>
                    <small>8–13 cifre</small>
                  </div>
                  <div className="scan-manual-row">
                    <input inputMode="numeric" placeholder="Es. 8001234567890" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                    <button type="button" className="btn scan-go" disabled={code.length < 8 || busy} onClick={() => lookup(code)}>
                      {busy ? 'Cerco…' : 'Cerca ›'}
                    </button>
                  </div>
                </section>
                {lastFound && (
                  <section className="scan-last">
                    <div className="scan-last-head">
                      <span>✓ Ultimo prodotto riconosciuto</span>
                      <small>EAN {lastFound.code}</small>
                    </div>
                    <div className="scan-last-line">
                    <button type="button" className="scan-last-row" onClick={() => quickAdd(lastFound.food)}>
                      <span className="fc-name">
                        {lastFound.food.name}
                        {lastFound.food.brand && <span className="muted"> · {lastFound.food.brand}</span>}
                      </span>
                      <span className="fc-portion">
                        {usual(lastFound.food)} g · {entryFor(lastFound.food, usual(lastFound.food), '').kcal} kcal · P {fmtG(entryFor(lastFound.food, usual(lastFound.food), '').protein)}
                      </span>
                      <b className="scan-last-add">+ Aggiungi</b>
                    </button>
                    <button type="button" className={`fc-fav${isFav(lastFound.food.id) ? ' on' : ''}`} aria-label={isFav(lastFound.food.id) ? 'Preferiti: scegli i pasti' : 'Aggiungi ai preferiti'} aria-pressed={isFav(lastFound.food.id)} onClick={() => onHeart(lastFound.food)}>
                      <Icon d={ICON.heart} size={22} fill={isFav(lastFound.food.id)} />
                    </button>
                    </div>
                  </section>
                )}
                <p className="muted small scan-help">Codice rovinato o illeggibile? Scrivilo qui sopra. I dati dei prodotti confezionati vengono da Open Food Facts, database libero e collaborativo.</p>
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
          {picked && !shownInline && <Quantity food={picked} meal={meal} onMeal={setMeal} onBack={() => setPicked(null)} onAdd={add} fav={isFav(picked.id)} onFav={() => onHeart(picked)} />}
        </div>
        {added && (
          <div className="fs-added" role="status">
            ✓ {added} aggiunto a {MEALS.find((m) => m.id === meal)?.label}
          </div>
        )}
      </div>
      {favFor && (
        <div className="sheet-backdrop fav-pick-bg" onClick={() => setFavFor(null)}>
          <div className="sheet fav-pick" role="dialog" aria-label="Cartelle dei preferiti" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Nei preferiti di…</h2>
              <button type="button" className="icon-btn" aria-label="Chiudi" onClick={() => setFavFor(null)}>
                <Icon d="close" size={20} />
              </button>
            </div>
            <p className="muted small fav-pick-food">{favFor.name}{favFor.brand ? ` · ${favFor.brand}` : ''}</p>
            <div className="fav-pick-grid">
              {MEALS.map((m) => {
                const I = MEAL_ICON[m.id];
                const on = !!folders[m.id]?.includes(favFor.id);
                return (
                  <button key={m.id} type="button" role="checkbox" aria-checked={on} className={`fav-pick-item${on ? ' on' : ''}`} onClick={() => setInFolder(favFor.id, m.id, !on)}>
                    <I size={40} />
                    <span>{m.label}</span>
                    <span className="fp-check" aria-hidden="true">{on ? <Icon d="check" size={16} /> : null}</span>
                  </button>
                );
              })}
            </div>
            <div className="sheet-foot">
              {isFav(favFor.id) ? (
                <button type="button" className="btn-ghost small danger" onClick={() => { unfavourite(favFor.id); setFavFor(null); }}>
                  Togli dai preferiti
                </button>
              ) : <span />}
              <button type="button" className="btn" onClick={() => setFavFor(null)}>
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
