import { confirmDelete } from '../components/Confirm';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FolderPicker, toneColor, TONE_NAMES, useAddFolder } from '../components/notes/NoteParts';
import { useNotes } from '../components/notes/useNotes';
import { IconStudy, Sym } from '../components/icons';
import { SwipeDelete } from '../components/SwipeDelete';
import { useUndo } from '../components/Undo';
import { DragGrip } from '../components/ui';
import { useSortableList } from '../components/useBlockDrag';
import { CertArchive, useCourses } from './CoursesPage';
import {
  allFoldersOf,
  allTags,
  bodyOf,
  childrenOf,
  createdOf,
  editedOf,
  folderOfNote,
  folderPath,
  liveFolder,
  NOTE_TONES,
  noteTitle,
  periodOf,
  plainOf,
  rememberFolders,
  setNoteReturn,
  shortDate,
  subtree,
  TRASH_DAYS,
  type NoteRow,
} from '../lib/notes';
import { backupZip, download, restoreZip } from '../lib/noteExport';
import { useStore } from '../lib/store/StoreContext';
import type { NoteFile, NoteFolder } from '../lib/types';

/** Archivio: the study notes (folders, tags, favourites, Cestino) and the certificates of courses. */
export default function ArchivePage() {
  const { tab = 'appunti', folder } = useParams();
  const courses = useCourses();
  return (
    <div className="page archive2">
      <header className="page-head">
        <IconStudy size={44} />
        <div className="page-title">
          <h1>Archivio</h1>
          <span className="page-sub">Appunti di studio, corsi e attestati</span>
        </div>
      </header>
      <div className="arch-tabs" role="tablist">
        <Link role="tab" aria-selected={tab !== 'corsi'} className={tab !== 'corsi' ? 'on' : ''} to="/archivio/appunti" replace>
          <Sym name="edit_note" size={20} /> Appunti
        </Link>
        <Link role="tab" aria-selected={tab === 'corsi'} className={tab === 'corsi' ? 'on' : ''} to="/archivio/corsi" replace>
          <Sym name="workspace_premium" size={20} /> Corsi e attestati
        </Link>
      </div>
      {tab === 'corsi' ? <CertArchive rows={courses} /> : <NotesArchive folder={folder} />}
    </div>
  );
}

type Scope = 'all' | 'fav' | 'tags' | 'trash';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const daysLeft = (ts: number) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - ts) / 86_400_000));

