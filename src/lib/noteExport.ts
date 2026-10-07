import { bodyOf, findNote, folderOfNote, noteTitle, pathLabel, sanitizeHtml, type NoteRow } from './notes';
import type { Repo } from './store/repo';
import type { DayEntry, ISODate, NoteFile, NoteFolder, Settings, StudyModule } from './types';
import { STUDY_TYPES, labelOf } from './vocab';

/**
 * Saving notes outside the app: PDF and Word files, the phone's share menu, and one file with
 * every note and attachment (to keep a copy or move to another phone, and to restore it).
 */

export interface ExportNote {
  title: string;
  meta: string;
  tags: string[];
  html: string;
  files: NoteFile[];
}

export function exportable(r: NoteRow, folders: NoteFolder[]): ExportNote {
  const m = r.m;
  const date = new Date(`${r.date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const folder = pathLabel(folders, folderOfNote(folders, m));
  const session = m.free ? '' : `${labelOf(STUDY_TYPES, m.type)}${m.durationMin ? ` · ${m.durationMin >= 60 ? `${Math.floor(m.durationMin / 60)} h ${m.durationMin % 60 ? `${m.durationMin % 60} min` : ''}` : `${m.durationMin} min`}` : ''}`;
  return { title: noteTitle(r), meta: [folder, date, session].filter(Boolean).join(' · '), tags: m.tags ?? [], html: bodyOf(m), files: m.attachments ?? [] };
}

export const fileName = (title: string, ext: string) => `${(title || 'Nota').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)}.${ext}`;

// ---- Reading the note's HTML into simple blocks ----

interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  color?: string;
  bg?: string;
}
type Block =
  | { t: 'h2' | 'h3' | 'p' | 'quote'; runs: Run[] }
  | { t: 'li'; runs: Run[]; level: number; mark: 'bullet' | 'number' | 'todo' | 'done'; n: number; list: number }
  | { t: 'image'; id: string }
  | { t: 'file'; id: string; name: string; kind: string }
  | { t: 'table'; rows: Run[][][] };

function runsOf(el: Node, style: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = [];
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = (n.textContent ?? '').replace(/\s+/g, ' ');
      if (text) out.push({ text, ...style });
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const e = n as HTMLElement;
    if (e.tagName === 'BR') {
      out.push({ text: '\n', ...style });
      continue;
    }
    if (e.dataset.att || /^(UL|OL|TABLE)$/.test(e.tagName)) continue;
    const s = { ...style };
    if (/^(B|STRONG)$/.test(e.tagName) || /bold|[6-9]00/.test(e.style.fontWeight)) s.b = true;
    if (/^(I|EM)$/.test(e.tagName) || e.style.fontStyle === 'italic') s.i = true;
    if (e.tagName === 'U' || /underline/.test(e.style.textDecoration)) s.u = true;
    if (/^(S|STRIKE|DEL)$/.test(e.tagName) || /line-through/.test(e.style.textDecoration)) s.s = true;
    if (e.style.color) s.color = e.style.color;
    if (e.style.backgroundColor) s.bg = e.style.backgroundColor;
    out.push(...runsOf(e, s));
  }
  return out;
}

function blocksOf(html: string): Block[] {
  const root = document.createElement('div');
  root.innerHTML = sanitizeHtml(html);
  const out: Block[] = [];
  let lists = 0;
  const walk = (el: Element, level = 0) => {
    for (const c of el.children) {
      const e = c as HTMLElement;
      if (e.dataset.att) {
        if (e.dataset.kind === 'image') out.push({ t: 'image', id: e.dataset.att });
        else out.push({ t: 'file', id: e.dataset.att, name: e.dataset.name ?? 'Allegato', kind: e.dataset.kind ?? 'pdf' });
        continue;
      }
      switch (e.tagName) {
        case 'H2':
        case 'H3':
          out.push({ t: e.tagName === 'H2' ? 'h2' : 'h3', runs: runsOf(e) });
          break;
        case 'BLOCKQUOTE':
          if (e.querySelector('p, div, ul, ol, h2, h3, table')) walk(e, level);
          else out.push({ t: 'quote', runs: runsOf(e) });
          break;
        case 'UL':
        case 'OL': {
          const list = ++lists;
          let n = 0;
          for (const li of e.children) {
            if (li.tagName !== 'LI') continue;
            n++;
            const mark = e.tagName === 'OL' ? 'number' : e.classList.contains('n-check') ? (li.hasAttribute('data-done') ? 'done' : 'todo') : 'bullet';
            out.push({ t: 'li', runs: runsOf(li), level, mark, n, list });
            for (const sub of li.children) if (/^(UL|OL)$/.test(sub.tagName)) walk({ children: [sub] } as unknown as Element, level + 1);
          }
          break;
        }
        case 'TABLE':
          out.push({ t: 'table', rows: [...e.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => runsOf(td))) });
          break;
        case 'DIV':
        case 'FIGURE':
          if (e.querySelector('p, div, ul, ol, h2, h3, table, blockquote, figure')) walk(e, level);
          else out.push({ t: 'p', runs: runsOf(e) });
          break;
        case 'HR':
          break;
        default:
          out.push({ t: 'p', runs: runsOf(e) });
      }
    }
  };
  walk(root);
  return out;
}

/** "rgb(…)", "rgba(…)" or "#…" → solid [r, g, b], blended on white when transparent. */
function rgbOf(c: string | undefined): [number, number, number] | null {
  if (!c) return null;
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
  const mix = (v: number) => Math.round(v * a + 255 * (1 - a));
  return [mix(r), mix(g), mix(b)];
}
const hexOf = (rgb: [number, number, number]) => rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

async function dataOf(repo: Repo, f: NoteFile): Promise<string> {
  return repo.resolveFile(f.src).catch(() => '');
}
function sizeOf(url: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res({ w: 0, h: 0 });
    img.src = url;
  });
}

// The standard PDF fonts have no arrows, comparison signs or Greek letters: spell them out.
const PDF_TEXT: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '↑': '(aum.)', '↓': '(dim.)', '≥': '>=', '≤': '<=', '≈': '~', '≠': '!=', '✓': 'v', '✔': 'v', '✗': 'x',
  'α': 'alfa', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'Δ': 'Delta', 'κ': 'kappa', 'λ': 'lambda', 'σ': 'sigma', 'χ': 'chi',
};
const pdfText = (s: string) => s.replace(/[^\u0000-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, (c) => PDF_TEXT[c] ?? '');

export async function notePdf(n: ExportNote, repo: Repo): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 18;
  const CW = W - 2 * M;
  let y = M;
  const ink: [number, number, number] = [31, 33, 36];
  const muted: [number, number, number] = [110, 114, 120];
  const room = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const font = (r: Run) => doc.setFont('helvetica', r.b && r.i ? 'bolditalic' : r.b ? 'bold' : r.i ? 'italic' : 'normal');

  /** Lays out styled runs in lines, from x with the given width. */
  const paragraph = (runs: Run[], size: number, x = M, width = CW, base: Partial<Run> = {}, gap = 2.2) => {
    doc.setFontSize(size);
    const lh = size * 0.3528 * 1.38;
    type Word = { text: string; r: Run; w: number; space: number };
    const lines: Word[][] = [[]];
    let lineW = 0;
    for (const raw of runs) {
      const r = { ...base, ...raw };
      font(r);
      const parts = pdfText(r.text).split(/(\n| )/);
      for (const p of parts) {
        if (p === '\n') {
          lines.push([]);
          lineW = 0;
          continue;
        }
        if (p === ' ') {
          const last = lines[lines.length - 1].at(-1);
          if (last) last.space += doc.getTextWidth(' ');
          continue;
        }
        if (!p) continue;
        let w = doc.getTextWidth(p);
        let text = p;
        // A word longer than the line is cut.
        while (w > width && text.length > 1) {
          let k = text.length - 1;
          while (k > 1 && doc.getTextWidth(text.slice(0, k)) > width) k--;
          lines[lines.length - 1].push({ text: text.slice(0, k), r, w: doc.getTextWidth(text.slice(0, k)), space: 0 });
          lines.push([]);
          text = text.slice(k);
          w = doc.getTextWidth(text);
          lineW = 0;
        }
        const cur = lines[lines.length - 1];
        const prevSpace = cur.at(-1)?.space ?? 0;
        if (cur.length && lineW + prevSpace + w > width) {
          lines.push([]);
          lineW = 0;
        } else lineW += prevSpace;
        lines[lines.length - 1].push({ text, r, w, space: 0 });
        lineW += w;
      }
    }
    for (const line of lines) {
      room(lh);
      let cx = x;
      for (const wd of line) {
        font(wd.r);
        const bg = rgbOf(wd.r.bg);
        if (bg) {
          doc.setFillColor(...bg);
          doc.rect(cx - 0.3, y - lh * 0.72, wd.w + wd.space + 0.6, lh * 0.95, 'F');
        }
        doc.setTextColor(...(rgbOf(wd.r.color) ?? ink));
        doc.text(wd.text, cx, y);
        if (wd.r.u || wd.r.s) {
          doc.setDrawColor(...(rgbOf(wd.r.color) ?? ink));
          doc.setLineWidth(0.25);
          const ly = wd.r.u ? y + 0.8 : y - size * 0.3528 * 0.3;
          doc.line(cx, ly, cx + wd.w, ly);
        }
        cx += wd.w + wd.space;
      }
      y += lh;
    }
    y += gap;
    return lh;
  };

  // Heading of the document
  doc.setFont('helvetica', 'bold');
  paragraph([{ text: n.title, b: true }], 20, M, CW, {}, 1);
  if (n.meta) paragraph([{ text: n.meta }], 9.5, M, CW, { color: `rgb(${muted.join(',')})` }, 1);
  if (n.tags.length) paragraph([{ text: n.tags.map((t) => `#${t}`).join('  ') }], 9.5, M, CW, { color: 'rgb(98, 84, 200)' }, 1);
  doc.setDrawColor(220, 222, 226);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 6;

  const byId = new Map(n.files.map((f) => [f.id, f]));
  for (const b of blocksOf(n.html)) {
    if (b.t === 'h2') {
      y += 2;
      paragraph(b.runs, 15, M, CW, { b: true }, 1.5);
    } else if (b.t === 'h3') {
      y += 1;
      paragraph(b.runs, 12.5, M, CW, { b: true }, 1.2);
    } else if (b.t === 'p') {
      if (!b.runs.some((r) => r.text.trim())) {
        y += 3;
        continue;
      }
      paragraph(b.runs, 11, M, CW);
    } else if (b.t === 'quote') {
      const top = y - 4;
      paragraph(b.runs, 11, M + 6, CW - 6, { i: true, color: `rgb(${muted.join(',')})` });
      doc.setDrawColor(185, 176, 245);
      doc.setLineWidth(1);
      doc.line(M + 1.5, top, M + 1.5, y - 3);
    } else if (b.t === 'li') {
      const x = M + 4 + b.level * 6;
      doc.setFontSize(11);
      room(6);
      doc.setTextColor(...ink);
      doc.setFont('helvetica', 'normal');
      if (b.mark === 'bullet') doc.text('•', x, y);
      else if (b.mark === 'number') doc.text(`${b.n}.`, x, y);
      else {
        doc.setDrawColor(...ink);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y - 3.2, 3.6, 3.6, 0.6, 0.6, b.mark === 'done' ? 'FD' : 'S');
        if (b.mark === 'done') {
          doc.setDrawColor(255, 255, 255);
          doc.setFillColor(...ink);
          doc.setLineWidth(0.5);
          doc.line(x + 0.8, y - 1.4, x + 1.6, y - 0.5);
          doc.line(x + 1.6, y - 0.5, x + 3, y - 2.5);
        }
      }
      paragraph(b.runs, 11, x + 6, CW - (x + 6 - M), b.mark === 'done' ? { s: true, color: `rgb(${muted.join(',')})` } : {}, 1);
    } else if (b.t === 'image') {
      const f = byId.get(b.id);
      const url = f ? await dataOf(repo, f) : '';
      if (!url) continue;
      const { w, h } = await sizeOf(url);
      if (!w) continue;
      let iw = CW;
      let ih = (h / w) * iw;
      const maxH = H - 2 * M - 10;
      if (ih > maxH) {
        ih = maxH;
        iw = (w / h) * ih;
      }
      room(ih + 4);
      doc.addImage(url, 'JPEG', M + (CW - iw) / 2, y, iw, ih);
      y += ih + 5;
    } else if (b.t === 'file') {
      room(10);
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(M, y - 4.5, CW, 8, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(...muted);
      doc.setFont('helvetica', 'bold');
      doc.text(b.kind === 'audio' ? 'AUDIO' : 'PDF', M + 3, y + 0.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...ink);
      doc.text(pdfText(`Allegato: ${b.name}`).slice(0, 90), M + 17, y + 0.8);
      y += 10;
    } else if (b.t === 'table') {
      const cols = Math.max(1, ...b.rows.map((r) => r.length));
      const cw = CW / cols;
      for (const row of b.rows) {
        // Height of the row: the tallest cell.
        const start = y;
        const page = doc.getNumberOfPages();
        let bottom = y;
        row.forEach((cell, i) => {
          y = start + 4.5;
          doc.setPage(page);
          paragraph(cell.length ? cell : [{ text: ' ' }], 10, M + i * cw + 2, cw - 4, {}, 0);
          bottom = Math.max(bottom, y);
        });
        y = Math.max(bottom, start + 7) + 0.5;
        doc.setDrawColor(200, 203, 208);
        doc.setLineWidth(0.25);
        for (let i = 0; i < cols; i++) doc.rect(M + i * cw, start, cw, y - start);
      }
      y += 4;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`The Logbook · ${pdfText(n.title).slice(0, 60)}`, M, H - 8);
    doc.text(`${p} / ${pages}`, W - M, H - 8, { align: 'right' });
  }
  return doc.output('blob');
}

