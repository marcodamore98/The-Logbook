import { confirmDelete } from '../components/Confirm';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { mediaHtml, RichText, type InsertKind, type RichHandle } from '../components/notes/RichText';
import { FolderPicker, TagEditor, toneColor } from '../components/notes/NoteParts';
import { useNotes } from '../components/notes/useNotes';
import { Sym } from '../components/icons';
import type { SymName } from '../components/ms';
import { useUndo } from '../components/Undo';
import { VocabSelect } from '../components/ui';
import { DurationField } from '../components/WheelPicker';
import { fromISO, today } from '../lib/dates';
import { allTags, bodyOf, findNote, folderOfNote, folderPath, hasContent, noteReturn, plainOf, shortDate, suggestTags, type NoteRow } from '../lib/notes';
import { download, exportable, fileName, noteDocx, notePdf, shareFile, shareText } from '../lib/noteExport';
import { useStore } from '../lib/store/StoreContext';
import type { NoteFile, StudyModule } from '../lib/types';
import { labelOf, STUDY_TYPES } from '../lib/vocab';

const SESSION_TYPES = STUDY_TYPES.filter((t) => !['course', 'congress', 'webinar'].includes(t.id));
const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}′` : ''}` : `${min}′`);

/** One note, full page, like a page of Samsung Notes. */
export default function NotePage() {
  const { date = today(), id = '' } = useParams();
  const store = useStore();
  const nav = useNavigate();
  const notes = useNotes();
  const offerUndo = useUndo();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    store.loadRange(date, date).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  const row: NoteRow | null = findNote(store.day(date), id);
  const rowRef = useRef(row);
  rowRef.current = row;
  const editor = useRef<RichHandle>(null);
  const [reading, setReading] = useState(false);
  const [menu, setMenu] = useState<'insert' | 'more' | null>(null);
  const [sheet, setSheet] = useState<'folder' | 'session' | 'tags' | 'export' | null>(null);
  const [viewer, setViewer] = useState<{ url: string; remove: () => void } | null>(null);
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const asked = useRef(false);
  const back = () => nav(noteReturn() ?? '/archivio/appunti');

  const save = (fn: (m: StudyModule) => StudyModule) => notes.update({ date, m: { id } }, (m) => ({ ...fn(m), editedAt: Date.now() }));

  // Attachments taken out of the text in an earlier visit are deleted now.
  useEffect(() => {
    if (!row) return;
    const html = bodyOf(row.m);
    const gone = (row.m.attachments ?? []).filter((f) => !html.includes(`data-att="${f.id}"`));
    if (!gone.length || !row.m.body) return;
    gone.forEach((f) => store.repo.deleteFile(f.path));
    notes.update(row, (m) => ({ ...m, attachments: (m.attachments ?? []).filter((f) => !gone.some((g) => g.id === f.id)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // An empty free note left as it is does not stay in the archive.
  useEffect(
    () => () => {
      window.setTimeout(() => {
        const r = rowRef.current;
        if (r?.m.free && !r.m.title.trim() && !r.m.trashedAt)
          store.updateDay(date, (d) => {
            const now = findNote(d, id);
            if (!now || now.m.title.trim() || hasContent(now.m)) return d;
            return { ...d, looseNotes: (d.looseNotes ?? []).filter((x) => x.id !== id) };
          });
      }, 700);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const known = useMemo(() => allTags(notes.rows, store.settings).map((t) => t.tag), [notes.rows, store.settings]);
  if (!row)
    return (
      <div className="page note-page">
        <p className="muted">{loaded ? 'Questa nota non c’è più.' : 'Caricamento…'}</p>
        <button type="button" className="btn-ghost" onClick={back}>
          ‹ Torna agli appunti
        </button>
      </div>
    );

  const m = row.m;
  const folders = notes.folders;
  const folderId = folderOfNote(folders, m);
  const path = folderPath(folders, folderId);
  const suggestions = suggestTags(m, known, path.map((f) => f.name).join('\n'));
  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  };

  const finish = () => {
    editor.current?.flush();
    (document.activeElement as HTMLElement | null)?.blur();
    setFocused(false);
    if (!asked.current && suggestions.length && hasContent(m)) {
      asked.current = true;
      setSheet('tags');
    }
  };

  async function exportAs(kind: 'pdf' | 'docx' | 'share-pdf' | 'share-docx' | 'text' | 'print') {
    editor.current?.flush();
    setSheet(null);
    setMenu(null);
    const r = rowRef.current!;
    const n = exportable(r, folders);
    if (kind === 'print') return window.setTimeout(() => window.print(), 150);
    if (kind === 'text') {
      const ok = await shareText(n, plainOf(bodyOf(r.m)));
      if (!ok) flash('Testo copiato negli appunti del telefono');
      return;
    }
    flash(kind.includes('pdf') ? 'Preparo il PDF…' : 'Preparo il file Word…');
    try {
      const pdf = kind === 'pdf' || kind === 'share-pdf';
      const blob = pdf ? await notePdf(n, store.repo) : await noteDocx(n, store.repo);
      const name = fileName(n.title, pdf ? 'pdf' : 'docx');
      if (kind.startsWith('share')) {
        const how = await shareFile(blob, name, n.title);
        if (how === 'saved') flash(`${name} salvato nei download`);
      } else {
        download(blob, name);
        flash(`${name} salvato nei download`);
      }
    } catch (e) {
      flash(`Esportazione non riuscita: ${e instanceof Error ? e.message : e}`);
    }
  }

  const trash = async () => {
    setMenu(null);
    if (!(await confirmDelete('questa nota', { detail: 'Resta nel Cestino dell’Archivio per 30 giorni.' }))) return;
    editor.current?.flush();
    const r = rowRef.current!;
    void notes.trash(r).then(() => {
      offerUndo('Nota spostata nel Cestino', () => {
        const d = store.day(r.date);
        const now = findNote(d, r.m.id);
        if (now) void notes.restore(now);
      });
    });
    back();
  };

  const insert = (kind: InsertKind | 'record' | 'table') => {
    setMenu(null);
    if (kind === 'record') editor.current?.record();
    else if (kind === 'table') editor.current?.table();
    else editor.current?.insert(kind);
  };

  const INSERT: [InsertKind | 'record' | 'table', SymName, string][] = [
    ['pdf', 'picture_as_pdf', 'PDF'],
    ['record', 'mic', 'Registrazione vocale'],
    ['image', 'image', 'Immagine'],
    ['camera', 'photo_camera', 'Fotocamera'],
    ['scan', 'document_scanner', 'Scansione documenti'],
    ['audio', 'audio_file', 'File audio'],
    ['table', 'table', 'Tabella'],
  ];

  return (
    <div className={`page note-page${reading ? ' is-reading' : ''}`}>
      <header className="note-top no-print">
        <button type="button" className="icon-btn" aria-label="Indietro" onClick={back}>
          <Sym name="arrow_back" size={24} />
        </button>
        <span className="grow" />
        {focused && !reading ? (
          <button type="button" className="note-done" onPointerDown={(e) => e.preventDefault()} onClick={finish}>
            <Sym name="check" size={18} /> Fine
          </button>
        ) : null}
        <button type="button" className={`icon-btn${reading ? ' on' : ''}`} aria-label={reading ? 'Modifica' : 'Modalità lettura'} aria-pressed={reading} onClick={() => setReading(!reading)}>
          <Sym name={reading ? 'edit' : 'menu_book'} size={22} />
        </button>
        {!reading && (
          <button type="button" className="icon-btn" aria-label="Inserisci" onPointerDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === 'insert' ? null : 'insert')}>
            <Sym name="add" size={26} />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="Altre opzioni" onClick={() => setMenu(menu === 'more' ? null : 'more')}>
          <Sym name="more_vert" size={22} />
        </button>
      </header>

      <input className="note-title" value={m.title} placeholder="Titolo" readOnly={reading} onChange={(e) => save((x) => ({ ...x, title: e.target.value }))} aria-label="Titolo della nota" />

      <div className="note-meta no-print">
        <button type="button" className={`nm-star${m.favorite ? ' on' : ''}`} aria-label={m.favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} aria-pressed={!!m.favorite} onClick={() => save((x) => ({ ...x, favorite: !x.favorite }))}>
          <Sym name="star" fill={!!m.favorite} size={22} />
        </button>
        <span className="nm-sep" aria-hidden="true" />
        <button type="button" className="nm-folder" onClick={() => setSheet('folder')}>
          <span className="nm-dot" style={{ background: toneColor(path.at(-1)?.tone) }} aria-hidden="true" />
          <span className="nm-path">{path.length ? path.map((f) => f.name).join(' › ') : 'Nessuna cartella'}</span>
        </button>
        <button type="button" className={`nm-session${m.free ? ' free' : ''}`} onClick={() => setSheet('session')}>
          <Sym name={m.free ? 'link' : 'school'} size={16} />
          {m.free ? 'Collega a una giornata' : `${labelOf(STUDY_TYPES, m.type)} · ${dur(m.durationMin)} · ${fromISO(row.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`}
        </button>
      </div>
      <p className="print-only note-print-meta">{exportable(row, folders).meta}</p>

      <RichText
        key={id}
        ref={editor}
        initial={bodyOf(m)}
        files={m.attachments ?? []}
        readOnly={reading}
        onChange={(html) => save((x) => ({ ...x, body: html, notes: undefined }))}
        onFiles={(added: NoteFile[], append) => save((x) => ({ ...x, attachments: [...(x.attachments ?? []), ...added], body: append ? bodyOf(x) + added.map(mediaHtml).join('') : x.body ?? bodyOf(x) }))}
        onViewImage={(url, remove) => setViewer({ url, remove })}
      />
      <FocusWatch onChange={setFocused} />

      <section className="note-tags">
        <TagEditor tags={m.tags ?? []} known={known} suggestions={suggestions} onChange={(tags) => save((x) => ({ ...x, tags }))} />
      </section>
      <p className="note-stamp muted small no-print">
        {m.editedAt ? `Modificata ${shortDate(m.editedAt)}` : ''}
        {m.createdAt ? ` · creata ${shortDate(m.createdAt)}` : ''}
      </p>

      {menu &&
        createPortal(
          <div className="sheet-backdrop pop-backdrop" onClick={() => setMenu(null)}>
            <div className="pop-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              {menu === 'insert' &&
                INSERT.map(([k, icon, label], i) => (
                  <button key={k} type="button" role="menuitem" className={i === 2 ? 'pm-sep' : ''} onPointerDown={(e) => e.preventDefault()} onClick={() => insert(k)}>
                    <Sym name={icon} size={22} /> {label}
                  </button>
                ))}
              {menu === 'more' && (
                <>
                  <button type="button" role="menuitem" onClick={() => (setMenu(null), setSheet('tags'))}>
                    <Sym name="sell" size={22} /> Aggiungi tag
                  </button>
                  <button type="button" role="menuitem" onClick={() => (setMenu(null), setSheet('folder'))}>
                    <Sym name="drive_file_move" size={22} /> Sposta in una cartella
                  </button>
                  <button type="button" role="menuitem" onClick={() => (setMenu(null), setSheet('session'))}>
                    <Sym name={m.free ? 'link' : 'school'} size={22} /> {m.free ? 'Collega a una giornata' : 'Sessione di studio'}
                  </button>
                  <button type="button" role="menuitem" className="pm-sep" onClick={() => (setMenu(null), setSheet('export'))}>
                    <Sym name="ios_share" size={22} /> Salva o condividi
                  </button>
                  <button type="button" role="menuitem" onClick={() => exportAs('print')}>
                    <Sym name="print" size={22} /> Stampa
                  </button>
                  <div className="pm-icons pm-sep">
                    <button type="button" aria-label={m.favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} aria-pressed={!!m.favorite} onClick={() => save((x) => ({ ...x, favorite: !x.favorite }))}>
                      <Sym name="star" fill={!!m.favorite} size={24} />
                    </button>
                    <button type="button" aria-label="Sposta nel Cestino" className="danger" onClick={trash}>
                      <Sym name="delete" size={24} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {sheet === 'folder' && (
        <FolderPicker
          selected={folderId}
          onPick={(fid) => {
            notes.move([row], fid);
            flash(fid ? `Spostata in ${folderPath(folders, fid).at(-1)?.name}` : 'Tolta dalle cartelle');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'session' && <SessionSheet row={row} onClose={() => setSheet(null)} onLink={(d) => nav(`/appunti/${d}/${id}`, { replace: true })} />}
      {sheet === 'tags' &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet tag-sheet" role="dialog" aria-label="Tag della nota" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <h2>Tag per questa nota</h2>
                <button type="button" className="icon-btn" aria-label="Chiudi" onClick={() => setSheet(null)}>
                  <Sym name="close" size={20} />
                </button>
              </div>
              <p className="muted small">Con i tag ritrovi la nota anche per argomento, oltre che nella sua cartella.</p>
              <TagEditor tags={m.tags ?? []} known={known} suggestions={suggestions} onChange={(tags) => save((x) => ({ ...x, tags }))} open />
              <button type="button" className="btn tag-sheet-done" onClick={() => setSheet(null)}>
                Fatto
              </button>
            </div>
          </div>,
          document.body,
        )}
      {sheet === 'export' &&
        createPortal(
          <div className="sheet-backdrop" onClick={() => setSheet(null)}>
            <div className="sheet export-sheet" role="dialog" aria-label="Salva o condividi" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <h2>Salva o condividi</h2>
                <button type="button" className="icon-btn" aria-label="Chiudi" onClick={() => setSheet(null)}>
                  <Sym name="close" size={20} />
                </button>
              </div>
              <div className="export-grid">
                <button type="button" onClick={() => exportAs('share-pdf')}>
                  <span className="ex-ico pdf">PDF</span>
                  <strong>Condividi PDF</strong>
                  <span>WhatsApp, mail, Drive…</span>
                </button>
                <button type="button" onClick={() => exportAs('share-docx')}>
                  <span className="ex-ico doc">W</span>
                  <strong>Condividi Word</strong>
                  <span>File .docx modificabile</span>
                </button>
                <button type="button" onClick={() => exportAs('pdf')}>
                  <Sym name="download" size={22} />
                  <strong>Salva PDF</strong>
                  <span>Nei download del telefono</span>
                </button>
                <button type="button" onClick={() => exportAs('docx')}>
                  <Sym name="download" size={22} />
                  <strong>Salva Word</strong>
                  <span>Nei download del telefono</span>
                </button>
                <button type="button" onClick={() => exportAs('text')}>
                  <Sym name="share" size={22} />
                  <strong>Condividi il testo</strong>
                  <span>Solo il testo, senza allegati</span>
                </button>
                <button type="button" onClick={() => exportAs('print')}>
                  <Sym name="print" size={22} />
                  <strong>Stampa</strong>
                  <span>O “Salva come PDF” con l’impaginazione esatta</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {viewer &&
        createPortal(
          <div className="sheet-backdrop img-viewer" onClick={() => setViewer(null)}>
            <img src={viewer.url} alt="" onClick={(e) => e.stopPropagation()} />
            <div className="iv-bar" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn-ghost danger"
                onClick={async () => {
                  if (!(await confirmDelete('questa immagine dalla nota'))) return;
                  viewer.remove();
                  setViewer(null);
                }}
              >
                <Sym name="delete" size={18} /> Togli dalla nota
              </button>
              <button type="button" className="btn" onClick={() => setViewer(null)}>
                Chiudi
              </button>
            </div>
          </div>,
          document.body,
        )}
      {toast && (
        <div className="snackbar note-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Tells the page whether the text is being written (to show "Fine"). */
function FocusWatch({ onChange }: { onChange: (on: boolean) => void }) {
  useEffect(() => {
    const check = () => onChange(!!document.activeElement?.closest('.note-body, .note-title'));
    const later = () => window.setTimeout(check, 0);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', later);
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', later);
    };
  }, [onChange]);
  return null;
}

/** Type, length and day of the study session; a free note can become a session of a day. */
function SessionSheet({ row, onClose, onLink }: { row: NoteRow; onClose: () => void; onLink: (date: string) => void }) {
  const notes = useNotes();
  const nav = useNavigate();
  const m = row.m;
  const [date, setDate] = useState(m.free ? today() : row.date);
  const [type, setType] = useState(m.free ? 'lesson' : m.type);
  const [min, setMin] = useState(m.free ? 60 : m.durationMin);
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet session-sheet" role="dialog" aria-label="Sessione di studio" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{m.free ? 'Collega a una giornata' : 'Sessione di studio'}</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={20} />
          </button>
        </div>
        {m.free && <p className="muted small">La nota diventa una sessione di studio di quel giorno e conta nelle statistiche dello studio.</p>}
        <label className="field">
          <span className="field-label">Giorno</span>
          {m.free ? <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /> : <span className="ss-day">{fromISO(row.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>}
        </label>
        <label className="field">
          <span className="field-label">Tipo</span>
          <VocabSelect items={SESSION_TYPES} value={type} onChange={(t) => (setType(t), !m.free && notes.update(row, (x) => ({ ...x, type: t })))} />
        </label>
        <div className="field">
          <span className="field-label">Durata</span>
          <DurationField unit="min" label="Durata dello studio" value={min} onChange={(n) => (setMin(n), !m.free && notes.update(row, (x) => ({ ...x, durationMin: n })))} />
        </div>
        <div className="sheet-foot">
          {m.free ? (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const d = await notes.link(row, date, type, min);
                onClose();
                onLink(d);
              }}
            >
              Collega
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => nav(`/giorno/${row.date}`)}>
              Vai alla pagina del giorno ›
            </button>
          )}
          {!m.free && (
            <button type="button" className="btn" onClick={onClose}>
              Fatto
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
