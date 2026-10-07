import { STUDY_AREAS, STUDY_TYPES, labelOf } from './vocab';
import type { DayEntry, ISODate, NoteFolder, Settings, StudyModule } from './types';

/**
 * Notes ("Appunti"): every study session of a day is also a note. Notes without a session (free
 * notes) and notes in the Cestino live in DayEntry.looseNotes of the day they were made on, so
 * the rest of the app (statistics, calendar, Google) never sees them.
 */

export const NOTE_TONES = ['lime', 'lav', 'sage', 'sky', 'terra', 'plum', 'sun', 'rose'] as const;
export const TRASH_DAYS = 30;

/** Every folder, including deleted ones (kept so their notes and subfolders go to the folder above, and "Annulla" works). */
export function allFoldersOf(s: Settings): NoteFolder[] {
  return s.noteFolders ?? STUDY_AREAS.map((a, i) => ({ id: `area:${a.id}`, name: a.label, tone: NOTE_TONES[i % NOTE_TONES.length] }));
}
export const foldersOf = (s: Settings) => allFoldersOf(s).filter((f) => !f.deleted);

/** The nearest folder still there going up from id (deleted folders are skipped). */
export function liveFolder(all: NoteFolder[], id: string | undefined): string | undefined {
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const f = all.find((x) => x.id === id);
    if (!f) return undefined;
    if (!f.deleted) return id;
    id = f.parentId;
  }
  return undefined;
}

const parentIdOf = (all: NoteFolder[], f: NoteFolder) => liveFolder(all, f.parentId);

/** The folder a note is in; without one the note sits at the archive root. */
export const folderOfNote = (all: NoteFolder[], m: StudyModule) => liveFolder(all, m.folderId ?? `area:${m.area}`);

/** Root → folder. */
export function folderPath(all: NoteFolder[], id: string | undefined): NoteFolder[] {
  const out: NoteFolder[] = [];
  const seen = new Set<string>();
  let cur = all.find((f) => f.id === liveFolder(all, id));
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    const up = parentIdOf(all, cur);
    cur = up ? all.find((f) => f.id === up) : undefined;
  }
  return out;
}

export const pathLabel = (all: NoteFolder[], id: string | undefined) =>
  folderPath(all, id)
    .map((f) => f.name)
    .join(' › ');

export const childrenOf = (all: NoteFolder[], parentId?: string) => all.filter((f) => !f.deleted && parentIdOf(all, f) === parentId);

/** The folder and every folder inside it. */
export function subtree(all: NoteFolder[], id: string): Set<string> {
  return new Set(all.filter((f) => !f.deleted && folderPath(all, f.id).some((p) => p.id === id)).map((f) => f.id));
}

/** Study area kept on the session for the statistics: the area folder the note sits under. */
export function areaFor(all: NoteFolder[], folderId: string | undefined): string {
  const root = folderPath(all, folderId)[0];
  const area = root?.id.startsWith('area:') ? root.id.slice(5) : undefined;
  return area && STUDY_AREAS.some((a) => a.id === area) ? area : 'other';
}

// ---- Where notes are ----

export interface NoteRow {
  date: ISODate;
  m: StudyModule;
  /** In looseNotes (free note or in the Cestino) rather than a session of the day. */
  loose: boolean;
}

export function notesOf(days: DayEntry[]): NoteRow[] {
  const out: NoteRow[] = [];
  for (const d of days) {
    for (const m of d.modules) if (m.kind === 'study') out.push({ date: d.date, m, loose: false });
    for (const m of d.looseNotes ?? []) out.push({ date: d.date, m, loose: true });
  }
  return out;
}

export function findNote(d: DayEntry, id: string): NoteRow | null {
  const m = d.modules.find((x) => x.id === id);
  if (m?.kind === 'study') return { date: d.date, m, loose: false };
  const l = d.looseNotes?.find((x) => x.id === id);
  return l ? { date: d.date, m: l, loose: true } : null;
}

/** Applies fn to the note wherever it is in the day. */
export function mapNote(d: DayEntry, id: string, fn: (m: StudyModule) => StudyModule): DayEntry {
  return {
    ...d,
    modules: d.modules.map((x) => (x.id === id && x.kind === 'study' ? fn(x) : x)),
    looseNotes: d.looseNotes?.map((x) => (x.id === id ? fn(x) : x)),
  };
}

export const editedOf = (r: NoteRow) => r.m.editedAt ?? r.m.createdAt ?? new Date(`${r.date}T12:00:00`).getTime();
export const createdOf = (r: NoteRow) => r.m.createdAt ?? new Date(`${r.date}T12:00:00`).getTime();

