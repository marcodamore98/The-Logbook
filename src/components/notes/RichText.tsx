import { confirmDelete } from '../Confirm';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { compress } from '../../lib/image';
import { sanitizeHtml } from '../../lib/notes';
import { useStore } from '../../lib/store/StoreContext';
import type { NoteFile } from '../../lib/types';
import { openFile } from '../files/FileSlot';
import { attachPlayer, stripPlayers, toWave } from './audioPlayer';
import './fonts.css';
import { createPortal } from 'react-dom';
import { Sym } from '../icons';
import type { SymName } from '../ms';
import { uid } from '../ui';

export type InsertKind = 'image' | 'camera' | 'scan' | 'pdf' | 'audio';

export interface RichHandle {
  insert(kind: InsertKind): void;
  record(): void;
  table(): void;
  /** Current HTML (also sent to onChange). */
  flush(): void;
  focus(): void;
}

const MAX_PDF = 8 * 1024 * 1024;
const MAX_AUDIO = 25 * 1024 * 1024;

const TEXT_COLORS: [string, string | null][] = [
  ['Automatico', null],
  ['Rosso', '#e5484d'],
  ['Arancione', '#e8862a'],
  ['Verde', '#2f9e62'],
  ['Blu', '#3e7bfa'],
  ['Viola', '#8b6cf0'],
];
const MARKERS: [string, string | null][] = [
  ['Nessuno', null],
  ['Lime', 'rgba(214, 242, 95, 0.6)'],
  ['Lavanda', 'rgba(185, 176, 245, 0.6)'],
  ['Giallo', 'rgba(255, 214, 10, 0.5)'],
  ['Rosa', 'rgba(255, 128, 170, 0.45)'],
  ['Azzurro', 'rgba(110, 190, 255, 0.45)'],
];
const BLOCKS: [string, string][] = [
  ['h2', 'Titolo'],
  ['h3', 'Sottotitolo'],
  ['p', 'Testo'],
  ['blockquote', 'Citazione'],
];
/** Classic fonts, as in Word: the real one when the device has it, else its open look-alike bundled with the app. */
export const FONTS: [string, string | null][] = [
  ['Predefinito', null],
  ['Arial', 'Arial, Arimo, Helvetica, sans-serif'],
  ['Calibri', 'Calibri, Carlito, sans-serif'],
  ['Times New Roman', '"Times New Roman", Tinos, Times, serif'],
  ['Georgia', 'Georgia, Gelasio, serif'],
  ['Garamond', 'Garamond, "EB Garamond", serif'],
  ['Courier New', '"Courier New", Cousine, Courier, monospace'],
];
/** Text sizes in points, as in Word (12 pt is the normal text). */
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const ptOf = (el: Element | null) => (el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75 * 2) / 2 : 12);
// Marker colour that means "no colour": spans carrying it lose the property right after.
const UNSET = 'rgb(1, 2, 3)';

interface Active {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  ul?: boolean;
  ol?: boolean;
  check?: boolean;
  block?: string;
  table?: boolean;
  /** Size of the text at the caret, in points. */
  pt?: number;
  font?: string;
  en?: boolean;
}

/** How one level of a list is marked: bullets (• ◦ ▪ –) or numbers (1 2 3, 1.1 1.2, a b c, I II III). */
type ListStyle = 'disc' | 'circle' | 'square' | 'dash' | 'num' | 'multi' | 'alpha' | 'roman';
const BULLET_STYLES: [ListStyle, string, string][] = [
  ['disc', '•', 'Pallino'],
  ['circle', '◦', 'Cerchio'],
  ['square', '▪', 'Quadratino'],
  ['dash', '–', 'Trattino'],
];
const NUMBER_STYLES: [ListStyle, string, string][] = [
  ['num', '1. 2. 3.', 'Numeri'],
  ['multi', '1.1 1.2', 'Numeri a più livelli'],
  ['alpha', 'a. b. c.', 'Lettere'],
  ['roman', 'I. II. III.', 'Numeri romani'],
];
const STYLE_CLASSES = ['n-b-disc', 'n-b-circle', 'n-b-square', 'n-b-dash', 'n-alpha', 'n-roman'];

/** Tab outside a list: a gap like Word's tab stop (two em spaces, so it survives saving and export). */
const TAB = '\u2003\u2003';
const MULTI_KEY = 'logbook.notes.multiNumbers';
const prefersMulti = () => {
  try {
    return localStorage.getItem(MULTI_KEY) === '1';
  } catch {
    return false;
  }
};
/** The outermost numbered list around a node: the one that carries the numbering style for all its levels. */
const outerOl = (n: Element | null | undefined, root: HTMLElement): HTMLOListElement | null => {
  let found: HTMLOListElement | null = null;
  for (let e = n; e && e !== root; e = e.parentElement) if (e.tagName === 'OL') found = e as HTMLOListElement;
  return found;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sizeLabel = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A photo of a page turned into a clean, high-contrast "scanned" image. */
async function scanLook(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.45) brightness(1.08)';
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Scansione non riuscita'))), 'image/jpeg', 0.92));
  return new File([blob], 'scansione.jpg', { type: 'image/jpeg' });
}

export function mediaHtml(f: NoteFile): string {
  const base = `data-att="${esc(f.id)}" data-kind="${f.kind}" data-name="${esc(f.name)}" contenteditable="false"`;
  if (f.kind === 'image') return `<figure class="n-img n-media" ${base}><img alt=""></figure><p><br></p>`;
  if (f.kind === 'pdf') return `<div class="n-file n-media" ${base}><span class="n-badge">PDF</span><span class="n-name">${esc(f.name)}</span></div><p><br></p>`;
  return `<div class="n-audio n-media" ${base}${f.sec ? ` data-sec="${f.sec}"` : ''}><span class="n-name">${esc(f.name)}${f.sec ? ` · ${mmss(f.sec)}` : ''}</span><audio controls preload="metadata"></audio></div><p><br></p>`;
}

/**
 * The page of a note, like Samsung Notes: formatted text, lists and checklists, tables, photos,
 * scanned pages, PDFs and voice recordings in the flow of the text, with a formatting bar.
 */
