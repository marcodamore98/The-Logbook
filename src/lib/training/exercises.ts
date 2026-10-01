// Built-in exercise library. Ids are stable (statistics group by them); the
// first 27 keep the ids used before the library existed.

import type { ExerciseDef, ExerciseKind } from '../types';

export const MUSCLES = [
  'Petto', 'Dorsali', 'Trapezi', 'Lombari', 'Spalle', 'Bicipiti', 'Tricipiti', 'Avambracci',
  'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Adduttori', 'Abduttori', 'Addome', 'Cardio', 'Corpo intero',
] as const;

export const EQUIPMENT = ['Bilanciere', 'Manubri', 'Macchina', 'Cavi', 'Corpo libero', 'Kettlebell', 'Smith', 'Elastico', 'Altro'] as const;

export const KINDS: { id: ExerciseKind; label: string }[] = [
  { id: 'weight_reps', label: 'Peso × ripetizioni' },
  { id: 'bodyweight_reps', label: 'Corpo libero (ripetizioni)' },
  { id: 'weighted_bodyweight', label: 'Corpo libero + zavorra' },
  { id: 'assisted_bodyweight', label: 'Corpo libero assistito' },
  { id: 'duration', label: 'Durata' },
  { id: 'weight_duration', label: 'Peso × durata' },
  { id: 'distance_duration', label: 'Distanza e durata' },
];

type Row = [id: string, name: string, muscle: string, equipment: string, kind?: ExerciseKind, secondary?: string[]];

