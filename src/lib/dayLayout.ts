import type { ModuleKind } from './types';

export interface BlockDef {
  id: string;
  label: string;
  print: string; // print section
}

/** Blocks of the day page in their default order: work first, diary last. */
export const DAY_BLOCKS: BlockDef[] = [
  { id: 'shift', label: 'Turno', print: 'lavoro' },
  { id: 'roster', label: 'Tabellone', print: 'lavoro' },
  { id: 'work', label: 'Interventi, attività clinica e studio', print: 'lavoro' },
  { id: 'agenda', label: 'Impegni', print: 'agenda' },
  { id: 'todos', label: 'Da ricordare', print: 'agenda' },
  { id: 'training', label: 'Allenamento', print: 'palestra' },
  { id: 'nutrition', label: 'Alimentazione', print: 'alimentazione' },
  { id: 'body', label: 'Passi e corpo', print: 'corpo' },
  { id: 'private', label: 'Gite, uscite e foto', print: 'privato' },
  { id: 'notes', label: 'Note', print: 'diario' },
  { id: 'mood', label: 'Com’è andata', print: 'diario' },
];

export const DAY_PRINT_SECTIONS = [
  { id: 'lavoro', label: 'Lavoro (turno, tabellone, interventi, clinica, studio)' },
  { id: 'agenda', label: 'Impegni e promemoria' },
  { id: 'palestra', label: 'Allenamento' },
  { id: 'alimentazione', label: 'Alimentazione' },
  { id: 'corpo', label: 'Passi e corpo' },
  { id: 'privato', label: 'Gite, uscite e foto' },
  { id: 'diario', label: 'Note e umore' },
];

export const MODULE_BLOCK: Record<ModuleKind, string> = {
  surgery: 'work',
  clinical: 'work',
  study: 'work',
  workout: 'training',
  outing: 'private',
  photos: 'private',
  note: 'notes',
};

/** Saved order, completed with blocks added in later versions. */
export function blockOrder(saved: string[] | undefined): string[] {
  const known = DAY_BLOCKS.map((b) => b.id);
  const base = (saved ?? []).filter((id) => known.includes(id));
  for (const id of known) if (!base.includes(id)) base.splice(known.indexOf(id), 0, id);
  return base;
}
