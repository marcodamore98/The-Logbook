import type { ComponentType } from 'react';
import type { Module, ModuleKind } from '../../lib/types';
import { APPROACHES, labelOf, SURGICAL_ROLES, CLINICAL_ACTIVITIES, OUTING_TYPES, PROCEDURES, STUDY_TYPES, WORKOUT_TYPES } from '../../lib/vocab';
import { IconClinical, IconCourse, IconNote, IconOuting, IconRun, IconTravel, IconPhotos, IconStudy, IconSurgery, IconWorkout } from '../icons';
import { uid } from '../ui';
import { fmtDuration, fmtKm, fmtPace } from '../../lib/running/geo';

const dm = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
/** "12 ott" or "12 – 14 ott". */
export const rangeLabel = (a: string, b: string) => (!b || a === b ? dm(a) : `${dm(a)} – ${dm(b)}`);

export const runLine = (m: Extract<Module, { kind: 'run' }>) =>
  [m.title || (m.mode === 'intervals' ? m.planName ?? 'Intervalli' : 'Corsa'), m.distanceM ? `${fmtKm(m.distanceM)} km` : '', m.durationSec ? fmtDuration(m.durationSec) : '', m.distanceM && m.durationSec ? `${fmtPace(m.distanceM, m.durationSec)}/km` : '']
    .filter(Boolean)
    .join(' · ');

export interface ModuleMeta {
  kind: ModuleKind;
  label: string;
  hint: string;
  area: 'lavoro' | 'personale';
  Icon: ComponentType<{ size?: number }>;
  create(date: string): Module;
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
    kind: 'run',
    label: 'Corsa',
    hint: 'Corsa continua o a intervalli, con percorso e GPS',
    area: 'personale',
    Icon: IconRun,
    create: () => ({ kind: 'run', id: uid(), mode: 'continuous', distanceM: 0, durationSec: 0 }),
  },
  {
    kind: 'course',
    label: 'Corsi e congressi',
    hint: 'Anche di più giorni, con programma e attestato',
    area: 'lavoro',
    Icon: IconCourse,
    create: (date) => ({ kind: 'course', id: uid(), title: '', startDate: date, endDate: date }),
  },
  {
    kind: 'travel',
    label: 'Viaggio',
    hint: 'Anche di più giorni',
    area: 'personale',
    Icon: IconTravel,
    create: (date) => ({ kind: 'travel', id: uid(), title: '', startDate: date, endDate: date }),
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
      return [labelOf(PROCEDURES, m.procedureId) || 'Intervento', labelOf(SURGICAL_ROLES, m.role), labelOf(APPROACHES, m.approach)].filter(Boolean).join(' · ');
    case 'clinical':
      return `${m.count}× ${labelOf(CLINICAL_ACTIVITIES, m.activityId)}`;
    case 'study':
      return `${m.title || labelOf(STUDY_TYPES, m.type)} · ${m.durationMin}′`;
    case 'workout':
      return `${m.title || labelOf(WORKOUT_TYPES, m.type)} · ${m.durationMin}′`;
    case 'run':
      return runLine(m);
    case 'course':
    case 'travel':
      return [m.title || (m.kind === 'course' ? 'Corso / congresso' : 'Viaggio'), rangeLabel(m.startDate, m.endDate)].filter(Boolean).join(' · ');
    case 'outing':
      return [m.title || labelOf(OUTING_TYPES, m.type), m.place].filter(Boolean).join(' · ');
    case 'photos':
      return `${m.items.length} foto`;
    case 'note':
      return m.title || m.text.slice(0, 40) || 'Nota';
  }
}