const ROWS: Row[] = [
  // ids storici
  ['squat', 'Squat con bilanciere', 'Quadricipiti', 'Bilanciere', 'weight_reps', ['Glutei', 'Femorali']],
  ['front-squat', 'Front squat', 'Quadricipiti', 'Bilanciere', 'weight_reps', ['Glutei']],
  ['leg-press', 'Leg press', 'Quadricipiti', 'Macchina', 'weight_reps', ['Glutei']],
  ['lunge', 'Affondi con manubri', 'Quadricipiti', 'Manubri', 'weight_reps', ['Glutei']],
  ['rdl', 'Stacco rumeno', 'Femorali', 'Bilanciere', 'weight_reps', ['Glutei', 'Lombari']],
  ['leg-curl', 'Leg curl sdraiato', 'Femorali', 'Macchina'],
  ['leg-extension', 'Leg extension', 'Quadricipiti', 'Macchina'],
  ['hip-thrust', 'Hip thrust', 'Glutei', 'Bilanciere', 'weight_reps', ['Femorali']],
  ['calf', 'Calf raise in piedi', 'Polpacci', 'Macchina'],
  ['deadlift', 'Stacco da terra', 'Lombari', 'Bilanciere', 'weight_reps', ['Glutei', 'Femorali', 'Trapezi']],
  ['pull-up', 'Trazioni', 'Dorsali', 'Corpo libero', 'bodyweight_reps', ['Bicipiti']],
  ['lat-pulldown', 'Lat machine', 'Dorsali', 'Cavi', 'weight_reps', ['Bicipiti']],
  ['barbell-row', 'Rematore con bilanciere', 'Dorsali', 'Bilanciere', 'weight_reps', ['Bicipiti', 'Lombari']],
  ['cable-row', 'Pulley basso', 'Dorsali', 'Cavi', 'weight_reps', ['Bicipiti']],
  ['bench', 'Panca piana con bilanciere', 'Petto', 'Bilanciere', 'weight_reps', ['Tricipiti', 'Spalle']],
  ['incline-bench', 'Panca inclinata con bilanciere', 'Petto', 'Bilanciere', 'weight_reps', ['Spalle', 'Tricipiti']],
  ['dips', 'Dip alle parallele', 'Petto', 'Corpo libero', 'bodyweight_reps', ['Tricipiti']],
  ['push-up', 'Piegamenti', 'Petto', 'Corpo libero', 'bodyweight_reps', ['Tricipiti']],
  ['chest-fly', 'Croci ai cavi', 'Petto', 'Cavi'],
  ['ohp', 'Military press', 'Spalle', 'Bilanciere', 'weight_reps', ['Tricipiti']],
  ['lateral-raise', 'Alzate laterali con manubri', 'Spalle', 'Manubri'],
  ['face-pull', 'Face pull', 'Spalle', 'Cavi', 'weight_reps', ['Trapezi']],
  ['curl', 'Curl con bilanciere', 'Bicipiti', 'Bilanciere'],
  ['triceps', 'Push-down ai cavi', 'Tricipiti', 'Cavi'],
  ['plank', 'Plank', 'Addome', 'Corpo libero', 'duration'],
  ['crunch', 'Crunch', 'Addome', 'Corpo libero', 'bodyweight_reps'],
  ['hanging-leg', 'Leg raise alla sbarra', 'Addome', 'Corpo libero', 'bodyweight_reps'],

  // Petto
  ['bench-db', 'Panca piana con manubri', 'Petto', 'Manubri', 'weight_reps', ['Tricipiti', 'Spalle']],
  ['incline-db', 'Panca inclinata con manubri', 'Petto', 'Manubri', 'weight_reps', ['Spalle', 'Tricipiti']],
  ['decline-bench', 'Panca declinata', 'Petto', 'Bilanciere', 'weight_reps', ['Tricipiti']],
  ['chest-press-machine', 'Chest press', 'Petto', 'Macchina', 'weight_reps', ['Tricipiti']],
  ['incline-press-machine', 'Chest press inclinata', 'Petto', 'Macchina', 'weight_reps', ['Spalle']],
  ['smith-bench', 'Panca piana al multipower', 'Petto', 'Smith', 'weight_reps', ['Tricipiti']],
  ['smith-incline', 'Panca inclinata al multipower', 'Petto', 'Smith', 'weight_reps', ['Spalle', 'Tricipiti']],
  ['pec-deck', 'Pectoral machine (pec deck)', 'Petto', 'Macchina'],
  ['db-fly', 'Croci con manubri', 'Petto', 'Manubri'],
  ['dips-weighted', 'Dip zavorrati', 'Petto', 'Corpo libero', 'weighted_bodyweight', ['Tricipiti']],

  // Dorso
  ['pull-up-weighted', 'Trazioni zavorrate', 'Dorsali', 'Corpo libero', 'weighted_bodyweight', ['Bicipiti']],
  ['pull-up-assisted', 'Trazioni assistite', 'Dorsali', 'Macchina', 'assisted_bodyweight', ['Bicipiti']],
  ['chin-up', 'Trazioni presa supina', 'Dorsali', 'Corpo libero', 'bodyweight_reps', ['Bicipiti']],
  ['lat-pulldown-close', 'Lat machine presa stretta', 'Dorsali', 'Cavi', 'weight_reps', ['Bicipiti']],
  ['lat-pulldown-machine', 'Lat machine (macchina a dischi)', 'Dorsali', 'Macchina', 'weight_reps', ['Bicipiti']],
  ['cable-row-wide', 'Pulley basso presa larga', 'Dorsali', 'Cavi', 'weight_reps', ['Spalle', 'Bicipiti']],
  ['db-row', 'Rematore con manubrio', 'Dorsali', 'Manubri', 'weight_reps', ['Bicipiti']],
  ['t-bar-row', 'T-bar row', 'Dorsali', 'Bilanciere', 'weight_reps', ['Bicipiti']],
  ['machine-row', 'Rematore alla macchina', 'Dorsali', 'Macchina', 'weight_reps', ['Bicipiti']],
  ['high-row', 'High row alla macchina', 'Dorsali', 'Macchina', 'weight_reps', ['Trapezi']],
  ['pullover-cable', 'Pullover ai cavi', 'Dorsali', 'Cavi'],
  ['shrug', 'Scrollate con manubri', 'Trapezi', 'Manubri'],
  ['back-extension', 'Hyperextension', 'Lombari', 'Corpo libero', 'bodyweight_reps', ['Glutei']],

  // Spalle
  ['db-shoulder-press', 'Lento avanti con manubri', 'Spalle', 'Manubri', 'weight_reps', ['Tricipiti']],
  ['shoulder-press-machine', 'Shoulder press', 'Spalle', 'Macchina', 'weight_reps', ['Tricipiti']],
  ['arnold-press', 'Arnold press', 'Spalle', 'Manubri', 'weight_reps', ['Tricipiti']],
  ['cable-lateral', 'Alzate laterali ai cavi', 'Spalle', 'Cavi'],
  ['machine-lateral', 'Alzate laterali alla macchina', 'Spalle', 'Macchina'],
  ['rear-delt-fly', 'Reverse fly (deltoide posteriore)', 'Spalle', 'Macchina', 'weight_reps', ['Trapezi']],
  ['front-raise', 'Alzate frontali', 'Spalle', 'Manubri'],
  ['upright-row', 'Tirate al mento', 'Spalle', 'Bilanciere', 'weight_reps', ['Trapezi']],

  // Braccia
  ['db-curl', 'Curl con manubri', 'Bicipiti', 'Manubri'],
  ['hammer-curl', 'Hammer curl', 'Bicipiti', 'Manubri', 'weight_reps', ['Avambracci']],
  ['cross-hammer-curl', 'Hammer curl incrociato', 'Bicipiti', 'Manubri', 'weight_reps', ['Avambracci']],
  ['preacher-curl', 'Curl alla panca Scott', 'Bicipiti', 'Macchina'],
  ['cable-curl', 'Curl ai cavi', 'Bicipiti', 'Cavi'],
  ['incline-curl', 'Curl su panca inclinata', 'Bicipiti', 'Manubri'],
  ['rope-pushdown', 'Push-down con corda', 'Tricipiti', 'Cavi'],
  ['overhead-triceps', 'French press sopra la testa ai cavi', 'Tricipiti', 'Cavi'],
  ['skullcrusher', 'French press con bilanciere EZ', 'Tricipiti', 'Bilanciere'],
  ['close-grip-bench', 'Panca presa stretta', 'Tricipiti', 'Bilanciere', 'weight_reps', ['Petto']],
  ['triceps-machine', 'Dip machine / tricipiti alla macchina', 'Tricipiti', 'Macchina'],
  ['wrist-curl', 'Curl per avambracci', 'Avambracci', 'Manubri'],

  // Gambe
  ['hack-squat', 'Hack squat', 'Quadricipiti', 'Macchina', 'weight_reps', ['Glutei']],
  ['smith-squat', 'Squat al multipower', 'Quadricipiti', 'Smith', 'weight_reps', ['Glutei']],
  ['goblet-squat', 'Goblet squat', 'Quadricipiti', 'Kettlebell', 'weight_reps', ['Glutei']],
  ['bulgarian-split', 'Bulgarian split squat', 'Quadricipiti', 'Manubri', 'weight_reps', ['Glutei']],
  ['pendulum-squat', 'Pendulum squat', 'Quadricipiti', 'Macchina', 'weight_reps', ['Glutei']],
  ['seated-leg-curl', 'Leg curl seduto', 'Femorali', 'Macchina'],
  ['db-rdl', 'Stacco rumeno con manubri', 'Femorali', 'Manubri', 'weight_reps', ['Glutei']],
  ['good-morning', 'Good morning', 'Femorali', 'Bilanciere', 'weight_reps', ['Lombari']],
  ['glute-bridge', 'Glute bridge', 'Glutei', 'Bilanciere', 'weight_reps', ['Femorali']],
  ['hip-thrust-machine', 'Hip thrust alla macchina', 'Glutei', 'Macchina'],
  ['cable-kickback', 'Slanci ai cavi', 'Glutei', 'Cavi'],
  ['hip-abduction', 'Abductor machine', 'Abduttori', 'Macchina'],
  ['hip-adduction', 'Adductor machine', 'Adduttori', 'Macchina'],
  ['seated-calf', 'Calf raise seduto', 'Polpacci', 'Macchina'],
  ['leg-press-calf', 'Calf alla leg press', 'Polpacci', 'Macchina'],

  // Addome
  ['cable-crunch', 'Crunch ai cavi', 'Addome', 'Cavi'],
  ['ab-wheel', 'Ab wheel', 'Addome', 'Altro', 'bodyweight_reps'],
  ['side-plank', 'Plank laterale', 'Addome', 'Corpo libero', 'duration'],
  ['russian-twist', 'Russian twist', 'Addome', 'Corpo libero', 'bodyweight_reps'],
  ['pallof-press', 'Pallof press', 'Addome', 'Cavi'],

  // Corpo intero / cardio
  ['farmer-walk', 'Farmer walk', 'Corpo intero', 'Manubri', 'weight_duration', ['Avambracci', 'Trapezi']],
  ['kb-swing', 'Kettlebell swing', 'Glutei', 'Kettlebell', 'weight_reps', ['Femorali']],
  ['burpee', 'Burpee', 'Corpo intero', 'Corpo libero', 'bodyweight_reps'],
  ['treadmill', 'Tapis roulant', 'Cardio', 'Macchina', 'distance_duration'],
  ['bike', 'Cyclette', 'Cardio', 'Macchina', 'distance_duration'],
  ['elliptical', 'Ellittica', 'Cardio', 'Macchina', 'distance_duration'],
  ['rowing', 'Vogatore', 'Cardio', 'Macchina', 'distance_duration', ['Dorsali']],
  ['stairmaster', 'Stair climber', 'Cardio', 'Macchina', 'duration'],
  ['run', 'Corsa', 'Cardio', 'Corpo libero', 'distance_duration'],
  ['jump-rope', 'Salto della corda', 'Cardio', 'Altro', 'duration'],
];

