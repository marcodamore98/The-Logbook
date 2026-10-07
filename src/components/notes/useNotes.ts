import { useCallback, useEffect, useMemo } from 'react';
import { today } from '../../lib/dates';
import { allFoldersOf, areaFor, findNote, mapNote, notesOf, TRASH_DAYS, type NoteRow } from '../../lib/notes';
import { useStore } from '../../lib/store/StoreContext';
import type { ISODate, StudyModule } from '../../lib/types';
import { uid } from '../ui';

/** Every note of the logbook and what can be done to them. Loads all days the first time. */
export function useNotes() {
  const store = useStore();
  const { ensureAllLoaded, allDays, updateDay, repo, settings } = store;
  useEffect(() => ensureAllLoaded(), [ensureAllLoaded]);
  const rows = useMemo(() => notesOf(allDays), [allDays]);
  const folders = allFoldersOf(settings);

  const update = useCallback((r: { date: ISODate; m: { id: string } }, fn: (m: StudyModule) => StudyModule) => updateDay(r.date, (d) => mapNote(d, r.m.id, fn)), [updateDay]);

  /** To the Cestino: a session leaves the day's sessions too. */
  const trash = useCallback(
    (r: NoteRow) =>
      updateDay(r.date, (d) => {
        const now = Date.now();
        if (r.loose) return mapNote(d, r.m.id, (m) => ({ ...m, trashedAt: now }));
        const m = d.modules.find((x) => x.id === r.m.id);
        if (m?.kind !== 'study') return d;
        return { ...d, modules: d.modules.filter((x) => x.id !== m.id), looseNotes: [...(d.looseNotes ?? []), { ...m, trashedAt: now }] };
      }),
    [updateDay],
  );

  /** Out of the Cestino: a session goes back among the day's sessions. */
  const restore = useCallback(
    (r: NoteRow) =>
      updateDay(r.date, (d) => {
        const m = d.looseNotes?.find((x) => x.id === r.m.id);
        if (!m) return d;
        const back = { ...m, trashedAt: undefined };
        if (m.free) return mapNote(d, m.id, () => back);
        return { ...d, looseNotes: d.looseNotes!.filter((x) => x.id !== m.id), modules: [...d.modules, back] };
      }),
    [updateDay],
  );

  const destroy = useCallback(
    (r: NoteRow) => {
      for (const f of r.m.attachments ?? []) repo.deleteFile(f.path);
      return updateDay(r.date, (d) => ({ ...d, looseNotes: (d.looseNotes ?? []).filter((x) => x.id !== r.m.id), modules: d.modules.filter((x) => x.id !== r.m.id) }));
    },
    [updateDay, repo],
  );

  /** A new free note in a folder, on today's page (not shown there). */
  const create = useCallback(
    async (folderId: string | undefined): Promise<{ date: ISODate; id: string }> => {
      const date = today();
      const now = Date.now();
      const m: StudyModule = { kind: 'study', id: uid(), type: 'article', area: areaFor(folders, folderId), title: '', durationMin: 0, free: true, folderId: folderId ?? '', createdAt: now, editedAt: now };
      await updateDay(date, (d) => ({ ...d, looseNotes: [...(d.looseNotes ?? []), m] }));
      return { date, id: m.id };
    },
    [updateDay, folders],
  );

  /** A free note becomes a study session of a day (it then counts in the statistics). */
  const link = useCallback(
    async (r: NoteRow, date: ISODate, type: string, durationMin: number) => {
      const m: StudyModule = { ...r.m, free: undefined, type, durationMin };
      await updateDay(r.date, (d) => ({ ...d, looseNotes: (d.looseNotes ?? []).filter((x) => x.id !== r.m.id), modules: d.modules.filter((x) => x.id !== r.m.id) }));
      await updateDay(date, (d) => ({ ...d, modules: [...d.modules, m] }));
      return date;
    },
    [updateDay],
  );

  const move = useCallback(
    (list: NoteRow[], folderId: string | undefined) => {
      const area = areaFor(folders, folderId);
      for (const r of list) update(r, (m) => ({ ...m, folderId: folderId ?? '', area }));
    },
    [update, folders],
  );

  // The Cestino empties itself after 30 days.
  useEffect(() => {
    const limit = Date.now() - TRASH_DAYS * 86_400_000;
    for (const r of rows) if (r.m.trashedAt && r.m.trashedAt < limit) destroy(r);
  }, [rows, destroy]);

  return { rows, folders, update, trash, restore, destroy, create, link, move, find: findNote };
}
