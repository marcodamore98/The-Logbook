import type { DayEntry, DiaryEntry, PhotoItem } from './types';

/**
 * The diary of a day. Notes and photos saved as modules by earlier versions are
 * folded in, so nothing written before the diary existed gets lost.
 */
export function diaryOf(day: DayEntry): DiaryEntry {
  const legacyText = day.modules
    .filter((m) => m.kind === 'note')
    .map((m) => [m.title, m.text].filter(Boolean).join('\n'))
    .filter(Boolean);
  const legacyPhotos: PhotoItem[] = day.modules.flatMap((m) => (m.kind === 'photos' ? m.items : []));
  const own = day.diary;
  return {
    text: [own?.text, ...legacyText].filter(Boolean).join('\n\n'),
    photos: [...(own?.photos ?? []), ...legacyPhotos],
  };
}

export const hasDiary = (day: DayEntry) => {
  const d = diaryOf(day);
  return d.text.trim().length > 0 || d.photos.length > 0;
};

/** Stores the diary and drops the legacy note/photo modules it absorbed. */
export function withDiary(day: DayEntry, diary: DiaryEntry): DayEntry {
  return { ...day, diary, modules: day.modules.filter((m) => m.kind !== 'note' && m.kind !== 'photos') };
}
