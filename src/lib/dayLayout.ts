import type { ModuleKind } from './types';

export interface BlockDef {
  id: string;
  label: string;
  print: string; // print section
}

/** Blocks of the day page in their default order: work first, diary last. */
export const DAY_BLOCKS: BlockDef[] = [
  { id: 'shift', label: 'Turno', print: 'lavoro' },
  { id: 'guardia', label: 'Guardia medica', print: 'lavoro' },
  { id: 'work', label: 'Interventi, attività clinica e studio', print: 'lavoro' },
  { id: 'agenda', label: 'Impegni', print: 'agenda' },
  { id: 'todos', label: 'Da ricordare', print: 'agenda' },
  { id: 'training', label: 'Allenamento', print: 'palestra' },
  { id: 'nutrition', label: 'Alimentazione', print: 'alimentazione' },
  { id: 'private', label: 'Gite e uscite', print: 'privato' },
  { id: 'diary', label: 'Diario', print: 'diario' },
];

export const MODULE_BLOCK: Record<ModuleKind, string> = {
  surgery: 'work',
  clinical: 'work',
  study: 'work',
  workout: 'training',
  run: 'training',
  course: 'work',
  travel: 'private',
  outing: 'private',
  photos: 'diary',
  note: 'diary',
};

/** Saved order, completed with blocks added in later versions. */
export function blockOrder(saved: string[] | undefined): string[] {
  const known = DAY_BLOCKS.map((b) => b.id);
  const base = (saved ?? []).filter((id) => known.includes(id));
  for (const id of known) if (!base.includes(id)) base.splice(known.indexOf(id), 0, id);
  return base;
}