export async function noteDocx(n: ExportNote, repo: Repo): Promise<Blob> {
  const d = await import('docx');
  const runs = (list: Run[], base: Partial<Run> = {}) =>
    list.flatMap((raw) => {
      const r = { ...base, ...raw };
      const bg = rgbOf(r.bg);
      const color = rgbOf(r.color);
      return r.text.split('\n').map(
        (text, i) =>
          new d.TextRun({
            text,
            break: i > 0 ? 1 : undefined,
            bold: r.b,
            italics: r.i,
            underline: r.u ? {} : undefined,
            strike: r.s,
            color: color ? hexOf(color) : undefined,
            shading: bg ? { type: d.ShadingType.CLEAR, fill: hexOf(bg), color: 'auto' } : undefined,
          }),
      );
    });
  const children: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [
    new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun({ text: n.title, bold: true })] }),
  ];
  if (n.meta) children.push(new d.Paragraph({ children: [new d.TextRun({ text: n.meta, color: '6E7278', size: 20 })] }));
  if (n.tags.length) children.push(new d.Paragraph({ children: [new d.TextRun({ text: n.tags.map((t) => `#${t}`).join('  '), color: '6254C8', size: 20 })] }));
  const byId = new Map(n.files.map((f) => [f.id, f]));
  for (const b of blocksOf(n.html)) {
    if (b.t === 'h2' || b.t === 'h3') children.push(new d.Paragraph({ heading: b.t === 'h2' ? d.HeadingLevel.HEADING_1 : d.HeadingLevel.HEADING_2, children: runs(b.runs) }));
    else if (b.t === 'p') children.push(new d.Paragraph({ children: runs(b.runs) }));
    else if (b.t === 'quote') children.push(new d.Paragraph({ indent: { left: 567 }, border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: 'B9B0F5', space: 8 } }, children: runs(b.runs, { i: true }) }));
    else if (b.t === 'li') {
      if (b.mark === 'bullet') children.push(new d.Paragraph({ bullet: { level: b.level }, children: runs(b.runs) }));
      else if (b.mark === 'number') children.push(new d.Paragraph({ numbering: { reference: 'num', level: b.level, instance: b.list }, children: runs(b.runs) }));
      else children.push(new d.Paragraph({ indent: { left: 360 + b.level * 360 }, children: [new d.TextRun(b.mark === 'done' ? '☑ ' : '☐ '), ...runs(b.runs, b.mark === 'done' ? { s: true } : {})] }));
    } else if (b.t === 'image') {
      const f = byId.get(b.id);
      const url = f ? await dataOf(repo, f) : '';
      if (!url) continue;
      const { w, h } = await sizeOf(url);
      if (!w) continue;
      const iw = Math.min(600, w);
      const data = Uint8Array.from(atob(url.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
      children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.ImageRun({ type: 'jpg', data, transformation: { width: iw, height: Math.round((h / w) * iw) } })] }));
    } else if (b.t === 'file') children.push(new d.Paragraph({ children: [new d.TextRun({ text: `📎 Allegato: ${b.name}`, color: '6E7278' })] }));
    else if (b.t === 'table') {
      const cols = Math.max(1, ...b.rows.map((r) => r.length));
      children.push(
        new d.Table({
          width: { size: 100, type: d.WidthType.PERCENTAGE },
          rows: b.rows.map(
            (row) =>
              new d.TableRow({
                children: Array.from({ length: cols }, (_, i) => new d.TableCell({ children: [new d.Paragraph({ children: runs(row[i] ?? []) })] })),
              }),
          ),
        }),
      );
      children.push(new d.Paragraph({ children: [] }));
    }
  }
  const document_ = new d.Document({
    creator: 'The Logbook',
    title: n.title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [
        {
          reference: 'num',
          levels: [0, 1, 2, 3].map((level) => ({ level, format: d.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: d.AlignmentType.START, style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } } })),
        },
      ],
    },
    sections: [{ children }],
  });
  return d.Packer.toBlob(document_);
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The phone's share menu (WhatsApp, mail, Drive…); where it is missing the file is saved instead. */
export async function shareFile(blob: Blob, name: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'saved';
}

