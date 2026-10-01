// Standardized vocabularies. Work and gym entries only use ids from these
// lists, so weekly/monthly/yearly statistics group reliably. Labels can be
// reworded freely; ids must never change once data exists.

import { ROSTER_COLLEAGUES, ROSTER_SHIFT_TYPES } from './roster';
import type { Settings, ShiftType } from './types';

export interface VocabItem {
  id: string;
  label: string;
  group?: string;
}

// ---------- Ginecologia, Ostetricia, Uroginecologia ----------

export const PROCEDURE_GROUPS = [
  'Ostetricia',
  'Ginecologia – isteroscopia',
  'Ginecologia – laparoscopia/laparotomia',
  'Ginecologia – vaginale e minori',
  'Ginecologia oncologica',
  'Uroginecologia',
  'Senologia',
] as const;

export const PROCEDURES: VocabItem[] = [
  // Ostetricia
  { id: 'ob-parto-spontaneo', label: 'Assistenza al parto spontaneo', group: 'Ostetricia' },
  { id: 'ob-parto-operativo-ventosa', label: 'Parto operativo con ventosa', group: 'Ostetricia' },
  { id: 'ob-tc-elettivo', label: 'Taglio cesareo elettivo', group: 'Ostetricia' },
  { id: 'ob-tc-urgente', label: 'Taglio cesareo urgente/emergente', group: 'Ostetricia' },
  { id: 'ob-tc-iterativo', label: 'Taglio cesareo iterativo', group: 'Ostetricia' },
  { id: 'ob-episiorrafia', label: 'Episiotomia/episiorrafia', group: 'Ostetricia' },
  { id: 'ob-lacerazione-3-4', label: 'Riparazione lacerazione perineale III–IV grado', group: 'Ostetricia' },
  { id: 'ob-secondamento-manuale', label: 'Secondamento manuale', group: 'Ostetricia' },
  { id: 'ob-revisione-cavita', label: 'Revisione della cavità uterina', group: 'Ostetricia' },
  { id: 'ob-balloon-bakri', label: 'Balloon intrauterino (Bakri) per EPP', group: 'Ostetricia' },
  { id: 'ob-b-lynch', label: 'Sutura compressiva (B-Lynch)', group: 'Ostetricia' },
  { id: 'ob-isterectomia-peripartum', label: 'Isterectomia peripartum', group: 'Ostetricia' },
  { id: 'ob-cerchiaggio', label: 'Cerchiaggio cervicale', group: 'Ostetricia' },
  { id: 'ob-versione-esterna', label: 'Rivolgimento per manovre esterne', group: 'Ostetricia' },
  { id: 'ob-amniocentesi', label: 'Amniocentesi', group: 'Ostetricia' },
  { id: 'ob-villocentesi', label: 'Villocentesi (CVS)', group: 'Ostetricia' },
  { id: 'ob-ivg-chirurgica', label: 'IVG / RCU (isterosuzione)', group: 'Ostetricia' },
  { id: 'ob-extrauterina-lps', label: 'Gravidanza extrauterina – laparoscopia', group: 'Ostetricia' },

  // Isteroscopia
  { id: 'hys-diagnostica', label: 'Isteroscopia diagnostica', group: 'Ginecologia – isteroscopia' },
  { id: 'hys-polipectomia', label: 'Polipectomia isteroscopica', group: 'Ginecologia – isteroscopia' },
  { id: 'hys-miomectomia', label: 'Miomectomia isteroscopica', group: 'Ginecologia – isteroscopia' },
  { id: 'hys-metroplastica', label: 'Metroplastica isteroscopica (setto)', group: 'Ginecologia – isteroscopia' },
  { id: 'hys-adesiolisi', label: 'Adesiolisi isteroscopica', group: 'Ginecologia – isteroscopia' },
  { id: 'hys-ablazione', label: 'Ablazione/resezione endometriale', group: 'Ginecologia – isteroscopia' },
  { id: 'hys-rimozione-iud', label: 'Rimozione IUD/corpo estraneo', group: 'Ginecologia – isteroscopia' },

  // Laparoscopia / laparotomia
  { id: 'lps-diagnostica', label: 'Laparoscopia diagnostica', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-cistectomia-ovarica', label: 'Cistectomia ovarica', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-annessiectomia', label: 'Annessiectomia (mono/bilaterale)', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-salpingectomia', label: 'Salpingectomia', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-detorsione', label: 'Detorsione annessiale', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-endometriosi', label: 'Exeresi endometriosi (superficiale/profonda)', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-miomectomia', label: 'Miomectomia', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-isterectomia-totale', label: 'Isterectomia totale', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-isterectomia-subtotale', label: 'Isterectomia subtotale', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-cromosalpingoscopia', label: 'Cromosalpingoscopia', group: 'Ginecologia – laparoscopia/laparotomia' },
  { id: 'lps-sterilizzazione', label: 'Sterilizzazione tubarica', group: 'Ginecologia – laparoscopia/laparotomia' },

  // Vaginale e minori
  { id: 'vag-isterectomia', label: 'Isterectomia vaginale', group: 'Ginecologia – vaginale e minori' },
  { id: 'vag-conizzazione-leep', label: 'Conizzazione / LEEP', group: 'Ginecologia – vaginale e minori' },
  { id: 'vag-biopsia-cervice', label: 'Biopsia cervicale/vulvare', group: 'Ginecologia – vaginale e minori' },
  { id: 'vag-bartolini', label: 'Marsupializzazione/exeresi ghiandola di Bartolini', group: 'Ginecologia – vaginale e minori' },
  { id: 'vag-rcu', label: 'Revisione cavità (RCU) / dilatazione e curettage', group: 'Ginecologia – vaginale e minori' },
  { id: 'vag-polipectomia-cervicale', label: 'Polipectomia cervicale', group: 'Ginecologia – vaginale e minori' },
  { id: 'vag-iud-inserimento', label: 'Inserimento IUD / impianto sottocutaneo', group: 'Ginecologia – vaginale e minori' },

  // Oncologia
  { id: 'onc-isterectomia-radicale', label: 'Isterectomia radicale', group: 'Ginecologia oncologica' },
  { id: 'onc-linfadenectomia-pelvica', label: 'Linfadenectomia pelvica', group: 'Ginecologia oncologica' },
  { id: 'onc-linfadenectomia-aortica', label: 'Linfadenectomia lombo-aortica', group: 'Ginecologia oncologica' },
  { id: 'onc-linfonodo-sentinella', label: 'Linfonodo sentinella', group: 'Ginecologia oncologica' },
  { id: 'onc-stadiazione-ovaio', label: 'Stadiazione carcinoma ovarico', group: 'Ginecologia oncologica' },
  { id: 'onc-citoriduzione', label: 'Chirurgia citoriduttiva', group: 'Ginecologia oncologica' },
  { id: 'onc-omentectomia', label: 'Omentectomia', group: 'Ginecologia oncologica' },
  { id: 'onc-vulvectomia', label: 'Vulvectomia (semplice/radicale)', group: 'Ginecologia oncologica' },
  { id: 'onc-trachelectomia', label: 'Trachelectomia', group: 'Ginecologia oncologica' },

  // Uroginecologia
  { id: 'uro-colporrafia-anteriore', label: 'Colporrafia anteriore', group: 'Uroginecologia' },
  { id: 'uro-colporrafia-posteriore', label: 'Colporrafia posteriore / perineoplastica', group: 'Uroginecologia' },
  { id: 'uro-sospensione-sacrospinosa', label: 'Sospensione al legamento sacrospinoso', group: 'Uroginecologia' },
  { id: 'uro-sospensione-uterosacrale', label: 'Sospensione agli uterosacrali (McCall/Shull)', group: 'Uroginecologia' },
  { id: 'uro-sacrocolpopessi', label: 'Sacrocolpopessi / sacroisteropessi', group: 'Uroginecologia' },
  { id: 'uro-colpocleisi', label: 'Colpocleisi', group: 'Uroginecologia' },
  { id: 'uro-sling-tot', label: 'Sling medio-uretrale TOT/TVT-O', group: 'Uroginecologia' },
  { id: 'uro-sling-tvt', label: 'Sling medio-uretrale retropubico (TVT)', group: 'Uroginecologia' },
  { id: 'uro-mini-sling', label: 'Mini-sling (single incision)', group: 'Uroginecologia' },
  { id: 'uro-bulking', label: 'Iniezione di bulking agent uretrale', group: 'Uroginecologia' },
  { id: 'uro-botox', label: 'Tossina botulinica intravescicale', group: 'Uroginecologia' },
  { id: 'uro-rimozione-mesh', label: 'Rimozione/revisione mesh o sling', group: 'Uroginecologia' },
  { id: 'uro-fistola', label: 'Riparazione fistola vescico/retto-vaginale', group: 'Uroginecologia' },
  { id: 'uro-cistoscopia', label: 'Cistoscopia', group: 'Uroginecologia' },
  { id: 'uro-pessario', label: 'Posizionamento pessario', group: 'Uroginecologia' },

  // Senologia
  { id: 'sen-biopsia', label: 'Biopsia mammaria', group: 'Senologia' },
  { id: 'sen-nodulectomia', label: 'Nodulectomia / quadrantectomia', group: 'Senologia' },
];

export const SURGICAL_ROLES: VocabItem[] = [
  { id: 'first', label: 'Primo operatore' },
  { id: 'first-tutored', label: 'Primo operatore con tutor' },
  { id: 'second', label: 'Secondo operatore' },
  { id: 'assistant', label: 'Aiuto / assistente' },
  { id: 'observer', label: 'Osservatore' },
];

export const APPROACHES: VocabItem[] = [
  { id: 'vaginal', label: 'Vaginale' },
  { id: 'laparoscopic', label: 'Laparoscopico' },
  { id: 'robotic', label: 'Robotico' },
  { id: 'open', label: 'Laparotomico' },
  { id: 'hysteroscopic', label: 'Isteroscopico' },
  { id: 'endoscopic', label: 'Endoscopico/cistoscopico' },
  { id: 'percutaneous', label: 'Ecoguidato/percutaneo' },
  { id: 'na', label: 'Non applicabile' },
];

export const SETTINGS_URGENCY: VocabItem[] = [
  { id: 'elective', label: 'Elezione' },
  { id: 'urgent', label: 'Urgenza' },
  { id: 'emergency', label: 'Emergenza' },
];

export const CLAVIEN: VocabItem[] = [
  { id: 'none', label: 'Nessuna complicanza' },
  { id: 'I', label: 'Clavien-Dindo I' },
  { id: 'II', label: 'Clavien-Dindo II' },
  { id: 'IIIa', label: 'Clavien-Dindo IIIa' },
  { id: 'IIIb', label: 'Clavien-Dindo IIIb' },
  { id: 'IVa', label: 'Clavien-Dindo IVa' },
  { id: 'IVb', label: 'Clavien-Dindo IVb' },
  { id: 'V', label: 'Clavien-Dindo V' },
];

export const CLINICAL_ACTIVITIES: VocabItem[] = [
  { id: 'amb-gin', label: 'Visita ambulatoriale ginecologica', group: 'Ambulatorio' },
  { id: 'amb-ost', label: 'Visita ambulatoriale ostetrica', group: 'Ambulatorio' },
  { id: 'amb-gravidanza-rischio', label: 'Ambulatorio gravidanza a rischio', group: 'Ambulatorio' },
  { id: 'amb-uroginecologia', label: 'Visita uroginecologica', group: 'Ambulatorio' },
  { id: 'amb-oncologia', label: 'Follow-up oncologico', group: 'Ambulatorio' },
  { id: 'eco-ostetrica-1t', label: 'Ecografia ostetrica I trimestre', group: 'Ecografia' },
  { id: 'eco-morfologica', label: 'Ecografia morfologica', group: 'Ecografia' },
  { id: 'eco-accrescimento', label: 'Ecografia accrescimento/doppler', group: 'Ecografia' },
  { id: 'eco-ginecologica', label: 'Ecografia ginecologica TV', group: 'Ecografia' },
  { id: 'eco-pavimento', label: 'Ecografia pavimento pelvico', group: 'Ecografia' },
  { id: 'urodinamica', label: 'Esame urodinamico', group: 'Diagnostica' },
  { id: 'colposcopia', label: 'Colposcopia', group: 'Diagnostica' },
  { id: 'ctg', label: 'Lettura CTG', group: 'Diagnostica' },
  { id: 'ps-ostgin', label: 'Valutazione in PS ostetrico-ginecologico', group: 'Urgenza' },
  { id: 'consulenza', label: 'Consulenza in altro reparto', group: 'Urgenza' },
  { id: 'reparto-pazienti', label: 'Pazienti seguite in reparto', group: 'Reparto' },
  { id: 'sala-parto-travagli', label: 'Travagli seguiti in sala parto', group: 'Reparto' },
];

export const STUDY_TYPES: VocabItem[] = [
  { id: 'article', label: 'Lettura articoli' },
  { id: 'book', label: 'Libro / manuale' },
  { id: 'guideline', label: 'Linee guida' },
  { id: 'course', label: 'Corso / FAD' },
  { id: 'congress', label: 'Congresso' },
  { id: 'webinar', label: 'Webinar' },
  { id: 'lesson', label: 'Lezione specializzazione' },
  { id: 'video', label: 'Video chirurgico' },
  { id: 'simulation', label: 'Simulazione / pelvic trainer' },
  { id: 'writing', label: 'Scrittura paper / tesi' },
  { id: 'teaching', label: 'Didattica ad altri' },
];

export const STUDY_AREAS: VocabItem[] = [
  { id: 'obstetrics', label: 'Ostetricia' },
  { id: 'fetal-medicine', label: 'Medicina materno-fetale' },
  { id: 'gynecology', label: 'Ginecologia' },
  { id: 'urogynecology', label: 'Uroginecologia' },
  { id: 'oncology', label: 'Oncologia ginecologica' },
  { id: 'endometriosis', label: 'Endometriosi' },
  { id: 'reproductive', label: 'Medicina della riproduzione' },
  { id: 'ultrasound', label: 'Ecografia' },
  { id: 'surgery', label: 'Tecnica chirurgica' },
  { id: 'research', label: 'Ricerca / statistica' },
  { id: 'other', label: 'Altro' },
];

// ---------- Palestra ----------

export const WORKOUT_TYPES: VocabItem[] = [
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
  { id: 'legs', label: 'Legs' },
  { id: 'strength', label: 'Pesi / forza' },
  { id: 'hypertrophy', label: 'Ipertrofia' },
  { id: 'functional', label: 'Funzionale / cross training' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'run', label: 'Corsa' },
  { id: 'bike', label: 'Bici' },
  { id: 'swim', label: 'Nuoto' },
  { id: 'walk', label: 'Camminata / trekking' },
  { id: 'yoga', label: 'Yoga / mobilità' },
  { id: 'sport', label: 'Sport di squadra / racchetta' },
  { id: 'other', label: 'Altro' },
];

export const EXERCISES: VocabItem[] = [
  { id: 'squat', label: 'Squat', group: 'Gambe' },
  { id: 'front-squat', label: 'Front squat', group: 'Gambe' },
  { id: 'leg-press', label: 'Leg press', group: 'Gambe' },
  { id: 'lunge', label: 'Affondi', group: 'Gambe' },
  { id: 'rdl', label: 'Stacco rumeno', group: 'Gambe' },
  { id: 'leg-curl', label: 'Leg curl', group: 'Gambe' },
  { id: 'leg-extension', label: 'Leg extension', group: 'Gambe' },
  { id: 'hip-thrust', label: 'Hip thrust', group: 'Gambe' },
  { id: 'calf', label: 'Calf raise', group: 'Gambe' },
  { id: 'deadlift', label: 'Stacco da terra', group: 'Schiena' },
  { id: 'pull-up', label: 'Trazioni', group: 'Schiena' },
  { id: 'lat-pulldown', label: 'Lat machine', group: 'Schiena' },
  { id: 'barbell-row', label: 'Rematore bilanciere', group: 'Schiena' },
  { id: 'cable-row', label: 'Pulley', group: 'Schiena' },
  { id: 'bench', label: 'Panca piana', group: 'Petto' },
  { id: 'incline-bench', label: 'Panca inclinata', group: 'Petto' },
  { id: 'dips', label: 'Dip', group: 'Petto' },
  { id: 'push-up', label: 'Piegamenti', group: 'Petto' },
  { id: 'chest-fly', label: 'Croci', group: 'Petto' },
  { id: 'ohp', label: 'Military press', group: 'Spalle' },
  { id: 'lateral-raise', label: 'Alzate laterali', group: 'Spalle' },
  { id: 'face-pull', label: 'Face pull', group: 'Spalle' },
  { id: 'curl', label: 'Curl bicipiti', group: 'Braccia' },
  { id: 'triceps', label: 'Push-down tricipiti', group: 'Braccia' },
  { id: 'plank', label: 'Plank', group: 'Core' },
  { id: 'crunch', label: 'Crunch / addominali', group: 'Core' },
  { id: 'hanging-leg', label: 'Leg raise alla sbarra', group: 'Core' },
];

// ---------- Vita privata ----------

export const OUTING_TYPES: VocabItem[] = [
  { id: 'trip', label: 'Gita' },
  { id: 'travel', label: 'Viaggio' },
  { id: 'dinner', label: 'Cena / aperitivo' },
  { id: 'friends', label: 'Uscita con amici' },
  { id: 'family', label: 'Famiglia' },
  { id: 'culture', label: 'Cinema / teatro / mostra' },
  { id: 'concert', label: 'Concerto / evento' },
  { id: 'nature', label: 'Natura / montagna' },
  { id: 'other', label: 'Altro' },
];

// ---------- Categorie generali (impegni, promemoria, note) ----------

export const CATEGORIES: VocabItem[] = [
  { id: 'lavoro', label: 'Lavoro' },
  { id: 'studio', label: 'Studio / formazione' },
  { id: 'salute', label: 'Salute' },
  { id: 'sport', label: 'Sport' },
  { id: 'famiglia', label: 'Famiglia' },
  { id: 'amici', label: 'Amici' },
  { id: 'casa', label: 'Casa' },
  { id: 'burocrazia', label: 'Burocrazia' },
  { id: 'finanze', label: 'Finanze' },
  { id: 'svago', label: 'Svago' },
  { id: 'altro', label: 'Altro' },
];

// ---------- Default settings ----------

/** Guardia medica (continuità assistenziale), fuori dal tabellone di reparto. */
const CA_SHIFT_TYPES: ShiftType[] = [
  { id: 'ca-notturno', name: 'Guardia medica notturna', start: '20:00', end: '08:00', color: '#4a4e69', countsAsWork: true, group: 'Guardia medica' },
  { id: 'ca-prefestivo', name: 'Guardia medica prefestivo', start: '08:00', end: '20:00', color: '#7a8fa6', countsAsWork: true, group: 'Guardia medica' },
  { id: 'ca-festivo', name: 'Guardia medica festivo', start: '08:00', end: '20:00', color: '#8d7aa6', countsAsWork: true, group: 'Guardia medica' },
];

export const DEFAULT_SHIFT_TYPES: ShiftType[] = [...ROSTER_SHIFT_TYPES, ...CA_SHIFT_TYPES];

/** Ids of the generic shift types shipped before the department roster (seed 1). */
const SEED1_SHIFT_IDS = new Set([
  'mattino', 'pomeriggio', 'giornata', 'notte', 'guardia-24', 'sala-operatoria', 'sala-parto', 'ambulatorio',
  'reperibilita', 'ca-notturno', 'ca-prefestivo', 'ca-festivo', 'smonto', 'riposo', 'ferie',
]);

export const SEED_VERSION = 2;

export function defaultSettings(): Settings {
  return {
    colleagues: ROSTER_COLLEAGUES,
    shiftTypes: DEFAULT_SHIFT_TYPES,
    gcal: { enabled: false, calendarId: 'primary', readCalendarIds: ['primary'] },
    seed: SEED_VERSION,
    updatedAt: 0,
  };
}

/**
 * Brings saved settings up to the current defaults without losing user edits:
 * seed 2 swaps the generic shift types for the department codes (custom types
 * are kept) and adds the roster colleagues missing by name.
 */
export function migrateSettings(s: Settings): Settings {
  if ((s.seed ?? 1) >= SEED_VERSION) return s;
  const custom = s.shiftTypes.filter((t) => !SEED1_SHIFT_IDS.has(t.id) && !DEFAULT_SHIFT_TYPES.some((d) => d.id === t.id));
  const known = new Set(s.colleagues.map((c) => c.name.trim().toLowerCase()));
  const extra = ROSTER_COLLEAGUES.filter((c) => !known.has(c.name.toLowerCase()));
  return { ...s, shiftTypes: [...DEFAULT_SHIFT_TYPES, ...custom], colleagues: [...extra, ...s.colleagues], seed: SEED_VERSION };
}

/** Exercise label: standardized Italian name, or the Hevy name for unmapped exercises. */
export function exerciseLabel(id: string): string {
  return id.startsWith('hevy:') ? id.slice(5) : labelOf(EXERCISES, id);
}

export function labelOf(list: VocabItem[], id: string | undefined): string {
  if (!id) return '';
  return list.find((v) => v.id === id)?.label ?? id;
}

export function grouped(list: VocabItem[]): [string, VocabItem[]][] {
  const map = new Map<string, VocabItem[]>();
  for (const item of list) {
    const g = item.group ?? '';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  return [...map.entries()];
}