export function RichText({
  initial,
  files,
  readOnly,
  onChange,
  onFiles,
  onViewImage,
  ref,
}: {
  initial: string;
  files: NoteFile[];
  readOnly?: boolean;
  onChange: (html: string) => void;
  /** New attachments; `append` when the note is no longer open and they go at its end. */
  onFiles: (added: NoteFile[], append?: boolean) => void;
  onViewImage: (url: string, remove: () => void) => void;
  ref?: Ref<RichHandle>;
}) {
  const { repo } = useStore();
  const ed = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const urls = useRef(new Map<string, string>());
  const filesRef = useRef(files);
  filesRef.current = files;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timer = useRef(0);
  const dirty = useRef(false);
  const [active, setActive] = useState<Active>({});
  const [pop, setPop] = useState<'block' | 'color' | 'marker' | 'font' | 'size' | null>(null);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState<{ el: HTMLElement; text: string } | null>(null);
  /** Writes (or takes away) the caption under a photo. */
  const saveCaption = (el: HTMLElement, text: string) => {
    let cap = el.querySelector('figcaption');
    if (!text.trim()) cap?.remove();
    else {
      if (!cap) {
        cap = document.createElement('figcaption');
        el.appendChild(cap);
      }
      cap.textContent = text.trim();
    }
    changed();
    setCaption(null);
  };
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [rec, setRec] = useState<{ sec: number; paused: boolean } | null>(null);
  const recorder = useRef<{ mr: MediaRecorder; chunks: Blob[]; started: number; acc: number; lock?: WakeLockSentinel; cancel?: boolean } | null>(null);

  const serialize = () => {
    const node = ed.current;
    if (!node) return '';
    const c = node.cloneNode(true) as HTMLElement;
    c.querySelectorAll('img, audio').forEach((m) => m.removeAttribute('src'));
    stripPlayers(c);
    return c.innerHTML;
  };
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    onChangeRef.current(serialize());
  }, []);
  const changed = () => {
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 600);
  };

  /** Shows the stored image or recording behind each placeholder. */
  const hydrate = useCallback(() => {
    const node = ed.current;
    if (!node) return;
    node.querySelectorAll<HTMLElement>('[data-att]').forEach((el) => {
      const id = el.dataset.att!;
      const f = filesRef.current.find((x) => x.id === id);
      const media = el.querySelector<HTMLImageElement | HTMLAudioElement>('img, audio');
      // PDF: its weight next to the name; recording: the app's own player.
      if (el.classList.contains('n-file') && f?.size && !el.querySelector('.n-size')) {
        const sz = document.createElement('span');
        sz.className = 'n-size';
        sz.textContent = sizeLabel(f.size);
        el.querySelector('.n-name')?.after(sz);
      }
      if (media instanceof HTMLAudioElement) attachPlayer(el, media, { id, sec: f?.sec ?? (Number(el.dataset.sec) || undefined), wave: f?.wave });
      if (!media || media.getAttribute('src')) return;
      const set = (u: string) => u && media.setAttribute('src', u);
      const known = urls.current.get(id);
      if (known) return set(known);
      if (!f) return;
      repo
        .resolveFile(f.src)
        .then((u) => {
          urls.current.set(id, u);
          set(u);
        })
        .catch(() => undefined);
    });
  }, [repo]);

  useEffect(() => {
    const node = ed.current!;
    node.innerHTML = sanitizeHtml(initial) || '<p><br></p>';
    document.execCommand('defaultParagraphSeparator', false, 'p');
    hydrate();
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      // The note is left: save what was typed in the last moments.
      window.clearTimeout(timer.current);
      if (dirty.current) {
        dirty.current = false;
        const c = node.cloneNode(true) as HTMLElement;
        c.querySelectorAll('img, audio').forEach((m) => m.removeAttribute('src'));
        stripPlayers(c);
        onChangeRef.current(c.innerHTML);
      }
    };
    // Only when the note opens: afterwards the page belongs to the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      const node = ed.current;
      if (!sel?.rangeCount || !node || !node.contains(sel.anchorNode)) return;
      range.current = sel.getRangeAt(0).cloneRange();
      const at = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode?.parentElement;
      const ul = at?.closest('ul, ol');
      const block = at?.closest('h2, h3, blockquote')?.tagName.toLowerCase() ?? 'p';
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        ul: ul?.tagName === 'UL' && !ul.classList.contains('n-check'),
        ol: ul?.tagName === 'OL',
        check: !!ul?.classList.contains('n-check'),
        block,
        table: !!at?.closest('td, th'),
        pt: at ? ptOf(at) : undefined,
        font: FONTS.find(([, f]) => f && at?.closest<HTMLElement>('[style*="font-family"]')?.style.fontFamily.replace(/['"]/g, '') === f.replace(/['"]/g, ''))?.[0],
        en: !!at?.closest('[lang="en"]'),
      });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const restore = () => {
    const node = ed.current!;
    const sel = document.getSelection()!;
    // Still writing here: the live caret is newer than the one remembered at the last selectionchange.
    if (document.activeElement === node && sel.rangeCount && node.contains(sel.anchorNode)) return;
    node.focus({ preventScroll: true });
    if (range.current && node.contains(range.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    } else {
      const r = document.createRange();
      r.selectNodeContents(node);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };
  const at = (): HTMLElement | null => {
    const n = document.getSelection()?.anchorNode;
    return n instanceof HTMLElement ? n : n?.parentElement ?? null;
  };
  const exec = (cmd: string, value?: string) => {
    restore();
    document.execCommand(cmd, false, value);
    if (/List|indent|outdent|formatBlock/.test(cmd)) {
      fixNesting();
      fixLists();
    }
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };
  const paint = (cmd: 'foreColor' | 'hiliteColor', color: string | null) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, color ?? UNSET);
    document.execCommand('styleWithCSS', false, 'false');
    if (!color) {
      const prop = cmd === 'foreColor' ? 'color' : 'background-color';
      ed.current!.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
        if (el.style.getPropertyValue(prop).replace(/\s/g, '') === UNSET.replace(/\s/g, '')) el.style.removeProperty(prop);
        if (!el.getAttribute('style')) el.removeAttribute('style');
      });
    }
    setPop(null);
    changed();
  };
  /** Font of the chosen text (or of what is typed next). */
  const setFont = (family: string | null) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontName', false, family ?? UNSET);
    document.execCommand('styleWithCSS', false, 'false');
    if (!family)
      ed.current!.querySelectorAll<HTMLElement>('[style*="font-family"]').forEach((el) => {
        if (el.style.fontFamily.includes('rgb')) el.style.removeProperty('font-family');
        if (!el.getAttribute('style')) el.removeAttribute('style');
      });
    setPop(null);
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };
  /** Size of the chosen text in points: the browser marks it "xxx-large", then the mark becomes the real size. */
  const setSize = (pt: number) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, '7');
    document.execCommand('styleWithCSS', false, 'false');
    ed.current!.querySelectorAll<HTMLElement>('[style*="xxx-large"], font[size="7"]').forEach((el) => {
      if (el.tagName === 'FONT') {
        const span = document.createElement('span');
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
        el = span;
      }
      el.style.fontSize = pt === 12 ? '' : `${pt}pt`;
      if (!el.getAttribute('style')) el.removeAttribute('style');
    });
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };
  const stepSize = (dir: 1 | -1) => {
    const now = active.pt ?? 12;
    const next = dir > 0 ? SIZES.find((x) => x > now + 0.1) : [...SIZES].reverse().find((x) => x < now - 0.1);
    if (next) setSize(next);
  };
  /** "EN": the chosen text is English (checked as English); on a caret inside English text, it goes back to Italian. */
  const toggleEnglish = () => {
    restore();
    const sel = document.getSelection();
    if (!sel?.rangeCount) return;
    const inside = at()?.closest<HTMLElement>('[lang="en"]');
    if (inside && ed.current!.contains(inside)) {
      inside.replaceWith(...inside.childNodes);
    } else {
      const r = sel.getRangeAt(0);
      if (r.collapsed) {
        // Nothing chosen: the whole paragraph.
        const blk = at()?.closest('p, li, h2, h3, blockquote, td');
        if (!blk || !ed.current!.contains(blk)) return;
        r.selectNodeContents(blk);
      }
      const span = document.createElement('span');
      span.setAttribute('lang', 'en');
      span.appendChild(r.extractContents());
      r.insertNode(span);
      sel.removeAllRanges();
      const after = document.createRange();
      after.selectNodeContents(span);
      sel.addRange(after);
    }
    ed.current!.normalize();
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };
  const block = (tag: string) => {
    exec('formatBlock', tag);
    setPop(null);
  };
  const bullets = () => {
    restore();
    const list = at()?.closest('ul');
    if (list?.classList.contains('n-check')) {
      list.classList.remove('n-check');
      list.querySelectorAll('li[data-done]').forEach((li) => li.removeAttribute('data-done'));
      changed();
    } else if (!retype('UL')) exec('insertUnorderedList');
    document.dispatchEvent(new Event('selectionchange'));
  };
  const checklist = () => {
    restore();
    const list = at()?.closest('ul, ol');
    if (list?.classList.contains('n-check')) return exec('insertUnorderedList');
    if (list?.tagName === 'UL') list.classList.add('n-check');
    else {
      document.execCommand('insertUnorderedList');
      fixNesting();
      at()?.closest('ul')?.classList.add('n-check');
    }
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };

  /**
   * Structural list changes (Tab, Shift+Tab, type of a level) are made by hand, so the sub-lists
   * always sit inside their item. The browser's undo does not know them: they keep their own,
   * the list as it was before, and "Annulla" (or Ctrl+Z) puts it back while nothing else changed.
   */
  const own = useRef<{ before: string; nodes: Node[]; after: string }[]>([]);
  const outer = (n: Node) => (n instanceof Element ? n.outerHTML : n.textContent ?? '');
  const structural = (work: () => boolean) => {
    const node = ed.current!;
    let top: Node | null = at();
    while (top && top.parentNode !== node) top = top.parentNode;
    if (!top) return false;
    const before = outer(top);
    const prev = top.previousSibling;
    const next = top.nextSibling;
    const sel = document.getSelection()!;
    const a = sel.anchorNode;
    const o = sel.anchorOffset;
    const fo = sel.focusNode;
    const fOff = sel.focusOffset;
    if (!work()) return false;
    const nodes: Node[] = [];
    for (let n = prev ? prev.nextSibling : node.firstChild; n && n !== next; n = n.nextSibling) nodes.push(n);
    own.current.push({ before, nodes, after: nodes.map(outer).join('') });
    if (own.current.length > 50) own.current.shift();
    // Same text nodes, only moved: the caret (or the chosen text) stays where it was.
    const r = document.createRange();
    const put = (n: Node | null, off: number, f: (n: Node, o: number) => void) => n && node.contains(n) && f(n, Math.min(off, n.nodeType === Node.TEXT_NODE ? (n.textContent ?? '').length : n.childNodes.length));
    put(a, o, (n, x) => r.setStart(n, x));
    if (fo && fo !== a) put(fo, fOff, (n, x) => r.setEnd(n, x));
    else r.collapse(true);
    if (r.startContainer && node.contains(r.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(r);
      range.current = r.cloneRange();
    }
    changed();
    document.dispatchEvent(new Event('selectionchange'));
    return true;
  };
  const undo = () => {
    const last = own.current.at(-1);
    const node = ed.current!;
    if (last && last.nodes.length && last.nodes.every((n) => n.parentNode === node) && last.nodes.map(outer).join('') === last.after) {
      own.current.pop();
      const tpl = document.createElement('template');
      tpl.innerHTML = last.before;
      const fresh = [...tpl.content.childNodes];
      last.nodes[0].parentNode!.insertBefore(tpl.content, last.nodes[0]);
      last.nodes.forEach((n) => n.parentNode?.removeChild(n));
      node.focus({ preventScroll: true });
      const r = document.createRange();
      r.selectNodeContents(fresh.at(-1)!);
      r.collapse(false);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      range.current = r.cloneRange();
      changed();
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    exec('undo');
  };

  /** The list items the caret or the chosen text is on (only the outermost ones, in order). */
  const chosenItems = (): HTMLLIElement[] => {
    const node = ed.current!;
    const sel = document.getSelection();
    const li = at()?.closest('li');
    if (!sel?.rangeCount || sel.isCollapsed) return li && node.contains(li) ? [li as HTMLLIElement] : [];
    const r = sel.getRangeAt(0);
    const all = [...node.querySelectorAll('li')].filter((x) => r.intersectsNode(x));
    return all.filter((x) => !all.some((y) => y !== x && y.contains(x)));
  };
  const sameList = (like: Element) => {
    const l = document.createElement(like.tagName);
    if (like.classList.contains('n-check')) l.className = 'n-check';
    return l;
  };
  /** Tab on an item: it becomes the last sub-item of the item above (Word's "increase list level"). */
  const sink = (li: HTMLLIElement) => {
    const prev = li.previousElementSibling;
    if (prev?.tagName !== 'LI') return false;
    let sub = prev.lastElementChild;
    if (!sub || !/^(UL|OL)$/.test(sub.tagName)) {
      sub = sameList(li.parentElement!);
      prev.append(sub);
    }
    sub.append(li);
    return true;
  };
  /** Shift+Tab on an item: back up one level (the items after it become its sub-items); from the main list, plain text. */
  const lift = (li: HTMLLIElement) => {
    const list = li.parentElement!;
    const after: Element[] = [];
    for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
    if (list.parentElement?.tagName === 'LI') {
      if (after.length) {
        let sub = li.lastElementChild;
        if (!sub || !/^(UL|OL)$/.test(sub.tagName)) {
          sub = sameList(list);
          li.append(sub);
        }
        sub.append(...after);
      }
      list.parentElement.after(li);
      if (!list.children.length) list.remove();
      return true;
    }
    // Main list → a paragraph between the two halves of the list.
    const p = document.createElement('p');
    const rest = sameList(list);
    if (list.classList.contains('n-multi')) rest.classList.add('n-multi');
    for (const c of [...li.childNodes]) {
      if (c instanceof Element && /^(UL|OL)$/.test(c.tagName)) rest.append(...c.children);
      else p.append(c);
    }
    if (!p.childNodes.length) p.append(document.createElement('br'));
    rest.append(...after);
    list.after(p);
    if (rest.children.length) p.after(rest);
    li.remove();
    if (!list.children.length) list.remove();
    const sel = document.getSelection()!;
    if (!sel.anchorNode || !ed.current!.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.setStart(p, 0);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    return true;
  };
  /** This level of the list becomes bullets or numbers (the levels above and below stay as they are). */
  const retype = (tag: 'UL' | 'OL'): boolean => {
    const list = at()?.closest('li')?.parentElement;
    if (!list || !ed.current!.contains(list) || list.tagName === tag) return false;
    return structural(() => {
      const l = document.createElement(tag);
      l.append(...list.childNodes);
      list.replaceWith(l);
      return true;
    });
  };
  /** Numbered list from the toolbar; on a level of bullets it turns that level into numbers. */
  const numbers = () => {
    restore();
    const list = at()?.closest('li')?.parentElement;
    if (list && list.tagName !== 'OL' && retype('OL')) return;
    const wasList = !!list;
    exec('insertOrderedList');
    // The preferred numbering (1.1, 1.2) goes only on a new list, never on one already there.
    const top = outerOl(at(), ed.current!);
    if (top && !wasList && prefersMulti()) {
      top.classList.add('n-multi');
      changed();
      document.dispatchEvent(new Event('selectionchange'));
    }
  };
  /** How a level is marked now: its own choice, or the default for its depth (• ◦ ▪, 1 2 3 / 1.1). */
  const styleOf = (list: Element): ListStyle => {
    for (const [st] of [...BULLET_STYLES, ...NUMBER_STYLES]) if (list.classList.contains(st === 'alpha' || st === 'roman' ? `n-${st}` : `n-b-${st}`)) return st;
    if (list.tagName === 'OL') return outerOl(list, ed.current!)?.classList.contains('n-multi') ? 'multi' : 'num';
    let depth = 0;
    for (let e = list.parentElement; e && e !== ed.current; e = e.parentElement) if (/^(UL|OL)$/.test(e.tagName)) depth++;
    return (['disc', 'circle', 'square'] as const)[depth % 3];
  };
  /** Tapping a bullet or number: the chosen look for that level of the list. */
  const setListStyle = (li: HTMLLIElement, st: ListStyle) => {
    const node = ed.current!;
    node.focus({ preventScroll: true });
    const r = document.createRange();
    r.setStart(li, 0);
    r.collapse(true);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    const bullet = BULLET_STYLES.some(([x]) => x === st);
    if (st === 'num' || st === 'multi') {
      try {
        localStorage.setItem(MULTI_KEY, st === 'multi' ? '1' : '0');
      } catch {
        /* private mode */
      }
    }
    structural(() => {
      let list = li.parentElement!;
      const tag = bullet ? 'UL' : 'OL';
      if (list.tagName !== tag) {
        const l = document.createElement(tag);
        l.className = list.className;
        l.append(...list.childNodes);
        list.replaceWith(l);
        list = l;
      }
      list.classList.remove(...STYLE_CLASSES, 'n-multi');
      if (bullet) list.classList.add(`n-b-${st}`);
      else if (st === 'alpha' || st === 'roman') list.classList.add(`n-${st}`);
      else {
        const top = outerOl(list, node)!;
        top.classList.toggle('n-multi', st === 'multi');
        if (st === 'num') top.querySelectorAll('ol.n-multi').forEach((o) => o.classList.remove('n-multi'));
        if (!top.classList.length) top.removeAttribute('class');
      }
      if (!list.classList.length) list.removeAttribute('class');
      return true;
    });
  };
  const [listMenu, setListMenu] = useState<{ li: HTMLLIElement; top: number; left: number } | null>(null);
  /** The list item whose bullet or number is under the finger (not checklists: their box ticks). */
  const markerAt = (t: HTMLElement, x: number, y: number): HTMLLIElement | null => {
    const node = ed.current!;
    const near = (li: Element) => {
      const r = li.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(li).lineHeight) || 24;
      return x < r.left + 4 && x > r.left - 48 && y >= r.top - 4 && y <= r.top + line + 4;
    };
    let cand: Element | null = null;
    if (/^(UL|OL)$/.test(t.tagName)) cand = [...t.children].find((c) => c.tagName === 'LI' && near(c)) ?? null;
    else {
      const li = t.closest('li');
      if (li && near(li)) cand = li;
    }
    if (!cand || !node.contains(cand) || cand.parentElement?.classList.contains('n-check')) return null;
    return cand as HTMLLIElement;
  };

  /**
   * Tab / Shift+Tab, as in Word: in a list the item becomes a sub-item (or goes back up a level);
   * in a table it moves to the next (previous) cell; in the text it leaves a gap (or removes it).
   */
  const tab = (back: boolean) => {
    restore();
    const node = ed.current!;
    const items = chosenItems();
    if (items.length) {
      structural(() => {
        let done = false;
        for (const li of items) done = (back ? lift(li) : sink(li)) || done;
        return done;
      });
      return;
    }
    const here = at();
    const sel = document.getSelection()!;
    const cell = here?.closest('td, th');
    if (cell && node.contains(cell)) {
      const cells = [...cell.closest('table')!.querySelectorAll('td, th')];
      const next = cells[cells.indexOf(cell) + (back ? -1 : 1)];
      if (next) {
        const r = document.createRange();
        r.selectNodeContents(next);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
        range.current = r.cloneRange();
      }
      return;
    }
    if (!back) document.execCommand('insertText', false, TAB);
    else if (sel.rangeCount) {
      // Removes the gap just before the caret, or else the one at the start of the line.
      const r = sel.getRangeAt(0);
      let t: Node | null = r.startContainer;
      let end = r.startOffset;
      let m = t.nodeType === Node.TEXT_NODE ? (t.textContent ?? '').slice(0, end).match(/ {1,2}$/) : null;
      if (!m) {
        const blk = here?.closest('p, h2, h3, blockquote, div');
        const first = blk && node.contains(blk) ? document.createTreeWalker(blk, NodeFilter.SHOW_TEXT).nextNode() : null;
        m = first ? (first.textContent ?? '').match(/^ {1,2}/) : null;
        t = first;
        end = m ? m[0].length : 0;
      }
      if (!m || !t) return;
      const del = document.createRange();
      del.setStart(t, end - m[0].length);
      del.setEnd(t, end);
      sel.removeAllRanges();
      sel.addRange(del);
      document.execCommand('delete');
    }
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };

  const insertHtml = (html: string) => {
    restore();
    document.execCommand('insertHTML', false, html);
    const sel = document.getSelection()!;
    if (sel.rangeCount) range.current = sel.getRangeAt(0).cloneRange();
    hydrate();
    changed();
  };

  /** Photos, files, recordings and tables go between paragraphs (never inside a list, a heading or a table). */
  const insertBlocks = (html: string) => {
    restore();
    const node = ed.current!;
    let top: HTMLElement | null = at();
    while (top && top !== node && top.parentElement !== node) top = top.parentElement;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const added = [...tpl.content.childNodes];
    if (!top || top === node) node.append(...added);
    else {
      const empty = !top.textContent?.trim() && !top.querySelector('[data-att], table, img, li');
      top.after(...added);
      if (empty) top.remove();
    }
    const last = added.at(-1);
    if (last) {
      const r = document.createRange();
      r.setStart(last, 0);
      r.collapse(true);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      range.current = r.cloneRange();
    }
    hydrate();
    changed();
  };

  /** Chrome sometimes puts a list inside a paragraph: the paragraph is taken away, the caret stays. */
  const fixNesting = () => {
    const node = ed.current!;
    const sel = document.getSelection()!;
    const a = sel.anchorNode;
    const o = sel.anchorOffset;
    let moved = false;
    node.querySelectorAll('p').forEach((p) => {
      if (p.querySelector(':scope > ul, :scope > ol, :scope > p, :scope > table, :scope > h2, :scope > h3, :scope > blockquote, :scope > div, :scope > figure')) {
        p.replaceWith(...p.childNodes);
        moved = true;
      }
    });
    if (moved && a && node.contains(a)) {
      const r = document.createRange();
      r.setStart(a, Math.min(o, a.nodeType === Node.TEXT_NODE ? (a.textContent ?? '').length : a.childNodes.length));
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  /**
   * The browser puts a sub-list next to the item it belongs to (<ol><li>a</li><ol>…</ol></ol>):
   * it goes inside that item, as Word and the export expect, and two sub-lists of one item become one.
   */
  const fixLists = () => {
    const node = ed.current!;
    const sel = document.getSelection()!;
    const a = sel.anchorNode;
    const o = sel.anchorOffset;
    let moved = false;
    for (const list of [...node.querySelectorAll<HTMLElement>(':is(ul, ol) > :is(ul, ol)')]) {
      const prev = list.previousElementSibling;
      if (prev?.tagName !== 'LI') continue;
      const last = prev.lastElementChild;
      if (last && last.tagName === list.tagName && last.className === list.className) {
        last.append(...list.childNodes);
        list.remove();
      } else prev.append(list);
      moved = true;
    }
    if (moved && a && node.contains(a)) {
      const r = document.createRange();
      r.setStart(a, Math.min(o, a.nodeType === Node.TEXT_NODE ? (a.textContent ?? '').length : a.childNodes.length));
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const tableOp = (op: 'row' | 'col' | 'delRow' | 'delCol' | 'del') => {
    const cell = at()?.closest('td, th') as HTMLTableCellElement | null;
    const table = cell?.closest('table');
    if (!cell || !table) return;
    const tr = cell.parentElement as HTMLTableRowElement;
    const col = cell.cellIndex;
    const rows = [...table.querySelectorAll('tr')];
    if (op === 'row') {
      const n = document.createElement('tr');
      n.innerHTML = [...tr.cells].map(() => '<td><br></td>').join('');
      tr.after(n);
    } else if (op === 'col') rows.forEach((r) => r.cells[col]?.insertAdjacentHTML('afterend', '<td><br></td>'));
    else if (op === 'delRow') rows.length > 1 ? tr.remove() : table.remove();
    else if (op === 'delCol') tr.cells.length > 1 ? rows.forEach((r) => r.cells[col]?.remove()) : table.remove();
    else table.remove();
    changed();
    document.dispatchEvent(new Event('selectionchange'));
  };

  const removeMedia = (el: HTMLElement) => {
    const r = document.createRange();
    r.selectNode(el);
    const sel = document.getSelection()!;
    ed.current!.focus({ preventScroll: true });
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand('delete');
    changed();
  };

  async function upload(list: File[], kind: InsertKind) {
    if (!list.length) return;
    setBusy(true);
    const added: NoteFile[] = [];
    try {
      for (const file of list) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const isImg = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|opus|webm|amr|3gp)$/i.test(file.name);
        if (kind === 'pdf' && !isPdf) {
          window.alert(`“${file.name}” non è un PDF.`);
          continue;
        }
        if (isPdf && file.size > MAX_PDF) {
          window.alert(`“${file.name}” supera 8 MB: riducilo prima di allegarlo.`);
          continue;
        }
        if (isAudio && file.size > MAX_AUDIO) {
          window.alert(`“${file.name}” supera 25 MB.`);
          continue;
        }
        if (!isPdf && !isImg && !isAudio) {
          window.alert(`“${file.name}” non è un’immagine, un PDF o un audio.`);
          continue;
        }
        const id = uid();
        let blob: Blob = file;
        let name = file.name;
        if (isImg) {
          blob = await compress(kind === 'scan' ? await scanLook(file) : file);
          name = kind === 'scan' ? `Scansione ${new Date().toLocaleDateString('it-IT')}.jpg` : file.name.replace(/\.[^.]+$/, '') + '.jpg';
        }
        const { src, path } = await repo.uploadFile(id, blob);
        urls.current.set(id, URL.createObjectURL(blob));
        added.push({ id, name, src, path, size: blob.size, kind: isImg ? 'image' : isPdf ? 'pdf' : 'audio' });
      }
      if (added.length) {
        onFiles(added);
        filesRef.current = [...filesRef.current, ...added];
        insertBlocks(added.map(mediaHtml).join(''));
      }
    } catch (e) {
      window.alert(`Non è stato possibile allegare il file: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  // ---- Voice recording ----
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return window.alert('Questo browser non può registrare l’audio.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32_000 });
      const state = { mr, chunks: [] as Blob[], started: Date.now(), acc: 0, lock: undefined as WakeLockSentinel | undefined, cancel: false };
      // Loudness every quarter of a second, for the waveform of the player.
      const levels: number[] = [];
      let meter: AudioContext | undefined;
      let sampler = 0;
      try {
        meter = new AudioContext();
        const an = meter.createAnalyser();
        an.fftSize = 1024;
        meter.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        sampler = window.setInterval(() => {
          if (mr.state !== 'recording') return;
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          levels.push(Math.sqrt(sum / buf.length));
        }, 250);
      } catch {
        /* no waveform: the player draws a quiet one */
      }
      recorder.current = state;
      mr.ondataavailable = (e) => e.data.size && state.chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(sampler);
        void meter?.close().catch(() => undefined);
        state.lock?.release().catch(() => undefined);
        const sec = Math.round(state.acc);
        recorder.current = null;
        setRec(null);
        if (state.cancel || !state.chunks.length) return;
        const blob = new Blob(state.chunks, { type: mr.mimeType || 'audio/webm' });
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        const when = new Date().toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        setBusy(true);
        try {
          const id = uid();
          const { src, path } = await repo.uploadFile(id, blob);
          urls.current.set(id, URL.createObjectURL(blob));
          const wave = toWave(levels);
          const f: NoteFile = { id, name: `Registrazione ${when}.${ext}`, src, path, size: blob.size, kind: 'audio', sec, ...(wave.length ? { wave } : {}) };
          filesRef.current = [...filesRef.current, f];
          // The note was closed while recording: the recording goes at the end of it.
          if (!ed.current?.isConnected) return onFiles([f], true);
          onFiles([f]);
          insertBlocks(mediaHtml(f));
        } finally {
          setBusy(false);
        }
      };
      mr.start(1000);
      setRec({ sec: 0, paused: false });
      state.lock = await navigator.wakeLock?.request('screen').catch(() => undefined);
    } catch {
      window.alert('Microfono non disponibile: consenti l’accesso al microfono per registrare.');
    }
  }
  useEffect(() => {
    if (!rec || rec.paused) return;
    const t = window.setInterval(() => {
      const r = recorder.current;
      if (r) setRec({ sec: r.acc + (Date.now() - r.started) / 1000, paused: false });
    }, 500);
    return () => window.clearInterval(t);
  }, [rec]);
  const pauseRecording = () => {
    const r = recorder.current;
    if (!r) return;
    if (r.mr.state === 'recording') {
      r.mr.pause();
      r.acc += (Date.now() - r.started) / 1000;
      setRec({ sec: r.acc, paused: true });
    } else {
      r.mr.resume();
      r.started = Date.now();
      setRec({ sec: r.acc, paused: false });
    }
  };
  const stopRecording = (cancel = false) => {
    const r = recorder.current;
    if (!r) return;
    if (r.mr.state === 'recording') r.acc += (Date.now() - r.started) / 1000;
    r.cancel = cancel;
    r.mr.stop();
  };
  useEffect(() => () => stopRecording(false), []);

  useImperativeHandle(ref, () => ({
    insert: (kind) => inputs.current[kind]?.click(),
    record: () => (recorder.current ? undefined : void startRecording()),
    table: () => {
      insertBlocks(`<table class="n-table n-new"><tbody>${'<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3)}</tbody></table><p><br></p>`);
      // Writing starts in the first cell.
      const t = ed.current?.querySelector('table.n-new');
      t?.classList.remove('n-new');
      const cell = t?.querySelector('td');
      if (cell) {
        const r = document.createRange();
        r.setStart(cell, 0);
        r.collapse(true);
        const sel = document.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(r);
        range.current = r.cloneRange();
      }
    },
    flush,
    focus: () => restore(),
  }));

  const Btn = ({ icon, label, on, run }: { icon: SymName; label: string; on?: boolean; run: () => void }) => (
    <button type="button" className={`rt-btn${on ? ' on' : ''}`} aria-label={label} aria-pressed={on} title={label} onPointerDown={(e) => e.preventDefault()} onClick={run}>
      <Sym name={icon} size={22} />
    </button>
  );

  return (
    <>
      <div
        ref={ed}
        className={`note-body${readOnly ? ' reading' : ''}`}
        contentEditable={!readOnly}
        lang="it"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Testo della nota"
        data-placeholder="Scrivi qui i tuoi appunti…"
        spellCheck
        onInput={changed}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            tab(e.shiftKey);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
            return;
          }
          // Backspace at the very start of a sub-item: back up one level, as in Word.
          if (e.key === 'Backspace') {
            const sel = document.getSelection();
            const li = at()?.closest('li');
            if (sel?.isCollapsed && sel.anchorNode && li && li.parentElement?.parentElement?.tagName === 'LI') {
              const r = document.createRange();
              r.setStart(li, 0);
              r.setEnd(sel.anchorNode, sel.anchorOffset);
              if (!r.toString() && !r.cloneContents().querySelector('img, br + *')) {
                e.preventDefault();
                tab(true);
                return;
              }
            }
          }
          // Enter on an empty sub-item goes back up one level, as in Word.
          if (e.key === 'Enter' && !e.shiftKey) {
            const li = at()?.closest('li');
            if (li && li.parentElement?.parentElement?.tagName === 'LI' && !li.textContent?.trim() && !li.querySelector('ul, ol, img')) {
              e.preventDefault();
              tab(true);
              return;
            }
          }
          // A new line of a checklist starts unticked.
          if (e.key === 'Enter' && at()?.closest('ul.n-check'))
            window.setTimeout(() => {
              at()?.closest('li')?.removeAttribute('data-done');
            }, 0);
        }}
        onPaste={(e) => {
          const pasted = [...e.clipboardData.files];
          if (pasted.length) {
            e.preventDefault();
            void upload(pasted, 'image');
            return;
          }
          const html = e.clipboardData.getData('text/html');
          if (html) {
            e.preventDefault();
            const clean = document.createElement('div');
            clean.innerHTML = sanitizeHtml(html);
            clean.querySelectorAll('[data-att]').forEach((x) => x.remove());
            insertHtml(clean.innerHTML);
          }
        }}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          const media = t.closest<HTMLElement>('.n-media');
          if (media) {
            const r = media.getBoundingClientRect();
            const corner = e.clientX > r.right - 40 && e.clientY < r.top + 40;
            if (corner && !readOnly) {
              const kind = media.dataset.kind === 'image' ? 'questa immagine' : media.dataset.kind === 'audio' ? 'questa registrazione' : 'questo allegato';
              void confirmDelete(`${kind} dalla nota`).then((ok) => ok && removeMedia(media));
              return;
            }
            const f = filesRef.current.find((x) => x.id === media.dataset.att);
            const img = media.querySelector('img');
            if (media.classList.contains('n-img') && img && e.clientY > img.getBoundingClientRect().bottom) {
              if (!readOnly) setCaption({ el: media, text: media.querySelector('figcaption')?.textContent ?? '' });
              return;
            }
            if (media.classList.contains('n-img')) {
              const u = media.querySelector('img')?.getAttribute('src');
              if (u) onViewImage(u, () => removeMedia(media));
            } else if (media.classList.contains('n-file') && f) void openFile(repo, f);
            return;
          }
          const mark = !readOnly && markerAt(t, e.clientX, e.clientY);
          if (mark) {
            e.preventDefault();
            const r = mark.getBoundingClientRect();
            const line = parseFloat(getComputedStyle(mark).lineHeight) || 24;
            const below = r.top + line + 8;
            setListMenu({ li: mark, top: below + 300 > window.innerHeight ? Math.max(8, r.top - 300) : below, left: Math.max(8, Math.min(r.left - 40, window.innerWidth - 300)) });
            return;
          }
          const li = t.closest('ul.n-check > li') as HTMLElement | null;
          if (li && e.clientX - li.getBoundingClientRect().left < 34) {
            e.preventDefault();
            li.toggleAttribute('data-done');
            changed();
          }
        }}
      />

      <input ref={(el) => void (inputs.current.image = el)} type="file" accept="image/*" multiple hidden onChange={(e) => (upload([...(e.target.files ?? [])], 'image'), (e.target.value = ''))} />
      <input ref={(el) => void (inputs.current.camera = el)} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (upload([...(e.target.files ?? [])], 'camera'), (e.target.value = ''))} />
      <input ref={(el) => void (inputs.current.scan = el)} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (upload([...(e.target.files ?? [])], 'scan'), (e.target.value = ''))} />
      <input ref={(el) => void (inputs.current.pdf = el)} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => (upload([...(e.target.files ?? [])], 'pdf'), (e.target.value = ''))} />
      <input ref={(el) => void (inputs.current.audio = el)} type="file" accept="audio/*" hidden onChange={(e) => (upload([...(e.target.files ?? [])], 'audio'), (e.target.value = ''))} />

      {listMenu &&
        createPortal(
          <div className="lm-backdrop" onPointerDown={() => setListMenu(null)}>
            <div className="lm-pop" role="menu" aria-label="Stile dell’elenco" style={{ top: listMenu.top, left: listMenu.left }} onPointerDown={(e) => e.stopPropagation()}>
              {(() => {
                const now = styleOf(listMenu.li.parentElement!);
                const item = ([st, sample, label]: [ListStyle, string, string]) => (
                  <button key={st} type="button" role="menuitemradio" aria-checked={now === st} aria-label={label} title={label} className={`lm-opt${now === st ? ' on' : ''}${BULLET_STYLES.some(([x]) => x === st) ? ' bullet' : ''}`} onClick={() => (setListStyle(listMenu.li, st), setListMenu(null))}>
                    {sample}
                  </button>
                );
                const nested = listMenu.li.parentElement?.parentElement?.tagName === 'LI';
                return (
                  <>
                    <span className="lm-label">Punti</span>
                    <div className="lm-row">{BULLET_STYLES.map(item)}</div>
                    <span className="lm-label">Numeri</span>
                    <div className="lm-grid">{NUMBER_STYLES.map(item)}</div>
                    <div className="lm-levels">
                      <button type="button" disabled={!nested} onClick={() => {
                        const li = listMenu.li;
                        setListMenu(null);
                        ed.current!.focus({ preventScroll: true });
                        const r = document.createRange();
                        r.setStart(li, 0);
                        const sel = document.getSelection()!;
                        sel.removeAllRanges();
                        sel.addRange(r);
                        tab(true);
                      }}>
                        <Sym name="format_indent_decrease" size={18} /> Sali di livello
                      </button>
                      <button type="button" disabled={!listMenu.li.previousElementSibling} onClick={() => {
                        const li = listMenu.li;
                        setListMenu(null);
                        ed.current!.focus({ preventScroll: true });
                        const r = document.createRange();
                        r.setStart(li, 0);
                        const sel = document.getSelection()!;
                        sel.removeAllRanges();
                        sel.addRange(r);
                        tab(false);
                      }}>
                        <Sym name="format_indent_increase" size={18} /> Sotto-elenco
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body,
        )}
      {caption &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setCaption(null)}>
            <form
              className="sheet caption-sheet"
              role="dialog"
              aria-label="Didascalia"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                saveCaption(caption.el, caption.text);
              }}
            >
              <div className="sheet-head">
                <h2>Didascalia</h2>
                <button type="button" className="icon-btn" aria-label="Chiudi" onClick={() => setCaption(null)}>
                  <Sym name="close" size={20} />
                </button>
              </div>
              <input autoFocus value={caption.text} placeholder="es. Fig. 1 · Punto di flessione e asse di trazione" onChange={(e) => setCaption({ ...caption, text: e.target.value })} enterKeyHint="done" />
              <div className="sheet-foot">
                {caption.el.querySelector('figcaption') ? (
                  <button type="button" className="btn-ghost" onClick={() => saveCaption(caption.el, '')}>
                    Togli
                  </button>
                ) : (
                  <span />
                )}
                <button type="submit" className="btn">
                  Salva
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {!readOnly && (
        <div className="rt-dock no-print">
          {busy && <div className="rt-busy">Salvataggio dell’allegato…</div>}
          {rec && (
            <div className="rt-rec" role="status">
              <span className={`rec-dot${rec.paused ? ' paused' : ''}`} aria-hidden="true" />
              <strong>{rec.paused ? 'In pausa' : 'Registrazione'} {mmss(rec.sec)}</strong>
              <span className="rec-hint">Tieni l’app aperta mentre registri</span>
              <button type="button" className="icon-btn small" aria-label={rec.paused ? 'Riprendi' : 'Pausa'} onClick={pauseRecording}>
                <Sym name={rec.paused ? 'mic' : 'pause'} size={20} />
              </button>
              <button type="button" className="rec-stop" onClick={() => stopRecording(false)}>
                <Sym name="stop-fill" size={18} /> Salva
              </button>
              <button type="button" className="icon-btn small" aria-label="Annulla la registrazione" onClick={async () => (await confirmDelete('questa registrazione')) && stopRecording(true)}>
                <Sym name="close" size={18} />
              </button>
            </div>
          )}
          {active.table && (
            <div className="rt-table" role="toolbar" aria-label="Tabella">
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => tableOp('row')}>+ Riga</button>
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => tableOp('col')}>+ Colonna</button>
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => tableOp('delRow')}>− Riga</button>
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => tableOp('delCol')}>− Colonna</button>
              <button type="button" className="danger" onPointerDown={(e) => e.preventDefault()} onClick={async () => {
                const table = at()?.closest('table');
                if (!table || !(await confirmDelete('questa tabella'))) return;
                table.remove();
                changed();
                document.dispatchEvent(new Event('selectionchange'));
              }}>Elimina tabella</button>
            </div>
          )}
          {pop && (
            <div className="rt-pop" role="menu">
              {pop === 'block' &&
                BLOCKS.map(([tag, label]) => (
                  <button key={tag} type="button" role="menuitemradio" aria-checked={active.block === tag} className={`rt-block b-${tag}${active.block === tag ? ' on' : ''}`} onPointerDown={(e) => e.preventDefault()} onClick={() => block(tag)}>
                    {label}
                  </button>
                ))}
              {pop === 'color' &&
                TEXT_COLORS.map(([label, c]) => (
                  <button key={label} type="button" className="rt-swatch" aria-label={label} title={label} onPointerDown={(e) => e.preventDefault()} onClick={() => paint('foreColor', c)}>
                    <span style={{ color: c ?? undefined }}>A</span>
                  </button>
                ))}
              {pop === 'font' &&
                FONTS.map(([label, f]) => (
                  <button key={label} type="button" role="menuitemradio" aria-checked={(active.font ?? 'Predefinito') === label} className={`rt-block rt-font${(active.font ?? 'Predefinito') === label ? ' on' : ''}`} style={{ fontFamily: f ?? undefined }} onPointerDown={(e) => e.preventDefault()} onClick={() => setFont(f)}>
                    {label}
                  </button>
                ))}
              {pop === 'size' &&
                SIZES.map((pt) => (
                  <button key={pt} type="button" role="menuitemradio" aria-checked={active.pt === pt} className={`rt-size${active.pt === pt ? ' on' : ''}`} onPointerDown={(e) => e.preventDefault()} onClick={() => (setSize(pt), setPop(null))}>
                    {pt}
                  </button>
                ))}
              {pop === 'marker' &&
                MARKERS.map(([label, c]) => (
                  <button key={label} type="button" className={`rt-swatch marker${c ? '' : ' none'}`} aria-label={label} title={label} style={{ background: c ?? undefined }} onPointerDown={(e) => e.preventDefault()} onClick={() => paint('hiliteColor', c)} />
                ))}
            </div>
          )}
          <div className="rt-bar" role="toolbar" aria-label="Formattazione">
            <button type="button" className={`rt-btn rt-aa${pop === 'block' ? ' on' : ''}`} aria-label="Stile del paragrafo" onPointerDown={(e) => e.preventDefault()} onClick={() => setPop(pop === 'block' ? null : 'block')}>
              Aa<span aria-hidden="true">▾</span>
            </button>
            <button type="button" className={`rt-btn rt-fontbtn${pop === 'font' ? ' on' : ''}`} aria-label="Carattere" title="Carattere" onPointerDown={(e) => e.preventDefault()} onClick={() => setPop(pop === 'font' ? null : 'font')}>
              <Sym name="font_download" size={20} />
              <span>{active.font && active.font !== 'Predefinito' ? active.font.split(' ')[0] : 'Font'}</span>
            </button>
            <button type="button" className={`rt-btn rt-sizebtn${pop === 'size' ? ' on' : ''}`} aria-label="Dimensione del testo" title="Dimensione del testo (pt)" onPointerDown={(e) => e.preventDefault()} onClick={() => setPop(pop === 'size' ? null : 'size')}>
              {active.pt ?? 12}
              <span aria-hidden="true">▾</span>
            </button>
            <Btn icon="text_decrease" label="Testo più piccolo" run={() => stepSize(-1)} />
            <Btn icon="text_increase" label="Testo più grande" run={() => stepSize(1)} />
            <button type="button" className={`rt-btn rt-en${active.en ? ' on' : ''}`} aria-pressed={!!active.en} aria-label="Testo in inglese (correttore inglese)" title="Segna il testo scelto come inglese: il correttore lo controlla in inglese" onPointerDown={(e) => e.preventDefault()} onClick={toggleEnglish}>
              EN
            </button>
            <Btn icon="format_bold" label="Grassetto" on={active.bold} run={() => exec('bold')} />
            <Btn icon="format_italic" label="Corsivo" on={active.italic} run={() => exec('italic')} />
            <Btn icon="format_underlined" label="Sottolineato" on={active.underline} run={() => exec('underline')} />
            <Btn icon="ink_highlighter" label="Evidenziatore" on={pop === 'marker'} run={() => setPop(pop === 'marker' ? null : 'marker')} />
            <Btn icon="format_color_text" label="Colore del testo" on={pop === 'color'} run={() => setPop(pop === 'color' ? null : 'color')} />
            <Btn icon="checklist" label="Checklist" on={active.check} run={checklist} />
            <Btn icon="format_list_bulleted" label="Elenco puntato" on={active.ul} run={bullets} />
            <Btn icon="format_list_numbered" label="Elenco numerato" on={active.ol} run={numbers} />
            <Btn icon="format_indent_increase" label="Tab (spazio o sotto-elenco)" run={() => tab(false)} />
            <Btn icon="strikethrough_s" label="Barrato" on={active.strike} run={() => exec('strikeThrough')} />
            <Btn icon="undo" label="Annulla" run={undo} />
            <Btn icon="redo" label="Ripeti" run={() => exec('redo')} />
          </div>
        </div>
      )}
    </>
  );
}
