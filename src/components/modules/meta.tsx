import type { ComponentType } from 'react';
import type { Module, ModuleKind } from '../../lib/types';
import { labelOf, CLINICAL_ACTIVITIES, OUTING_TYPES, PROCEDURES, STUDY_TYPES, WORKOUT_TYPES } from '../../lib/vocab';
import { IconClinical, IconNote, IconOuting, IconPhotos, IconStudy, IconSurgery, IconWorkout } from '../icons';
import { uid } from '../ui';

export interface ModuleMeta {
  kind: ModuleKind;
  label: string;
  hint: string;
  area: 'lavoro' | 'personale';
  Icon: ComponentType<{ size?: number }>;
  create(): Module;
}

export const MODULES: ModuleMeta[] = [
  {
    kind: 'surgery',
    label: 'Attività chirurgica',
    hint: 'Intervento, ruolo, via d’accesso',
    area: 'lavoro',
    Icon: IconSurgery,
    create: () => ({ kind: 'surgery', id: uid(), procedureId: '', role: 'assistant', approach: 'laparoscopic', setting: 'elective', clavien: 'none' }),
  },
  {
    kind: 'clinical',
    label: 'Attività clinica',
    hint: 'Ambulatorio, ecografie, PS, sala parto',
    area: 'lavoro',
    Icon: IconClinical,
    create: () => ({ kind: 'clinical', id: uid(), activityId: 'amb-gin', count: 1 }),
  },
  {
    kind: 'study',
    label: 'Studio',
    hint: 'Articoli, corsi, congressi',
    area: 'lavoro',
    Icon: IconStudy,
    create: () => ({ kind: 'study', id: uid(), type: 'article', area: 'gynecology', title: '', durationMin: 30 }),
  },
  {
    kind: 'workout',
    label: 'Allenamento',
    hint: 'Esercizi, serie, carichi',
    area: 'personale',
    Icon: IconWorkout,
    create: () => ({ kind: 'workout', id: uid(), type: 'strength', durationMin: 60, exercises: [] }),
  },
  {
    kind: 'outing',
    label: 'Gita / uscita',
    hint: 'Viaggi, cene, eventi',
    area: 'personale',
    Icon: IconOuting,
    create: () => ({ kind: 'outing', id: uid(), type: 'friends', title: '' }),
  },
  {
    kind: 'photos',
    label: 'Immagini',
    hint: 'Foto e immagini della giornata',
    area: 'personale',
    Icon: IconPhotos,
    create: () => ({ kind: 'photos', id: uid(), items: [] }),
  },
  {
    kind: 'note',
    label: 'Note',
    hint: 'Pensieri e appunti liberi',
    area: 'personale',
    Icon: IconNote,
    create: () => ({ kind: 'note', id: uid(), text: '' }),
  },
];

export const metaOf = (k: ModuleKind) => MODULES.find((m) => m.kind === k)!;

/** One-line summary used in month/week views. */
export function summarize(m: Module): string {
  switch (m.kind) {
    case 'surgery':
      return labelOf(PROCEDURES, m.procedureId) || 'Intervento';
    case 'clinical':
      return `${m.count}× ${labelOf(CLINICAL_ACTIVITIES, m.activityId)}`;
    case 'study':
      return m.title || labelOf(STUDY_TYPES, m.type);
    case 'workout':
      return `${labelOf(WORKOUT_TYPES, m.type)} · ${m.durationMin}′`;
    case 'outing':
      return m.title || labelOf(OUTING_TYPES, m.type);
    case 'photos':
      return `${m.items.length} foto`;
    case 'note':
      return m.title || m.text.slice(0, 40) || 'Nota';
  }
}