export function noteTitle(r: NoteRow): string {
  if (r.m.title.trim()) return r.m.title.trim();
  if (r.m.free) return 'Nota senza titolo';
  return `${labelOf(STUDY_TYPES, r.m.type)} del ${new Date(`${r.date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
}

// ---- Text ----

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function textToHtml(t: string): string {
  return t
    .split(/\r?\n/)
    .map((l) => `<p>${l ? esc(l) : '<br>'}</p>`)
    .join('');
}

/** The note as HTML: the formatted text, or the plain notes written before notes existed. */
export const bodyOf = (m: StudyModule) => m.body ?? (m.notes ? textToHtml(m.notes) : '');

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function plainOf(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|\/blockquote|\/figure)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|[a-z]+);/gi, (all, e: string) => (e[0] === '#' ? String.fromCharCode(Number(e.slice(1))) : ENT[e.toLowerCase()] ?? all))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const hasContent = (m: StudyModule) => !!(plainOf(bodyOf(m)) || m.attachments?.length);

// ---- Cleaning HTML (pasted text, imported copies, what the editor produces) ----

const KEEP = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'FIGURE', 'IMG', 'DIV', 'AUDIO', 'SUB', 'SUP', 'HR']);
const RENAME: Record<string, string> = { H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3', THEAD: 'TBODY', MARK: 'SPAN', FONT: 'SPAN' };
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'svg', 'SVG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NOSCRIPT', 'TEMPLATE', 'VIDEO', 'CANVAS', 'HEAD']);
const STYLE_OK = /^(color|background-color|font-weight|font-style|text-decoration|text-decoration-line)$/;

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = document.createElement('div');
  const walk = (from: Node, to: Node) => {
    for (const n of [...from.childNodes]) {
      if (n.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(n.textContent ?? ''));
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const el = n as HTMLElement;
      const tag = RENAME[el.tagName] ?? el.tagName;
      if (DROP.has(tag)) continue;
      if (!KEEP.has(tag)) {
        walk(el, to); // unknown wrapper: keep what it says
        continue;
      }
      if ((tag === 'IMG' || tag === 'AUDIO') && !el.closest('[data-att]')) continue;
      const c = document.createElement(tag);
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter((x) => /^n-[a-z-]+$/.test(x));
      if (cls.length) c.setAttribute('class', cls.join(' '));
      for (const a of ['data-att', 'data-kind', 'data-done', 'data-name', 'data-sec']) {
        const v = el.getAttribute(a);
        if (v != null) c.setAttribute(a, v.slice(0, 200));
      }
      if (el.getAttribute('color')) c.style.color = el.getAttribute('color')!;
      const style = el.getAttribute('style');
      if (style) {
        for (const decl of style.split(';')) {
          const [k, ...v] = decl.split(':');
          const key = k?.trim().toLowerCase();
          const val = v.join(':').trim();
          if (key && STYLE_OK.test(key) && val && !/url\(|expression|transparent/i.test(val)) c.style.setProperty(key, val);
        }
      }
      if (tag === 'AUDIO') c.setAttribute('controls', '');
      if (el.getAttribute('data-att') && tag !== 'IMG' && tag !== 'AUDIO') c.setAttribute('contenteditable', 'false');
      to.appendChild(c);
      if (tag !== 'IMG' && tag !== 'AUDIO') walk(el, c);
    }
  };
  walk(doc.body, out);
  return out.innerHTML;
}

// ---- Tags ----

