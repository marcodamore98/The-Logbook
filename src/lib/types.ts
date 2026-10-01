// Data model. A logbook is a set of DayEntry documents keyed by ISO date
// (YYYY-MM-DD) plus a single Settings document.

export type ISODate = string; // YYYY-MM-DD
export type HHMM = string; // 08:00

export interface Colleague {
  id: string;
  name: string;
  role?: string; // es. "Dirigente medico", "Specializzando", "Ostetrica"
}

export interface ShiftType {
  id: string;
  name: string;
  start: HHMM;
  end: HHMM; // may be < start for overnight shifts
  color: string; // hex, used as a soft tint
  countsAsWork: boolean; // false for riposo/ferie/smonto
  group?: string; // raggruppamento nel menu
}

export interface ShiftAssignment {
  shiftTypeId: string;
  start: HHMM;
  end: HHMM;
  colleagueIds: string[];
  place?: string; // reparto / sede
  note?: string;
  gcalEventId?: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  time?: HHMM; // with a time it becomes a Google Calendar event
  gcalEventId?: string;
}

export interface Appointment {
  id: string;
  title: string;
  start: HHMM;
  end: HHMM;
  location?: string;
  gcalEventId?: string;
}

// ---- Modules (schede aggiungibili) ----

export interface SurgeryModule {
  kind: 'surgery';
  id: string;
  procedureId: string;
  role: string; // vocab.SURGICAL_ROLES
  approach: string; // vocab.APPROACHES
  setting: string; // elezione / urgenza
  durationMin?: number;
  clavien?: string; // vocab.CLAVIEN
  tutorId?: string;
  notes?: string;
}

export interface ClinicalModule {
  kind: 'clinical';
  id: string;
  activityId: string; // vocab.CLINICAL_ACTIVITIES
  count: number;
  notes?: string;
}

export interface StudyModule {
  kind: 'study';
  id: string;
  type: string; // vocab.STUDY_TYPES
  area: string; // vocab.STUDY_AREAS
  title: string;
  durationMin: number;
  notes?: string;
}

export interface PhotoItem {
  id: string;
  src: string; // data URL (locale) o URL di download (cloud)
  path?: string; // path su Firebase Storage
  caption?: string;
}

export interface PhotoModule {
  kind: 'photos';
  id: string;
  items: PhotoItem[];
}

export interface NoteModule {
  kind: 'note';
  id: string;
  title?: string;
  text: string;
}

export interface WorkoutSet {
  reps: number;
  kg?: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface WorkoutModule {
  kind: 'workout';
  id: string;
  type: string; // vocab.WORKOUT_TYPES
  durationMin: number;
  rpe?: number; // 1-10
  distanceKm?: number;
  exercises: WorkoutExercise[];
  notes?: string;
}

export interface OutingModule {
  kind: 'outing';
  id: string;
  type: string; // vocab.OUTING_TYPES
  title: string;
  place?: string;
  people?: string;
  notes?: string;
}

export type Module =
  | SurgeryModule
  | ClinicalModule
  | StudyModule
  | PhotoModule
  | NoteModule
  | WorkoutModule
  | OutingModule;

export type ModuleKind = Module['kind'];

export interface DayEntry {
  date: ISODate;
  shift?: ShiftAssignment;
  todos: Todo[];
  appointments: Appointment[];
  modules: Module[];
  mood?: number; // 1-5
  gcalTrash?: string[]; // eventi Google da eliminare alla prossima sincronizzazione
  updatedAt: number;
}

export interface Settings {
  colleagues: Colleague[];
  shiftTypes: ShiftType[];
  gcal: {
    enabled: boolean;
    calendarId: string; // 'primary' o id di un calendario dedicato
    readCalendarIds: string[]; // calendari mostrati in lettura
  };
  seed?: number; // versione dei dati predefiniti già applicata (vedi migrateSettings)
  updatedAt: number;
}

export function emptyDay(date: ISODate): DayEntry {
  return { date, todos: [], appointments: [], modules: [], updatedAt: 0 };
}
