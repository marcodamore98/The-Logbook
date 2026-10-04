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
  category?: string; // vocab.CATEGORIES
  time?: HHMM; // with a time it becomes a Google Calendar event
  gcalEventId?: string;
}

export interface Appointment {
  id: string;
  title: string;
  category?: string; // vocab.CATEGORIES
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

/** One step of a running session: by time (seconds) or by distance (metres). */
export interface RunStep {
  id: string;
  kind: 'warmup' | 'work' | 'rest' | 'cooldown';
  by: 'time' | 'distance';
  value: number;
}

export interface RunPlan {
  id: string;
  name: string;
  steps: RunStep[];
}

/** [lat, lon, seconds from start] */
export type TrackPoint = [number, number, number];

/** A completed step of an interval session, as actually run. */
export interface RunLap {
  kind: RunStep['kind'];
  by: RunStep['by'];
  value: number;
  seconds: number;
  meters: number;
}

export interface RunModule {
  kind: 'run';
  id: string;
  title?: string;
  mode: 'continuous' | 'intervals';
  planName?: string;
  steps?: RunStep[];
  distanceM: number;
  durationSec: number;
  startedAt?: number;
  routeName?: string;
  track?: TrackPoint[];
  maxSpeedKmh?: number;
  splits?: number[]; // seconds per completed km
  laps?: RunLap[];
  notes?: string;
}

export interface PhotoItem {
  id: string;
  src: string; // data URL (locale) o URL di download (cloud)
  path?: string; // path su Firebase Storage
  caption?: string;
}

/** A document stored with the app (course programme, certificate). */
export interface FileRef {
  id: string;
  name: string;
  src: string; // 'fs:<id>' (cloud) or 'lf:<id>' (this device)
  path?: string;
  size?: number;
}

/** Course or congress: may last several days. */
export interface CourseModule {
  kind: 'course';
  id: string;
  type?: 'course' | 'congress' | 'webinar';
  title: string;
  startTime?: string; // HH:MM
  /** Reminder 30 and 5 minutes before the start (Google Calendar + in-app). */
  remind?: boolean;
  gcalEventId?: string;
  startDate: ISODate;
  endDate: ISODate;
  program?: FileRef;
  certificate?: FileRef;
}

/** Trip: may last several days. */
export interface TravelModule {
  kind: 'travel';
  id: string;
  title: string;
  destination?: string;
  startDate: ISODate;
  endDate: ISODate;
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
  category?: string; // vocab.CATEGORIES
  text: string;
}

/** normal = serie allenante, warmup = riscaldamento, drop = dropset, failure = a cedimento. */
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  reps: number;
  kg?: number;
  type?: SetType; // default 'normal'
  warmup?: boolean; // formato precedente (= type 'warmup')
  rpe?: number;
  seconds?: number; // esercizi a tempo
  km?: number; // esercizi a distanza
  done?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  supersetId?: string; // esercizi con lo stesso id formano una superserie
  restSec?: number; // recupero dopo ogni serie
  notes?: string;
}

export interface WorkoutModule {
  kind: 'workout';
  id: string;
  source?: 'hevy';
  title?: string; // nome della scheda / routine
  routineId?: string;
  type: string; // vocab.WORKOUT_TYPES
  durationMin: number;
  startedAt?: number; // ms
  finishedAt?: number; // ms
  rpe?: number; // 1-10
  distanceKm?: number;
  exercises: WorkoutExercise[];
  notes?: string;
}

// ---- Libreria esercizi e schede ----

/** How an exercise is measured, as in Hevy. */
export type ExerciseKind =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'duration'
  | 'weight_duration'
  | 'distance_duration';

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: string; // vocab MUSCLES
  secondary?: string[];
  equipment: string; // vocab EQUIPMENT
  kind: ExerciseKind;
  custom?: boolean;
}

export interface PlannedSet {
  type: SetType;
  reps?: number;
  repsMax?: number; // range, es. 8–12
  kg?: number;
  seconds?: number;
  rpe?: number;
}

export interface RoutineExercise {
  exerciseId: string;
  sets: PlannedSet[];
  supersetId?: string;
  restSec?: number;
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  folder?: string; // es. "PPL"
  type?: string; // vocab.WORKOUT_TYPES (push / pull / legs…)
  notes?: string;
  exercises: RoutineExercise[];
  updatedAt: number;
}

// ---- Alimentazione ----

export type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Nutritional values per 100 g (or 100 ml). */
export interface Food {
  id: string;
  name: string;
  brand?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  portionG?: number; // porzione tipica
  portionName?: string; // es. "1 vasetto"
  category?: string; // vocab FOOD_CATEGORIES
  barcode?: string;
  source: 'builtin' | 'custom' | 'off';
}

export interface FoodEntry {
  id: string;
  foodId?: string; // assente per l'aggiunta rapida
  name: string;
  brand?: string;
  grams: number;
  kcal: number; // già calcolati sulla quantità
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  time?: HHMM;
}

export interface FoodLog {
  meals: Partial<Record<MealId, FoodEntry[]>>;
  waterMl?: number;
  notes?: string;
}

/** Diet plan prepared e.g. by a coach; values already computed per item. */
export interface MealPlanItem {
  foodId?: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlan {
  id: string;
  name: string;
  notes?: string;
  targets?: { kcal?: number; protein?: number; carbs?: number; fat?: number };
  meals: Partial<Record<MealId, MealPlanItem[]>>;
  updatedAt: number;
}

// ---- Corpo ----

export interface BodyLog {
  weightKg?: number;
  bodyFatPct?: number;
  kcalIn?: number; // calorie assunte
  kcalOut?: number; // calorie attive / bruciate
  proteinG?: number;
  steps?: number;
  sleepH?: number;
  restingHr?: number;
  waterL?: number;
}

export interface BodyGoals {
  weightKg?: number;
  kcalIn?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  steps?: number;
  sleepH?: number;
  waterL?: number;
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
  | RunModule
  | CourseModule
  | TravelModule
  | OutingModule;

export type ModuleKind = Module['kind'];

export interface DiaryEntry {
  text: string;
  photos: PhotoItem[];
}

export interface DayEntry {
  date: ISODate;
  shift?: ShiftAssignment; // lavoro principale (ospedale)
  guardia?: ShiftAssignment; // secondo lavoro: guardia medica
  todos: Todo[];
  appointments: Appointment[];
  modules: Module[];
  mood?: number; // 1-5
  body?: BodyLog;
  food?: FoodLog;
  diary?: DiaryEntry; // diario del giorno: solo testo libero e foto
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
  exercises?: ExerciseDef[]; // esercizi personalizzati
  routines?: Routine[];
  goals?: BodyGoals;
  mealPlans?: MealPlan[];
  foods?: Food[]; // alimenti personali e salvati da Open Food Facts
  favoriteFoods?: string[];
  dayLayout?: string[]; // ordine dei blocchi nella pagina del giorno
  runPlans?: RunPlan[]; // sessioni a intervalli salvate
  hiddenBlocks?: string[]; // blocchi eliminati dalla pagina del giorno (es. il tabellone)
  seed?: number; // versione dei dati predefiniti già applicata (vedi migrateSettings)
  updatedAt: number;
}

export function emptyDay(date: ISODate): DayEntry {
  return { date, todos: [], appointments: [], modules: [], updatedAt: 0 };
}