export async function shareText(n: ExportNote, plain: string): Promise<boolean> {
  const text = `${n.title}\n${n.meta}${n.tags.length ? `\n${n.tags.map((t) => `#${t}`).join(' ')}` : ''}\n\n${plain}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: n.title, text });
      return true;
    } catch {
      return false;
    }
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  return false;
}

// ---- One file with everything ----

interface Backup {
  app: 'the-logbook-appunti';
  version: 1;
  exportedAt: string;
  folders: NoteFolder[];
  tags: string[];
  notes: { date: ISODate; loose: boolean; m: StudyModule }[];
}

const extOf = (f: NoteFile) => f.name.match(/\.([a-z0-9]{2,4})$/i)?.[1]?.toLowerCase() ?? (f.kind === 'image' ? 'jpg' : f.kind === 'pdf' ? 'pdf' : 'webm');
const dataUrlBytes = (u: string) => Uint8Array.from(atob(u.split(',')[1] ?? ''), (c) => c.charCodeAt(0));

/** A .zip with appunti.json (to restore), the attachments and each note as a readable web page. */
export async function backupZip(rows: NoteRow[], folders: NoteFolder[], tags: string[], repo: Repo, onProgress?: (done: number, all: number) => void): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  const live = rows.filter((r) => !r.m.trashedAt);
  const all = live.reduce((n, r) => n + (r.m.attachments?.length ?? 0), 0);
  let done = 0;
  for (const r of live) {
    for (const f of r.m.attachments ?? []) {
      const u = await dataOf(repo, f);
      if (u) files[`allegati/${f.id}.${extOf(f)}`] = dataUrlBytes(u);
      onProgress?.(++done, all);
    }
    const n = exportable(r, folders);
    const depth = folderOfNote(folders, r.m) ? pathLabel(folders, folderOfNote(folders, r.m)).split(' › ').length : 0;
    const up = '../'.repeat(depth + 1);
    const box = document.createElement('div');
    box.innerHTML = sanitizeHtml(n.html);
    box.querySelectorAll<HTMLElement>('[data-att]').forEach((el) => {
      const f = n.files.find((x) => x.id === el.dataset.att);
      if (!f) return el.remove();
      const href = `${up}allegati/${f.id}.${extOf(f)}`;
      el.querySelector('img')?.setAttribute('src', href);
      el.querySelector('audio')?.setAttribute('src', href);
      if (f.kind === 'pdf') el.innerHTML = `<a href="${href}">📎 ${f.name}</a>`;
    });
    const page = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${n.title}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#1f2124}img{max-width:100%;border-radius:8px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}.meta{color:#6e7278}ul.n-check{list-style:none}ul.n-check li::before{content:'☐ '}ul.n-check li[data-done]::before{content:'☑ '}ul.n-check li[data-done]{text-decoration:line-through;color:#888}blockquote{border-left:3px solid #b9b0f5;margin-left:0;padding-left:1rem}</style></head><body><h1>${n.title}</h1><p class="meta">${n.meta}${n.tags.length ? `<br>${n.tags.map((t) => `#${t}`).join(' ')}` : ''}</p>${box.innerHTML}</body></html>`;
    const dir = ['Appunti', ...folderPath2(folders, r.m)].map((p) => p.replace(/[\\/:*?"<>|]+/g, ' ').trim()).join('/');
    let path = `${dir}/${fileName(`${n.title} (${r.date})`, 'html')}`;
    for (let k = 2; files[path]; k++) path = `${dir}/${fileName(`${n.title} (${r.date}) ${k}`, 'html')}`;
    files[path] = strToU8(page);
  }
  const data: Backup = { app: 'the-logbook-appunti', version: 1, exportedAt: new Date().toISOString(), folders, tags, notes: rows.filter((r) => !r.m.trashedAt).map(({ date, loose, m }) => ({ date, loose, m })) };
  files['appunti.json'] = strToU8(JSON.stringify(data));
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
const folderPath2 = (folders: NoteFolder[], m: StudyModule) => (folderOfNote(folders, m) ? pathLabel(folders, folderOfNote(folders, m)).split(' › ') : []);

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' };

/** Puts back the notes of a copy that are not in the logbook (notes already there are kept as they are). */
export async function restoreZip(
  file: File,
  ctx: { repo: Repo; settings: Settings; saveSettings: (s: Settings) => void; days: DayEntry[]; updateDay: (date: ISODate, fn: (d: DayEntry) => DayEntry) => Promise<void> },
): Promise<{ added: number; skipped: number }> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const raw = zip['appunti.json'];
  if (!raw) throw new Error('Questo file non è una copia degli appunti di The Logbook.');
  const data = JSON.parse(strFromU8(raw)) as Backup;
  if (data.app !== 'the-logbook-appunti') throw new Error('Questo file non è una copia degli appunti di The Logbook.');
  const known = new Set(ctx.days.flatMap((d) => [...d.modules.map((m) => m.id), ...(d.looseNotes ?? []).map((m) => m.id)]));
  const folders = [...(ctx.settings.noteFolders ?? data.folders)];
  for (const f of data.folders) if (!folders.some((x) => x.id === f.id)) folders.push(f);
  const tags = [...new Set([...(ctx.settings.noteTags ?? []), ...data.tags])];
  ctx.saveSettings({ ...ctx.settings, noteFolders: folders, noteTags: tags });
  let added = 0;
  let skipped = 0;
  for (const { date, loose, m } of data.notes) {
    if (known.has(m.id)) {
      skipped++;
      continue;
    }
    const attachments: NoteFile[] = [];
    for (const f of m.attachments ?? []) {
      const bytes = zip[`allegati/${f.id}.${extOf(f)}`];
      if (!bytes) continue;
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: MIME[extOf(f)] ?? 'application/octet-stream' });
      const { src, path } = await ctx.repo.uploadFile(f.id, blob);
      attachments.push({ ...f, src, path });
    }
    const note: StudyModule = { ...m, body: m.body ? sanitizeHtml(m.body) : m.body, attachments };
    await ctx.updateDay(date, (d) => (findNote(d, m.id) ? d : loose ? { ...d, looseNotes: [...(d.looseNotes ?? []), note] } : { ...d, modules: [...d.modules, note] }));
    added++;
  }
  return { added, skipped };
}