const TOPICS: [string, RegExp][] = [
  ['CTG', /\bctg\b|cardiotocogra/i],
  ['Linee guida', /linee? guida|guideline|raccomandazion|consensus|\b(sigo|aogoi|acog|rcog|esgo|esge|eshre|isuog|nice|figo|smfm|ogi)\b/i],
  ['Review', /\breview\b|revisione (sistematica|della letteratura)|meta-?anal|systematic/i],
  ['Endometriosi', /endometrio(si|ma)|endometriosis|\bdie\b/i],
  ['Adenomiosi', /adenomio/i],
  ['Oncologia pelvica', /oncolog|carcinom|cancro|cancer|tumor[ei]|neoplas|sarcom|linfoaden|stadiazion|malignan/i],
  ['Ecografia', /ecogra|ultraso?u?nd|sonogra|doppler|transvaginal|\b(iota|ieta|musa|tvs)\b/i],
  ['Statica pelvica', /prolass|pessar|\bpop\b|incontinen|pavimento pelvico|sacrocolpo|colposospens|cistocele|rettocele/i],
  ['Ostetricia', /gravidanz|ostetric|pregnan|travaglio|gestazion|\bparto\b/i],
  ['Parto operativo', /ventosa|forcipe|\bvem\b|parto (vaginale )?operativo/i],
  ['Taglio cesareo', /cesare[oi]|ca?esarean/i],
  ['Emorragia post partum', /emorragia post.?partum|\bepp\b|\bpph\b|postpartum ha?emorrhage/i],
  ['Preeclampsia', /pre-?eclamp|ipertensione gestazional|\bhellp\b/i],
  ['Diabete gestazionale', /diabete gestazional|\bgdm\b|\bogtt\b/i],
  ['Medicina fetale', /\bfeto\b|fetal[ei]?\b|restrizione di crescita|\bfgr\b|\biugr\b|amniocent|villocent|\bnipt\b/i],
  ['Sanguinamento uterino anomalo', /sanguinamento uterino|\baub\b|abnormal uterine bleeding|palm-?coein|menorragi/i],
  ['Fibromi', /fibrom|\bmiom|leiomiom|fibroid/i],
  ['Isteroscopia', /isteroscop|hysteroscop/i],
  ['Laparoscopia', /laparoscop|robotic/i],
  ['Colposcopia e HPV', /colposcop|\bhpv\b|\bcin ?[123]\b|pap.?test|\b[hl]sil\b/i],
  ['Mammella', /mammell|breast|mammogra/i],
  ['Infertilità e PMA', /infertilit|sterilit|\bpma\b|\bivf\b|\bfivet\b|\bicsi\b|riserva ovarica|\bamh\b/i],
  ['Contraccezione', /contracce|\biud\b|spirale|contraceptiv/i],
  ['Menopausa', /menopaus|climater|\bhrt\b/i],
  ['Endocrinologia', /\bpcos\b|policistic|amenorre|prolattin|iperandrog/i],
  ['Infezioni', /infezion|sepsi|vaginos|candid|chlamydia|clamidia|gonorr|\bgbs\b|streptococc|\bpid\b/i],
  ['Studio clinico', /\brct\b|randomi[sz]|\btrial\b|coorte|cohort|prospettic|retrospettiv/i],
  ['Farmaci', /posologia|dienogest|danazol|progestinic|\bgnrh|tocolis|ossitocin|misoprost|solfato di magnesio/i],
  ['Chirurgia', /chirurg|isterectomi|annessiectomi|miomectomi|surgery|surgical/i],
  ['Urgenze', /urgenz|emergenz|ectopic|torsione/i],
];

const BY_TYPE: Record<string, string> = { guideline: 'Linee guida', lesson: 'Lezione', video: 'Video chirurgico', book: 'Manuale', simulation: 'Simulazione', writing: 'Scrittura scientifica' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Topic tags that fit what the note says, best first, leaving out those it has already. */
export function suggestTags(m: StudyModule, known: string[], folderName = ''): string[] {
  const text = `${m.title}\n${folderName}\n${plainOf(bodyOf(m))}\n${(m.attachments ?? []).map((a) => a.name).join(' ')}`;
  const have = new Set((m.tags ?? []).map(norm));
  const score = new Map<string, number>();
  const add = (t: string, n: number) => !have.has(norm(t)) && score.set(t, (score.get(t) ?? 0) + n);
  for (const [tag, re] of TOPICS) {
    const n = text.match(new RegExp(re.source, 'gi'))?.length ?? 0;
    if (n) add(tag, n + (re.test(m.title) ? 3 : 0));
  }
  if (!m.free && BY_TYPE[m.type]) add(BY_TYPE[m.type], 1);
  // The folder already says it: no tag with the same name.
  for (const f of folderName.split(/\s*\n\s*/)) if (f) score.delete([...score.keys()].find((k) => norm(k) === norm(f)) ?? '');
  const nt = norm(text);
  for (const t of known) if (t.length > 2 && nt.includes(norm(t))) add(t, 2);
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
}

export function allTags(rows: NoteRow[], s: Settings): { tag: string; n: number }[] {
  const count = new Map<string, number>();
  for (const t of s.noteTags ?? []) count.set(t, 0);
  for (const r of rows) if (!r.m.trashedAt) for (const t of r.m.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

// ---- Dates in the archive ----

export function periodOf(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return 'Oggi';
  if (diff === 1) return 'Ieri';
  if (diff < 7) return 'Questa settimana';
  const m = d.toLocaleDateString('it-IT', { month: 'long' });
  const label = m[0].toUpperCase() + m.slice(1);
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

export function shortDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

// ---- Back button: where a note and a folder go back to ----

let noteBack: string | null = null;
export const setNoteReturn = (path: string) => {
  noteBack = path;
};
export const noteReturn = () => noteBack;

let folderParents: Record<string, string | undefined> = {};
export const rememberFolders = (all: NoteFolder[]) => {
  folderParents = Object.fromEntries(all.map((f) => [f.id, parentIdOf(all, f)]));
};
export const folderParentOf = (id: string) => folderParents[id];