export const BUILTIN_EXERCISES: ExerciseDef[] = ROWS.map(([id, name, muscle, equipment, kind = 'weight_reps', secondary]) => ({
  id, name, muscle, equipment, kind, secondary,
}));

/** Built-in + custom exercises; ids starting with "hevy:" (imported, unmapped) are synthesized. */
export function exerciseDef(id: string, custom: ExerciseDef[] = []): ExerciseDef {
  return (
    custom.find((e) => e.id === id) ??
    BUILTIN_EXERCISES.find((e) => e.id === id) ?? {
      id,
      name: id.startsWith('hevy:') ? id.slice(5) : id,
      muscle: 'Corpo intero',
      equipment: 'Altro',
      kind: 'weight_reps',
    }
  );
}

export function allExercises(custom: ExerciseDef[] = []): ExerciseDef[] {
  return [...BUILTIN_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export const usesWeight = (k: ExerciseKind) => k === 'weight_reps' || k === 'weighted_bodyweight' || k === 'assisted_bodyweight' || k === 'weight_duration';
export const usesReps = (k: ExerciseKind) => k === 'weight_reps' || k === 'bodyweight_reps' || k === 'weighted_bodyweight' || k === 'assisted_bodyweight';
export const usesTime = (k: ExerciseKind) => k === 'duration' || k === 'weight_duration' || k === 'distance_duration';
export const usesDistance = (k: ExerciseKind) => k === 'distance_duration';