function NotesArchive({ folder }: { folder?: string }) {
  const notes = useNotes();
  const store = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const offerUndo = useUndo();
  const all = allFoldersOf(store.settings);
  rememberFolders(all);
  const view = store.settings.notesView ?? {};
  const layout = view.layout ?? 'grid';
  const sort = view.sort ?? 'edited';
  const favTop = view.favTop ?? true;
  const setView = (p: typeof view) => store.saveSettings({ ...store.settings, notesView: { ...view, ...p } });
  const [scope, setScope] = useState<Scope>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'manage' | 'move' | 'new' | { edit: NoteFolder } | { bin: NoteRow }>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const goneRef = useRef(gone);
  goneRef.current = gone;
  const [toast, setToast] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);
  const current = folder ? liveFolder(all, folder) : undefined;
  useEffect(() => {
    if (folder) setScope('all');
  }, [folder]);

  const flash = (t: string, ms = 2800) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), ms);
  };

  const live = notes.rows.filter((r) => !r.m.trashedAt && !gone.has(r.m.id));
  const trashed = notes.rows.filter((r) => r.m.trashedAt && !gone.has(r.m.id));
  const tags = allTags(notes.rows, store.settings);

  // Notes per folder, counting those in subfolders too.
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of live) for (const f of folderPath(all, folderOfNote(all, r.m))) c.set(f.id, (c.get(f.id) ?? 0) + 1);
    return c;
  }, [live, all]);

  const qn = norm(q.trim());
  let list: NoteRow[];
  if (qn) {
    list = live.filter((r) => {
      const hay = norm(`${noteTitle(r)} ${(r.m.tags ?? []).join(' ')} ${folderPath(all, folderOfNote(all, r.m)).map((f) => f.name).join(' ')} ${plainOf(bodyOf(r.m))} ${(r.m.attachments ?? []).map((a) => a.name).join(' ')}`);
      return qn.split(/\s+/).every((w) => hay.includes(w));
    });
  } else if (scope === 'trash') list = trashed;
  else if (scope === 'fav') list = live.filter((r) => r.m.favorite);
  else if (scope === 'tags') list = tag ? live.filter((r) => r.m.tags?.some((t) => t === tag)) : [];
  else if (current) list = live.filter((r) => folderOfNote(all, r.m) === current);
  else list = live;

  const key = (r: NoteRow) => (sort === 'created' ? createdOf(r) : editedOf(r));
  list = [...list].sort((a, b) => (sort === 'title' ? noteTitle(a).localeCompare(noteTitle(b), 'it') : key(b) - key(a)));
  const groups: [string, NoteRow[]][] = [];
  const push = (label: string, r: NoteRow) => {
    const g = groups.find(([l]) => l === label);
    if (g) g[1].push(r);
    else groups.push([label, [r]]);
  };
  for (const r of list) {
    if (scope === 'trash' && !qn) push('Nel Cestino', r);
    else if (favTop && scope !== 'fav' && r.m.favorite) push('Preferiti', r);
    else push(sort === 'title' ? 'Dalla A alla Z' : periodOf(key(r)), r);
  }
  if (favTop) groups.sort((a, b) => (a[0] === 'Preferiti' ? -1 : b[0] === 'Preferiti' ? 1 : 0));

  const open = (r: NoteRow) => {
    setNoteReturn(loc.pathname);
    nav(`/appunti/${r.date}/${r.m.id}`);
  };
  const newNote = async () => {
    const { date, id } = await notes.create(current);
    setNoteReturn(loc.pathname);
    nav(`/appunti/${date}/${id}`);
  };
  const toTrash = (rs: NoteRow[]) => {
    rs.forEach((r) => void notes.trash(r));
    offerUndo(rs.length === 1 ? 'Nota spostata nel Cestino' : `${rs.length} note spostate nel Cestino`, () =>
      rs.forEach((r) => {
        const now = notes.find(store.day(r.date), r.m.id);
        if (now) void notes.restore(now);
      }),
    );
  };
  /** Deleted for good after the "Annulla" chance; attachments go with them. */
  const forever = (rs: NoteRow[]) => {
    const ids = rs.map((r) => r.m.id);
    setGone((g) => new Set([...g, ...ids]));
    offerUndo(rs.length === 1 ? 'Nota eliminata' : `${rs.length} note eliminate`, () => setGone((g) => new Set([...g].filter((x) => !ids.includes(x)))));
    window.setTimeout(() => rs.forEach((r) => goneRef.current.has(r.m.id) && void notes.destroy(r)), 5600);
  };
  const selected = list.filter((r) => sel?.has(r.m.id));
  const toggle = (r: NoteRow) =>
    setSel((s) => {
      const n = new Set(s ?? []);
      if (n.has(r.m.id)) n.delete(r.m.id);
      else n.add(r.m.id);
      return n.size ? n : null;
    });

  const path = folderPath(all, current);
  const tiles = !qn && scope === 'all' ? childrenOf(all, current) : [];

  async function backup(rs: NoteRow[]) {
    setMenu(false);
    flash('Preparo la copia degli appunti…', 60_000);
    try {
      const blob = await backupZip(rs, all, tags.map((t) => t.tag), store.repo, (d, n) => setToast(`Preparo la copia… allegati ${d}/${n}`));
      download(blob, `Appunti The Logbook ${new Date().toISOString().slice(0, 10)}.zip`);
      flash(`Copia salvata nei download (${rs.length} note)`);
    } catch (e) {
      flash(`Copia non riuscita: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <div className="notes-arch">
      <div className="na-search">
        <span className="icon-input">
          <Sym name="search" size={18} />
          <input type="search" value={q} placeholder="Cerca negli appunti, nei tag, nelle cartelle…" onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        </span>
        <button type="button" className="icon-btn" aria-label="Altre opzioni" onClick={() => setMenu(true)}>
          <Sym name="more_vert" size={22} />
        </button>
      </div>

      {!qn && (
        <div className="na-scopes chips scroll-x" role="tablist">
          {(
            [
              ['all', 'edit_note', 'Tutte le note', live.length],
              ['fav', 'star', 'Preferiti', live.filter((r) => r.m.favorite).length],
              ['tags', 'sell', 'Tag', tags.length],
              ['trash', 'delete', 'Cestino', trashed.length],
            ] as const
          ).map(([s, icon, label, n]) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s && !(s === 'all' && current)}
              className={`chip${scope === s && !(s === 'all' && current) ? ' chip-on' : ''}`}
              onClick={() => {
                setScope(s);
                setSel(null);
                if (folder) nav('/archivio/appunti', { replace: true });
              }}
            >
              <Sym name={icon} size={16} fill={s === 'fav'} /> {label} <small>{n}</small>
            </button>
          ))}
        </div>
      )}

      {current && !qn && (
        <nav className="na-crumbs" aria-label="Percorso">
          <Link to="/archivio/appunti" replace aria-label="Tutte le cartelle">
            <Sym name="home" size={20} />
          </Link>
          {path.map((f, i) => (
            <span key={f.id} className="crumb">
              <Sym name="chevron_right" size={18} />
              {i === path.length - 1 ? (
                <strong>
                  <span className="crumb-dot" style={{ background: toneColor(f.tone) }} /> {f.name}
                </strong>
              ) : (
                <Link to={`/archivio/appunti/${f.id}`} replace>
                  {f.name}
                </Link>
              )}
            </span>
          ))}
          <button type="button" className="icon-btn small" aria-label="Modifica la cartella" onClick={() => setSheet({ edit: path.at(-1)! })}>
            <Sym name="edit" size={18} />
          </button>
        </nav>
      )}

      {scope === 'all' && !qn && (
        <div className="folder-tiles">
          {tiles.map((f) => (
            <FolderTile key={f.id} f={f} n={counts.get(f.id) ?? 0} onOpen={() => nav(`/archivio/appunti/${f.id}`, { replace: !!current })} onHold={() => setSheet({ edit: f })} />
          ))}
          <button type="button" className="folder-tile new" onClick={() => setSheet('new')}>
            <Sym name="create_new_folder" size={20} />
            <span className="ft-name">{current ? 'Sottocartella' : 'Nuova cartella'}</span>
          </button>
        </div>
      )}

      {scope === 'tags' && !qn && (
        <div className="tag-cloud">
          {tags.length === 0 && <p className="muted small">Ancora nessun tag: aggiungili dal fondo di una nota, anche tra quelli suggeriti.</p>}
          {tags.map(({ tag: t, n }) => (
            <button key={t} type="button" className={`tag-pill${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t} <small>{n}</small>
            </button>
          ))}
        </div>
      )}

      {scope === 'trash' && !qn && (
        <p className="na-trash-info">
          Il Cestino mostra le note eliminate. Restano qui {TRASH_DAYS} giorni, poi vengono eliminate definitivamente con i loro allegati.
          {trashed.length > 0 && (
            <button type="button" className="btn-ghost small danger" onClick={async () => (await confirmDelete(`definitivamente ${trashed.length === 1 ? 'la nota' : `le ${trashed.length} note`} del Cestino`, { detail: 'Con i loro allegati: non si potranno più recuperare.' })) && forever(trashed)}>
              Svuota il Cestino
            </button>
          )}
        </p>
      )}

      {list.length === 0 && (
        <p className="na-empty">
          {qn
            ? `Nessuna nota trovata per “${q.trim()}”.`
            : scope === 'trash'
              ? 'Il Cestino è vuoto.'
              : scope === 'fav'
                ? 'Nessuna nota preferita: tocca la stella in una nota.'
                : scope === 'tags'
                  ? tags.length
                    ? 'Scegli un tag per vedere le sue note.'
                    : ''
                  : current
                    ? 'Nessuna nota in questa cartella. Tocca la matita per scriverne una.'
                    : 'Ancora nessun appunto. Ogni sessione di studio della giornata diventa una nota; puoi anche scriverne una qui con la matita.'}
        </p>
      )}

      {groups.map(([label, rs]) => (
        <section key={label} className="na-group">
          <h2 className="na-period">{label}</h2>
          {layout === 'grid' ? (
            <div className="note-grid">
              {rs.map((r) => (
                <NoteCard
                  key={r.m.id}
                  r={r}
                  all={all}
                  selecting={!!sel}
                  selected={!!sel?.has(r.m.id)}
                  onOpen={() => (sel ? toggle(r) : r.m.trashedAt ? setSheet({ bin: r }) : open(r))}
                  onHold={() => toggle(r)}
                />
              ))}
            </div>
          ) : (
            <ul className="note-list">
              {rs.map((r) => (
                <li key={r.m.id}>
                  <SwipeDelete what={r.m.trashedAt ? 'definitivamente questa nota' : 'questa nota'} onDelete={() => (r.m.trashedAt ? forever([r]) : toTrash([r]))}>
                    <NoteRowItem
                      r={r}
                      all={all}
                      selecting={!!sel}
                      selected={!!sel?.has(r.m.id)}
                      onOpen={() => (sel ? toggle(r) : r.m.trashedAt ? setSheet({ bin: r }) : open(r))}
                      onHold={() => toggle(r)}
                    />
                  </SwipeDelete>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {sel ? (
        <div className="select-bar" role="toolbar" aria-label="Note selezionate">
          <button className="icon-btn" aria-label="Annulla la selezione" onClick={() => setSel(null)}>
            <Sym name="close" size={22} />
          </button>
          <strong>{selected.length === 1 ? '1 selezionata' : `${selected.length} selezionate`}</strong>
          <button type="button" className="link-quiet" onClick={() => setSel(new Set(list.map((r) => r.m.id)))}>
            Tutte
          </button>
          {scope === 'trash' && !qn ? (
            <>
              <button type="button" className="sb-btn" onClick={() => (selected.forEach((r) => void notes.restore(r)), setSel(null))}>
                <Sym name="restore_from_trash" size={20} /> Ripristina
              </button>
              <button type="button" className="sb-btn danger" onClick={async () => { if (!(await confirmDelete(`definitivamente ${selected.length === 1 ? 'la nota selezionata' : `le ${selected.length} note selezionate`}`))) return; forever(selected); setSel(null); }}>
                <Sym name="delete_forever" size={20} />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="icon-btn" aria-label="Sposta in una cartella" onClick={() => setSheet('move')}>
                <Sym name="drive_file_move" size={22} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Preferiti"
                onClick={() => {
                  const on = !selected.every((r) => r.m.favorite);
                  selected.forEach((r) => void notes.update(r, (m) => ({ ...m, favorite: on })));
                }}
              >
                <Sym name="star" size={22} />
              </button>
              <button type="button" className="icon-btn" aria-label="Copia delle note selezionate" onClick={() => backup(selected)}>
                <Sym name="download" size={22} />
              </button>
              <button type="button" className="icon-btn danger" aria-label="Sposta nel Cestino" onClick={async () => { if (!(await confirmDelete(selected.length === 1 ? 'la nota selezionata' : `le ${selected.length} note selezionate`, { detail: 'Restano nel Cestino per 30 giorni.' }))) return; toTrash(selected); setSel(null); }}>
                <Sym name="delete" size={22} />
              </button>
            </>
          )}
        </div>
      ) : (
        scope !== 'trash' && (
          <button type="button" className="fab note-fab" aria-label="Nuova nota" onClick={newNote}>
            <Sym name="edit" size={26} />
          </button>
        )
      )}

      <input ref={restoreInput} type="file" accept=".zip,application/zip" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        flash('Ripristino la copia…', 60_000);
        try {
          const { added, skipped } = await restoreZip(f, { repo: store.repo, settings: store.settings, saveSettings: store.saveSettings, days: store.allDays, updateDay: store.updateDay });
          flash(`${added === 1 ? '1 nota ripristinata' : `${added} note ripristinate`}${skipped ? ` · ${skipped} già presenti` : ''}`, 4000);
        } catch (err) {
          flash(err instanceof Error ? err.message : String(err), 4000);
        }
      }} />

      {menu &&
        createPortal(
          <div className="sheet-backdrop pop-backdrop" onClick={() => setMenu(false)}>
            <div className="pop-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" role="menuitem" onClick={() => (setMenu(false), setSel(new Set()))} disabled={!list.length}>
                <Sym name="select_check_box" size={22} /> Seleziona
              </button>
              <div className="pm-label pm-sep">Vedi</div>
              <MenuCheck on={layout === 'grid'} icon="grid_view" label="Griglia" run={() => setView({ layout: 'grid' })} />
              <MenuCheck on={layout === 'list'} icon="view_list" label="Elenco (scorri per eliminare)" run={() => setView({ layout: 'list' })} />
              <div className="pm-label pm-sep">Ordina per</div>
              <MenuCheck on={sort === 'edited'} icon="sort" label="Ultima modifica" run={() => setView({ sort: 'edited' })} />
              <MenuCheck on={sort === 'created'} icon="sort" label="Data di creazione" run={() => setView({ sort: 'created' })} />
              <MenuCheck on={sort === 'title'} icon="sort" label="Titolo" run={() => setView({ sort: 'title' })} />
              <MenuCheck on={favTop} icon="star" label="Blocca preferiti in alto" run={() => setView({ favTop: !favTop })} className="pm-sep" />
              <button type="button" role="menuitem" className="pm-sep" onClick={() => (setMenu(false), setSheet('manage'))}>
                <Sym name="folder_open" size={22} /> Gestisci cartelle
              </button>
              <button type="button" role="menuitem" onClick={() => backup(live)}>
                <Sym name="download" size={22} /> Copia di tutti gli appunti
              </button>
              <button type="button" role="menuitem" onClick={() => (setMenu(false), restoreInput.current?.click())}>
                <Sym name="upload" size={22} /> Ripristina da una copia
              </button>
            </div>
          </div>,
          document.body,
        )}

      {sheet === 'move' && (
        <FolderPicker
          onPick={(id) => {
            notes.move(selected, id);
            setSel(null);
            flash(id ? `Spostate in ${folderPath(all, id).at(-1)?.name}` : 'Tolte dalle cartelle');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'new' && <NewFolderSheet parentId={current} onClose={() => setSheet(null)} />}
      {sheet === 'manage' && <FolderManager start={current} counts={counts} onClose={() => setSheet(null)} onEdit={(f) => setSheet({ edit: f })} />}
      {sheet && typeof sheet === 'object' && 'edit' in sheet && (
        <FolderSheet
          f={sheet.edit}
          onClose={() => setSheet(null)}
          onDeleted={(f) => {
            if (current && subtree(all, f.id).has(current)) nav(f.parentId ? `/archivio/appunti/${f.parentId}` : '/archivio/appunti', { replace: true });
          }}
        />
      )}
      {sheet && typeof sheet === 'object' && 'bin' in sheet && (
        <Sheet title={noteTitle(sheet.bin)} onClose={() => setSheet(null)}>
          <p className="muted small">Nel Cestino · eliminata definitivamente tra {daysLeft(sheet.bin.m.trashedAt!)} giorni.</p>
          <div className="sheet-foot">
            <button type="button" className="btn-ghost danger" onClick={async () => { if (!(await confirmDelete('definitivamente questa nota'))) return; forever([sheet.bin]); setSheet(null); }}>
              Elimina definitivamente
            </button>
            <button type="button" className="btn" onClick={() => (void notes.restore(sheet.bin), setSheet(null), flash('Nota ripristinata'))}>
              Ripristina
            </button>
          </div>
        </Sheet>
      )}
      {toast && (
        <div className="snackbar note-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function MenuCheck({ on, icon, label, run, className }: { on: boolean; icon: Parameters<typeof Sym>[0]['name']; label: string; run: () => void; className?: string }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} className={`${className ?? ''}${on ? ' on' : ''}`} onClick={run}>
      <Sym name={icon} size={22} /> {label}
      <span className="pm-check" aria-hidden="true">{on ? <Sym name="check" size={18} /> : null}</span>
    </button>
  );
}

export function Sheet({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet${className ? ` ${className}` : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Chiudi" onClick={onClose}>
            <Sym name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Long press (selection) without losing the tap. */
function useHold(onHold: () => void) {
  const t = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  return {
    onPointerDown: (e: RPointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      t.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(15);
        onHold();
      }, 480);
    },
    onPointerMove: (e: RPointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) window.clearTimeout(t.current);
    },
    onPointerUp: () => window.clearTimeout(t.current),
    onPointerCancel: () => window.clearTimeout(t.current),
    onContextMenu: (e: RMouseEvent) => e.preventDefault(),
    /** True when the tap was the end of a long press. */
    held: () => fired.current,
  };
}

function FolderTile({ f, n, onOpen, onHold }: { f: NoteFolder; n: number; onOpen: () => void; onHold: () => void }) {
  const { held, ...hold } = useHold(onHold);
  return (
    <button type="button" className="folder-tile" style={{ '--tile': toneColor(f.tone) } as CSSProperties} {...hold} onClick={() => !held() && onOpen()}>
      <Sym name="folder" fill size={22} className="ft-ico" />
      <span className="ft-name">{f.name}</span>
      <span className="ft-count">{n}</span>
    </button>
  );
}

/** First image of the note, else the beginning of its text. */
function Preview({ r }: { r: NoteRow }) {
  const { repo } = useStore();
  const html = bodyOf(r.m);
  const img: NoteFile | undefined = (r.m.attachments ?? []).find((a) => a.kind === 'image' && html.includes(`data-att="${a.id}"`));
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    if (img) repo.resolveFile(img.src).then((u) => alive && setUrl(u)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [repo, img?.src]);
  const text = plainOf(html).slice(0, 260);
  const pdf = (r.m.attachments ?? []).some((a) => a.kind === 'pdf');
  if (img && url) return <img className="nc-img" src={url} alt="" />;
  if (text) return <span className="nc-text">{text}</span>;
  if (pdf) return <span className="nc-pdf">PDF</span>;
  return <span className="nc-text muted">Nota vuota</span>;
}

function Badges({ r }: { r: NoteRow }) {
  const att = r.m.attachments ?? [];
  return (
    <span className="nc-badges">
      {r.m.favorite && <Sym name="star" fill size={16} className="b-star" />}
      {att.some((a) => a.kind === 'audio') && <Sym name="mic" size={16} />}
      {att.some((a) => a.kind === 'pdf') && <Sym name="picture_as_pdf" size={16} />}
      {!r.m.free && <Sym name="school" size={16} />}
    </span>
  );
}

function NoteCard({ r, all, selecting, selected, onOpen, onHold }: { r: NoteRow; all: NoteFolder[]; selecting: boolean; selected: boolean; onOpen: () => void; onHold: () => void }) {
  const { held, ...hold } = useHold(onHold);
  const f = folderPath(all, folderOfNote(all, r.m)).at(-1);
  return (
    <button type="button" className={`note-card${selected ? ' selected' : ''}`} {...hold} onClick={() => !held() && onOpen()} aria-pressed={selecting ? selected : undefined}>
      <span className="nc-prev">
        <Preview r={r} />
        {r.m.trashedAt ? <span className="nc-left">{daysLeft(r.m.trashedAt)} giorni</span> : <Badges r={r} />}
        {selecting && <span className={`nc-check${selected ? ' on' : ''}`} aria-hidden="true">{selected && <Sym name="check" size={16} />}</span>}
      </span>
      <span className="nc-title">{noteTitle(r)}</span>
      <span className="nc-date">
        {f && <i className="nc-dot" style={{ background: toneColor(f.tone) }} />}
        {shortDate(editedOf(r))}
      </span>
    </button>
  );
}

function NoteRowItem({ r, all, selecting, selected, onOpen, onHold }: { r: NoteRow; all: NoteFolder[]; selecting: boolean; selected: boolean; onOpen: () => void; onHold: () => void }) {
  const { held, ...hold } = useHold(onHold);
  const f = folderPath(all, folderOfNote(all, r.m)).at(-1);
  return (
    <button type="button" className={`note-row${selected ? ' selected' : ''}`} {...hold} onClick={() => !held() && onOpen()}>
      {selecting && <span className={`nc-check inline${selected ? ' on' : ''}`} aria-hidden="true">{selected && <Sym name="check" size={16} />}</span>}
      <span className="nr-prev">
        <Preview r={r} />
      </span>
      <span className="nr-text">
        <strong>{noteTitle(r)}</strong>
        <span className="nr-sub">{plainOf(bodyOf(r.m)).slice(0, 90) || ' '}</span>
        <span className="nr-meta">
          {f && <i className="nc-dot" style={{ background: toneColor(f.tone) }} />}
          {f ? `${f.name} · ` : ''}
          {r.m.trashedAt ? `${daysLeft(r.m.trashedAt)} giorni nel Cestino` : shortDate(editedOf(r))}
          {(r.m.tags ?? []).slice(0, 3).map((t) => (
            <span key={t} className="nr-tag">#{t}</span>
          ))}
        </span>
      </span>
      {!r.m.trashedAt && <Badges r={r} />}
    </button>
  );
}

function ToneSwatches({ value, onChange }: { value?: string; onChange: (t: string) => void }) {
  return (
    <div className="tone-swatches" role="radiogroup" aria-label="Colore">
      {NOTE_TONES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={value === t} aria-label={TONE_NAMES[t]} className={value === t ? 'on' : ''} style={{ background: toneColor(t) }} onClick={() => onChange(t)}>
          {value === t && <Sym name="check" size={16} />}
        </button>
      ))}
    </div>
  );
}

function NewFolderSheet({ parentId, onClose }: { parentId?: string; onClose: () => void }) {
  const store = useStore();
  const add = useAddFolder();
  const all = allFoldersOf(store.settings);
  const [name, setName] = useState('');
  const [tone, setTone] = useState<string>(NOTE_TONES[all.filter((f) => !f.deleted).length % NOTE_TONES.length]);
  const parent = folderPath(all, parentId).at(-1);
  const create = () => {
    add(name, parentId, tone);
    onClose();
  };
  return (
    <Sheet title={parent ? `Sottocartella di ${parent.name}` : 'Nuova cartella'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create();
        }}
      >
        <label className="field">
          <span className="field-label">Nome</span>
          <input autoFocus value={name} placeholder="es. Statica pelvica" onChange={(e) => setName(e.target.value)} />
        </label>
        <span className="field-label">Colore</span>
        <ToneSwatches value={tone} onChange={setTone} />
        <div className="sheet-foot">
          <span />
          <button type="submit" className="btn" disabled={!name.trim()}>
            Crea
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** Rename, colour, move or delete a folder (its notes and subfolders go to the folder above). */
function FolderSheet({ f, onClose, onDeleted }: { f: NoteFolder; onClose: () => void; onDeleted: (f: NoteFolder) => void }) {
  const store = useStore();
  const offerUndo = useUndo();
  const all = allFoldersOf(store.settings);
  const [moving, setMoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const set = (p: Partial<NoteFolder>) => store.saveSettings({ ...store.settings, noteFolders: all.map((x) => (x.id === f.id ? { ...x, ...p } : x)) });
  const me = all.find((x) => x.id === f.id) ?? f;
  const parent = folderPath(all, me.parentId).at(-1);
  if (adding) return <NewFolderSheet parentId={f.id} onClose={onClose} />;
  return (
    <Sheet title="Cartella" onClose={onClose}>
      <label className="field">
        <span className="field-label">Nome</span>
        <input value={me.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <span className="field-label">Colore</span>
      <ToneSwatches value={me.tone} onChange={(tone) => set({ tone })} />
      <button type="button" className="fs-row" onClick={() => setMoving(true)}>
        <Sym name="drive_file_move" size={22} />
        <span>
          <strong>Sposta in</strong>
          <small>{parent ? folderPath(all, parent.id).map((x) => x.name).join(' › ') : 'Prima pagina dell’archivio'}</small>
        </span>
      </button>
      <button type="button" className="fs-row" onClick={() => setAdding(true)}>
        <Sym name="create_new_folder" size={22} />
        <span>
          <strong>Nuova sottocartella</strong>
        </span>
      </button>
      <button
        type="button"
        className="fs-row danger"
        onClick={async () => {
          if (!(await confirmDelete(`la cartella “${me.name}”`, { detail: 'Le note e le sottocartelle passano alla cartella superiore.' }))) return;
          const before = store.settings;
          set({ deleted: true });
          onDeleted(me);
          onClose();
          offerUndo(`Cartella “${me.name}” eliminata: le note passano ${parent ? `in ${parent.name}` : 'in Tutte le note'}`, () => store.saveSettings(before));
        }}
      >
        <Sym name="delete" size={22} />
        <span>
          <strong>Elimina la cartella</strong>
          <small>Le note e le sottocartelle non si perdono: passano alla cartella superiore</small>
        </span>
      </button>
      {moving && (
        <FolderPicker
          selected={liveFolder(all, me.parentId)}
          exclude={subtree(all, f.id)}
          onPick={(id) => set({ parentId: id })}
          onClose={() => setMoving(false)}
        />
      )}
    </Sheet>
  );
}

/** Folders one level at a time: hold and drag to reorder, swipe left to delete, › to go inside. */
function FolderManager({ start, counts, onClose, onEdit }: { start?: string; counts: Map<string, number>; onClose: () => void; onEdit: (f: NoteFolder) => void }) {
  const store = useStore();
  const offerUndo = useUndo();
  const all = allFoldersOf(store.settings);
  const [level, setLevel] = useState<string | undefined>(start);
  const [adding, setAdding] = useState(false);
  const kids = childrenOf(all, level);
  const reorder = (next: NoteFolder[]) => {
    const slots = all.map((x, i) => (kids.some((k) => k.id === x.id) ? i : -1)).filter((i) => i >= 0);
    const out = [...all];
    slots.forEach((slot, i) => (out[slot] = next[i]));
    store.saveSettings({ ...store.settings, noteFolders: out });
  };
  const sort = useSortableList(kids, reorder, { attr: 'fold', handle: '.row-grip' });
  const here = folderPath(all, level);
  if (adding) return <NewFolderSheet parentId={level} onClose={() => setAdding(false)} />;
  return (
    <Sheet title="Gestisci cartelle" onClose={onClose} className="folder-manager">
      <div className="fm-crumbs">
        {level ? (
          <button type="button" className="link-quiet" onClick={() => setLevel(liveFolder(all, all.find((x) => x.id === level)?.parentId))}>
            ‹ {here.length > 1 ? here.at(-2)!.name : 'Tutte le cartelle'}
          </button>
        ) : (
          <span className="muted small">Tieni premuto ⋮⋮ e trascina per riordinare · scorri a sinistra per eliminare</span>
        )}
        {level && <strong>{here.at(-1)?.name}</strong>}
      </div>
      <ul className="fm-list" {...sort.container}>
        {kids.map((f, i) => {
          const sub = childrenOf(all, f.id).length;
          return (
            <li key={f.id} {...sort.item(i)}>
              <SwipeDelete
                what={`la cartella “${f.name}”`}
                onDelete={() => {
                  const before = store.settings;
                  store.saveSettings({ ...store.settings, noteFolders: all.map((x) => (x.id === f.id ? { ...x, deleted: true } : x)) });
                  offerUndo(`Cartella “${f.name}” eliminata`, () => store.saveSettings(before));
                }}
              >
                <div className="fm-row">
                  <DragGrip />
                  <span className="fm-dot" style={{ background: toneColor(f.tone) }} />
                  <button type="button" className="fm-name" onClick={() => onEdit(f)}>
                    <strong>{f.name}</strong>
                    <small>
                      {counts.get(f.id) ?? 0} note{sub ? ` · ${sub} ${sub === 1 ? 'sottocartella' : 'sottocartelle'}` : ''}
                    </small>
                  </button>
                  <button type="button" className="icon-btn small" aria-label={`Apri ${f.name}`} onClick={() => setLevel(f.id)}>
                    <Sym name="chevron_right" size={20} />
                  </button>
                </div>
              </SwipeDelete>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn-add" onClick={() => setAdding(true)}>
        + {level ? 'Nuova sottocartella' : 'Nuova cartella'}
      </button>
    </Sheet>
  );
}
