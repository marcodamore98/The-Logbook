import { confirmDelete } from '../Confirm';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { compress } from '../../lib/image';
import { sanitizeHtml } from '../../lib/notes';
import { useStore } from '../../lib/store/StoreContext';
import type { NoteFile } from '../../lib/types';
import { openFile } from '../files/FileSlot';
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
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  const [pop, setPop] = useState<'block' | 'color' | 'marker' | null>(null);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [rec, setRec] = useState<{ sec: number; paused: boolean } | null>(null);
  const recorder = useRef<{ mr: MediaRecorder; chunks: Blob[]; started: number; acc: number; lock?: WakeLockSentinel; cancel?: boolean } | null>(null);

  const serialize = () => {
    const node = ed.current;
    if (!node) return '';
    const c = node.cloneNode(true) as HTMLElement;
    c.querySelectorAll('img, audio').forEach((m) => m.removeAttribute('src'));
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
      });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const restore = () => {
    const node = ed.current!;
    node.focus({ preventScroll: true });
    const sel = document.getSelection()!;
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
    if (/List|indent|outdent|formatBlock/.test(cmd)) fixNesting();
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
    } else exec('insertUnorderedList');
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
      recorder.current = state;
      mr.ondataavailable = (e) => e.data.size && state.chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
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
          const f: NoteFile = { id, name: `Registrazione ${when}.${ext}`, src, path, size: blob.size, kind: 'audio', sec };
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
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Testo della nota"
        data-placeholder="Scrivi qui i tuoi appunti…"
        spellCheck
        onInput={changed}
        onKeyDown={(e) => {
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
            if (media.classList.contains('n-img')) {
              const u = media.querySelector('img')?.getAttribute('src');
              if (u) onViewImage(u, () => removeMedia(media));
            } else if (media.classList.contains('n-file') && f) void openFile(repo, f);
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
            <Btn icon="format_bold" label="Grassetto" on={active.bold} run={() => exec('bold')} />
            <Btn icon="format_italic" label="Corsivo" on={active.italic} run={() => exec('italic')} />
            <Btn icon="format_underlined" label="Sottolineato" on={active.underline} run={() => exec('underline')} />
            <Btn icon="ink_highlighter" label="Evidenziatore" on={pop === 'marker'} run={() => setPop(pop === 'marker' ? null : 'marker')} />
            <Btn icon="format_color_text" label="Colore del testo" on={pop === 'color'} run={() => setPop(pop === 'color' ? null : 'color')} />
            <Btn icon="checklist" label="Checklist" on={active.check} run={checklist} />
            <Btn icon="format_list_bulleted" label="Elenco puntato" on={active.ul} run={bullets} />
            <Btn icon="format_list_numbered" label="Elenco numerato" on={active.ol} run={() => exec('insertOrderedList')} />
            <Btn icon="strikethrough_s" label="Barrato" on={active.strike} run={() => exec('strikeThrough')} />
            <Btn icon="format_indent_increase" label="Aumenta rientro" run={() => exec('indent')} />
            <Btn icon="format_indent_decrease" label="Riduci rientro" run={() => exec('outdent')} />
            <Btn icon="undo" label="Annulla" run={() => exec('undo')} />
            <Btn icon="redo" label="Ripeti" run={() => exec('redo')} />
          </div>
        </div>
      )}
    </>
  );
}
